---
title: "Head-of-line blocking del event loop: cazando latencias de 10 segundos en una plataforma de casino en Python"
description: "Cómo rastreé un p99 sub-100ms perdido en stalls de 10+ segundos de proveedores, encontrando I/O bloqueante escondido en el event loop."
date: 2026-02-10
lang: es
slug: event-loop-head-of-line-blocking
translationOf: event-loop-head-of-line-blocking
---

## El síntoma

Operamos una plataforma de agregación de casino que pone tráfico de apuestas, ganancias y rollbacks con dinero real de millones de jugadores detrás de una sola API orientada a eventos, respaldada por ~40 microservicios en Python sobre EKS. Uno de esos servicios es una app FastAPI que habla con más de una decena de proveedores de juego externos por HTTP. En un día normal mantiene un p99 sub-100ms. En un mal día, una parte de las solicitudes se quedaba esperando más de 10 segundos antes de que el cliente recibiera respuesta — sin nada en el status page del proveedor que lo explicara.

## Cómo lo rastreé

El primer instinto es pensar "el proveedor está lento". Los dashboards del proveedor decían lo contrario: sus propios tiempos estaban en cientos de milisegundos. Así que el retraso era nuestro. Saqué trazas de OpenTelemetry para las solicitudes afectadas y las crucé con métricas de CloudWatch de los mismos pods. Las trazas mostraban un patrón raro: la llamada saliente al proveedor arrancaba tarde — a veces 9-10 segundos después de que la solicitud entrara al servicio — aunque nada en la cadena de spans de esa misma solicitud explicara el hueco. Mientras tanto, CloudWatch mostraba CPU plano, pero la cola de tareas del event loop asíncrono se acumulaba justo antes de esos bloqueos.

Esa combinación — "mi código no tiene nada lento" más "el event loop se ve saturado" — es la firma de head-of-line blocking en un event loop de un solo hilo, no de una dependencia lenta.

## El mecanismo

FastAPI, como cualquier cosa sobre asyncio, corre un event loop por worker. Cada handler `async def` que hace await de I/O debe ceder el control de vuelta al loop para que otras solicitudes sigan avanzando en paralelo. El modo de fallo aparece cuando algo en ese camino hace I/O *sin* await — una llamada síncrona a una librería, un driver de base de datos no-async, una operación bloqueante de JSON o cripto, cualquier cosa que retenga el hilo. Esa llamada bloquea todo el loop, no solo su propia solicitud. Cualquier otra corrutina programada en ese worker — incluyendo llamadas a proveedores completamente distintos — se pone en cola detrás de ella hasta que la llamada bloqueante retorna. Bastó con una integración de proveedor con un cliente síncrono enterrado unas capas más abajo para congelar cada otra solicitud en vuelo en ese worker durante lo que durara esa llamada, y con tráfico real eso se manifestaba como latencias de 10+ segundos repartidas entre proveedores que no tenían nada que ver con la llamada lenta real.

## La solución

La solución no fue hacer más rápida la llamada lenta — fue evitar que bloqueara el loop en absoluto. Moví el I/O responsable fuera del event loop con un executor (un thread pool), para que la llamada bloqueante corriera en su propio hilo mientras el loop seguía atendiendo con normalidad a cada otra corrutina. En concreto: identificar cada llamada en el camino de la solicitud que no sea nativamente `await` — clientes HTTP síncronos, drivers bloqueantes — y reemplazarla por un equivalente async-native o pasarla explícitamente a `run_in_executor`/`to_thread` para que no pueda retener el loop. Una vez desplegado eso, el p99 entre proveedores volvió a caer por debajo de 100ms, porque el loop nunca estuvo realmente hambriento de CPU — estaba hambriento de cooperación.

## Lecciones

- Un endpoint lento con una dependencia rápida es un bug de I/O bloqueante hasta que se demuestre lo contrario — revisa el event loop, no solo la red.
- Los spans de OpenTelemetry te dicen *dónde* se fue el tiempo; CloudWatch te dice si el *runtime* estaba sano. Necesitas ambos para descartar o confirmar a los proveedores.
- En un event loop de un solo hilo, una llamada mal comportada no solo perjudica su propia solicitud — perjudica cada solicitud en cola detrás de ella. Por eso vale la pena encontrarla rápido.
