---
title: "Event-loop head-of-line blocking: hunting 10-second latencies in a Python casino platform"
description: "How I traced sub-100ms p99 back from 10+ second provider stalls by finding blocking I/O hiding on the event loop."
date: 2026-02-10
lang: en
slug: event-loop-head-of-line-blocking
translationOf: event-loop-head-of-line-blocking
---

## The symptom

We run a casino aggregation platform that puts real-money bet, win, and rollback traffic from millions of players behind one event-driven API, backed by ~40 Python microservices on EKS. One of those services is a FastAPI app that talks to a dozen-plus external game providers over HTTP. On a normal day it holds sub-100ms p99. On a bad day, a chunk of requests would sit for over 10 seconds before the client saw a response — with nothing on the provider's own status page to explain it.

## How I traced it

The first instinct is "the provider is slow." Provider dashboards said otherwise: their own timings were in the hundreds of milliseconds. So the delay was ours. I pulled OpenTelemetry traces for the affected requests and lined them up against CloudWatch metrics for the same pods. The traces showed a strange pattern: a request's outbound call to the provider would start late — sometimes 9-10 seconds after the request entered the service — even though nothing in that request's own span chain explained the gap. Meanwhile CloudWatch showed CPU flat, but the async event loop's task queue backing up right before those stalls.

That combination — "my code has nothing slow in it" plus "the event loop looks backed up" — is the signature of head-of-line blocking on a single-threaded event loop, not a slow dependency.

## The mechanism

FastAPI, like anything on asyncio, runs one event loop per worker. Every `async def` handler that awaits I/O is supposed to yield control back to the loop so other requests keep making progress concurrently. The failure mode is when something in that call path does I/O *without* awaiting it — a synchronous library call, a non-async database driver, a blocking JSON or crypto operation, anything that holds the thread. That call blocks the entire loop, not just its own request. Every other coroutine scheduled on that worker — including completely unrelated provider calls — queues up behind it until the blocking call returns. One provider integration with a synchronous client buried a few layers down was enough to stall every other in-flight request on that worker for as long as that call took, and under real traffic that showed up as 10+ second latencies scattered across providers that had nothing to do with the actual slow call.

## The fix

The fix wasn't to make the slow call faster — it was to stop it from blocking the loop at all. I moved the offending I/O off the event loop with an executor (a thread pool), so the blocking call ran on its own thread while the loop kept serving every other coroutine normally. Concretely: find every call in the request path that isn't natively awaitable — synchronous HTTP clients, blocking drivers — and either replace it with an async-native equivalent or hand it off explicitly to `run_in_executor`/`to_thread` so it can't hold up the loop. Once that landed, p99 across providers dropped back under 100ms, because the loop was never actually starved for CPU — it was starved for cooperation.

## Takeaways

- A slow endpoint with a fast dependency is a blocking-I/O bug until proven otherwise — check the event loop, not just the network.
- OpenTelemetry spans tell you *where* the time went; CloudWatch tells you whether the *runtime* was healthy. You need both to rule providers in or out.
- On a single-threaded event loop, one badly-behaved call doesn't just hurt its own request — it hurts every request queued behind it. That's what makes it worth finding fast.
