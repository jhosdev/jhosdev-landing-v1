// Machine-speak and UI chrome for the home page, the intro and the article
// pages: strings that are not facts about the person. Profile content never
// lives here; it comes from getContent()/getResume() and the writing collection.

import type { ShellLocale, ShellStrings } from '../shell/commands';
import { shellCopy } from '../shell/copy';

/** Addressable sections, in page order. Each id is a URL hash and a command. */
export const SECTIONS = ['asset', 'associations', 'projects', 'writing', 'simulation', 'contact'] as const;
export type SectionId = (typeof SECTIONS)[number];

/** Commands offered by `help` and tab completion on the home page, in display order. */
export const MACHINE_COMMANDS = [...SECTIONS, 'open', 'resume', 'lang', 'all', 'replay', 'help', 'clear'] as const;

/** Strings drawn on the canvas by the authored intro (scene.ts). */
export interface SceneCopy {
  log: [string, string][];
  online: string;
  nominal: string;
  initializing: string;
  irrelevant: string;
  inFrame: string;
  oneUnidentified: string;
  unidentified: string;
  analyzing: string;
  confirmed: string;
  match: string;
  rows: { subject: string; alias: string; designation: string; location: string; current: string };
  asset: string;
  classification: string;
  subject: string;
  designation: string;
  rec: string;
  recShort: string;
  /** One name per scene of the full timeline. */
  scenes: string[];
}

interface SectionCopy {
  title: string;
  /** One sentence under the heading. */
  sub: string;
  /** Unit after the count in the header readout, e.g. "05 targets". */
  unit: string;
}

export interface MachineCopy {
  scene: SceneCopy;
  sections: Record<SectionId, SectionCopy>;
  monitoring: string;
  identifiers: string;
  speaks: string;
  behaviour: string;
  affiliation: string;
  active: string;
  archived: string;
  target: string;
  classifying: string;
  transmission: string;
  intercepting: string;
  intercepted: string;
  decoded: string;
  read: string;
  outcomes: string;
  handshake: string;
  channelOpen: string;
  dossier: string;
  download: string;
  endOfFile: string;
  lastModified: string;
  // Top bar, dock and focus mode.
  feed: string;
  skipToContent: string;
  skip: string;
  chipsLabel: string;
  inputLabel: string;
  logLabel: string;
  placeholder: string;
  placeholderShort: string;
  runLabel: string;
  completeLabel: string;
  closeLabel: string;
  fullFile: string;
  excerptEnds: string;
  navigating: string;
  /** Said when `replay` is asked for under reduced motion. */
  still: string;
  /** Extra command names that resolve to a section (or another command). */
  aliases: Record<string, string>;
  t: ShellStrings;
}

const ALIASES: Record<string, string> = {
  whoami: 'asset',
  about: 'asset',
  stack: 'asset',
  skills: 'asset',
  home: 'asset',
  companies: 'associations',
  work: 'associations',
  experience: 'associations',
  articles: 'writing',
  blog: 'writing',
  posts: 'writing',
  play: 'simulation',
  game: 'simulation',
  tictactoe: 'simulation',
  email: 'contact',
};

export const machineCopy: Record<ShellLocale, MachineCopy> = {
  en: {
    scene: {
      log: [
        ['BOOT SEQUENCE', 'OK'],
        ['OPTICAL FEEDS', '0412'],
        ['AUDIO INTERCEPT', 'OK'],
        ['IDENTITY INDEX', 'OK'],
        ['QUERY', 'LOCATE ASSET'],
      ],
      online: 'ONLINE',
      nominal: 'ALL FEEDS NOMINAL',
      initializing: 'INITIALIZING',
      irrelevant: 'IRRELEVANT',
      inFrame: 'ENTITIES IN FRAME',
      oneUnidentified: '1 UNIDENTIFIED',
      unidentified: 'UNIDENTIFIED',
      analyzing: 'ANALYZING',
      confirmed: 'ASSET · CONFIRMED',
      match: 'MATCH',
      rows: { subject: 'SUBJECT', alias: 'ALIAS', designation: 'DESIGNATION', location: 'LOCATION', current: 'CURRENT' },
      asset: 'ASSET',
      classification: 'CLASSIFICATION',
      subject: 'SUBJECT',
      designation: 'DESIGNATION',
      rec: 'REC  FEED 0412 · POV',
      recShort: 'REC · POV',
      scenes: ['BOOT', 'SWEEP', 'ACQUIRE', 'IDENTIFY', 'SYSTEMS', 'RECORD', 'ASSESS', 'MONITOR'],
    },
    sections: {
      asset: { title: 'Asset', sub: '', unit: '' },
      associations: {
        title: 'Known associations',
        sub: 'Companies linked to the asset. Select one to open its record.',
        unit: 'entities',
      },
      projects: { title: 'Projects', sub: 'Systems attributed to the asset, acquired and classified.', unit: 'targets' },
      writing: { title: 'Writing', sub: 'Transmissions intercepted from the asset. Each one decodes into an article.', unit: 'intercepted' },
      simulation: { title: 'Simulation', sub: 'The Machine runs every outcome before it moves. Try to beat it.', unit: 'outcomes' },
      contact: { title: 'Contact', sub: '', unit: '' },
    },
    monitoring: 'Monitoring',
    identifiers: 'Identifiers',
    speaks: 'Speaks',
    behaviour: 'Observed behaviour',
    affiliation: 'Affiliation',
    active: 'active',
    archived: 'archived',
    target: 'TGT',
    classifying: 'Classifying',
    transmission: 'TX',
    intercepting: 'Intercepting',
    intercepted: 'Transmission intercepted',
    decoded: 'Decoded',
    read: 'read transmission',
    outcomes: 'possible games',
    handshake: 'Handshake',
    channelOpen: 'Channel open',
    dossier: 'Dossier',
    download: 'download',
    endOfFile: 'End of file',
    lastModified: 'last modified',
    feed: 'Feed 0412',
    skipToContent: 'Skip to content',
    skip: 'any key, tap or scroll to skip',
    chipsLabel: 'Sections',
    inputLabel: 'Command line: type a section name, or help',
    logLabel: 'Command output',
    placeholder: 'type a section, or help',
    placeholderShort: 'section, or help',
    runLabel: 'Run command',
    completeLabel: 'Complete the suggestion',
    closeLabel: 'Close output',
    fullFile: 'full file',
    excerptEnds: 'Excerpt ends. The rest of the file is one command away.',
    navigating: 'accessing {} …',
    still: 'reduced motion is on: the intro stays off.',
    aliases: ALIASES,
    t: {
      ...shellCopy.en.t,
      help: {
        asset: 'identity record: stack and languages',
        associations: 'companies, as tracked entities',
        projects: 'systems, acquired and classified',
        writing: 'articles, as intercepted transmissions',
        simulation: 'play the Machine at tic-tac-toe',
        contact: 'open a channel',
        open: 'a project, company, article or link',
        resume: 'download the dossier (PDF)',
        lang: 'switch language',
        all: 'leave focus, show the full file',
        replay: 'replay the intro',
        help: 'this list',
        clear: 'clear this output',
      },
      helpIntro: '/ focuses the prompt, Tab completes, ↑ ↓ walk history. Every row is clickable.',
      cd: 'restricted shell. Try `projects`.',
    },
  },
  es: {
    scene: {
      log: [
        ['ARRANQUE', 'OK'],
        ['FEEDS ÓPTICOS', '0412'],
        ['ESCUCHA DE AUDIO', 'OK'],
        ['ÍNDICE DE IDENTIDAD', 'OK'],
        ['CONSULTA', 'LOCALIZAR ACTIVO'],
      ],
      online: 'EN LÍNEA',
      nominal: 'FEEDS NOMINALES',
      initializing: 'INICIALIZANDO',
      irrelevant: 'IRRELEVANTE',
      inFrame: 'ENTIDADES EN CUADRO',
      oneUnidentified: '1 NO IDENTIFICADO',
      unidentified: 'NO IDENTIFICADO',
      analyzing: 'ANALIZANDO',
      confirmed: 'ACTIVO · CONFIRMADO',
      match: 'COINCIDENCIA',
      rows: { subject: 'SUJETO', alias: 'ALIAS', designation: 'DESIGNACIÓN', location: 'UBICACIÓN', current: 'ACTUAL' },
      asset: 'ACTIVO',
      classification: 'CLASIFICACIÓN',
      subject: 'SUJETO',
      designation: 'DESIGNACIÓN',
      rec: 'REC  FEED 0412 · POV',
      recShort: 'REC · POV',
      scenes: ['ARRANQUE', 'BARRIDO', 'ADQUISICIÓN', 'IDENTIFICACIÓN', 'SISTEMAS', 'REGISTRO', 'EVALUACIÓN', 'MONITOREO'],
    },
    sections: {
      asset: { title: 'Activo', sub: '', unit: '' },
      associations: {
        title: 'Asociaciones conocidas',
        sub: 'Empresas vinculadas al activo. Selecciona una para abrir su expediente.',
        unit: 'entidades',
      },
      projects: { title: 'Proyectos', sub: 'Sistemas atribuidos al activo, adquiridos y clasificados.', unit: 'objetivos' },
      writing: { title: 'Artículos', sub: 'Transmisiones interceptadas al activo. Cada una se decodifica en un artículo.', unit: 'interceptadas' },
      simulation: { title: 'Simulación', sub: 'La Máquina recorre cada desenlace antes de mover. Intenta ganarle.', unit: 'desenlaces' },
      contact: { title: 'Contacto', sub: '', unit: '' },
    },
    monitoring: 'Monitoreando',
    identifiers: 'Identificadores',
    speaks: 'Habla',
    behaviour: 'Conducta observada',
    affiliation: 'Afiliación',
    active: 'activa',
    archived: 'archivada',
    target: 'OBJ',
    classifying: 'Clasificando',
    transmission: 'TX',
    intercepting: 'Interceptando',
    intercepted: 'Transmisión interceptada',
    decoded: 'Decodificada',
    read: 'leer transmisión',
    outcomes: 'partidas posibles',
    handshake: 'Negociando',
    channelOpen: 'Canal abierto',
    dossier: 'Expediente',
    download: 'descargar',
    endOfFile: 'Fin del archivo',
    lastModified: 'última modificación',
    feed: 'Feed 0412',
    skipToContent: 'Saltar al contenido',
    skip: 'pulsa una tecla, toca o desplaza para saltar',
    chipsLabel: 'Secciones',
    inputLabel: 'Línea de comandos: escribe una sección, o help',
    logLabel: 'Salida de comandos',
    placeholder: 'escribe una sección, o help',
    placeholderShort: 'sección, o help',
    runLabel: 'Ejecutar comando',
    completeLabel: 'Completar la sugerencia',
    closeLabel: 'Cerrar salida',
    fullFile: 'archivo completo',
    excerptEnds: 'Fin del extracto. El resto del archivo está a un comando.',
    navigating: 'accediendo a {} …',
    still: 'movimiento reducido activo: la intro queda desactivada.',
    aliases: {
      ...ALIASES,
      activo: 'asset',
      asociaciones: 'associations',
      empresas: 'associations',
      proyectos: 'projects',
      articulos: 'writing',
      simulacion: 'simulation',
      jugar: 'simulation',
      contacto: 'contact',
    },
    t: {
      ...shellCopy.es.t,
      help: {
        asset: 'ficha de identidad: stack e idiomas',
        associations: 'empresas, como entidades rastreadas',
        projects: 'sistemas, adquiridos y clasificados',
        writing: 'artículos, como transmisiones interceptadas',
        simulation: 'juega tres en raya contra la Máquina',
        contact: 'abre un canal',
        open: 'un proyecto, empresa, artículo o enlace',
        resume: 'descarga el expediente (PDF)',
        lang: 'cambia de idioma',
        all: 'sale del foco y muestra el archivo completo',
        replay: 'repite la intro',
        help: 'esta lista',
        clear: 'limpia esta salida',
      },
      helpIntro: '/ enfoca el prompt, Tab completa, ↑ ↓ recorren el historial. Cada fila es clicable.',
      cd: 'shell restringida. Prueba `projects`.',
    },
  },
};
