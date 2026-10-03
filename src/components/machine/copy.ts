// Machine-speak and UI chrome for the home page, the intro, the play page and
// the article pages: strings that are not facts about the person. Profile
// content never lives here; it comes from getContent()/getResume() and the
// writing collection.
//
// Two voices, kept apart on purpose:
//   - MACHINE: the Machine's own vocabulary (HUD chrome, scene names, section
//     titles, classification tags, command names). It is the same in every
//     locale: the Machine is not translated.
//   - HUMAN: what is said to the visitor (helper sentences, help descriptions,
//     accessible names). Translated per locale.

import type { ShellLocale, ShellStrings } from '../shell/commands';
import { shellCopy } from '../shell/copy';

/** Addressable sections, in page order. Each id is a URL hash and a command. */
export const SECTIONS = ['asset', 'about', 'associations', 'projects', 'opensource', 'writing', 'contact'] as const;
export type SectionId = (typeof SECTIONS)[number];

/** Commands offered by `help` and tab completion on the home page, in display order. `simulation` is not a section: it opens the play page. */
export const MACHINE_COMMANDS = [...SECTIONS, 'simulation', 'open', 'resume', 'lang', 'all', 'replay', 'help', 'clear'] as const;

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

interface MachineVoice {
  scene: SceneCopy;
  /** Section title, and the unit after the count in its readout ("05 targets"). */
  sections: Record<SectionId, { title: string; unit: string }>;
  monitoring: string;
  live: string;
  telemetry: string;
  employment: string;
  identifiers: string;
  speaks: string;
  behaviour: string;
  affiliation: string;
  active: string;
  archived: string;
  target: string;
  classifying: string;
  repository: string;
  indexing: string;
  publicRepo: string;
  transmission: string;
  intercepting: string;
  intercepted: string;
  decoded: string;
  offDuty: string;
  knownFacts: string;
  feline: string;
  /** What the cat is doing, as the Machine logs it in the about section's frame (catkeys.ts ABOUT_LOG points into it). */
  catLog: string[];
  /** The play page's title. */
  simulation: string;
  /** The word on the home's invitation to it. */
  play: string;
  /** What the Machine is called, in every language. */
  self: string;
  handshake: string;
  channelOpen: string;
  dossier: string;
  endOfFile: string;
  lastModified: string;
  feed: string;
  skip: string;
  replay: string;
  fullFile: string;
  navigating: string;
  /** Said when the cat is summoned; {} is its name. */
  catSeen: string;
}

interface HumanCopy {
  /** One sentence under each section heading. */
  subs: Record<SectionId, string>;
  read: string;
  viewSource: string;
  outcomes: string;
  /** The home's invitation to the play page; {} is the Machine's name. */
  teaser: string;
  /** One sentence under the play page's heading. */
  playSub: string;
  playTitle: string;
  playDescription: string;
  download: string;
  skipToContent: string;
  skipHint: string;
  chipsLabel: string;
  inputLabel: string;
  logLabel: string;
  placeholder: string;
  placeholderShort: string;
  runLabel: string;
  completeLabel: string;
  closeLabel: string;
  excerptEnds: string;
  /** Said when `replay` is asked for under reduced motion. */
  still: string;
  /** Help line for the cat's command. */
  catHelp: string;
  /** Extra command names that resolve to a section. Those pointing at `simulation` open the play page. */
  aliases: Record<string, string>;
  t: ShellStrings;
}

export interface MachineCopy extends Omit<MachineVoice, 'sections'>, Omit<HumanCopy, 'subs'> {
  sections: Record<SectionId, { title: string; unit: string; sub: string }>;
}

const MACHINE: MachineVoice = {
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
    asset: { title: 'Asset', unit: '' },
    about: { title: 'Personal file', unit: 'facts' },
    associations: { title: 'Known associations', unit: 'entities' },
    projects: { title: 'Projects', unit: 'targets' },
    opensource: { title: 'Open source', unit: 'repositories' },
    writing: { title: 'Writing', unit: 'intercepted' },
    contact: { title: 'Contact', unit: '' },
  },
  monitoring: 'Monitoring',
  live: 'Live',
  telemetry: 'Telemetry',
  employment: 'Employment',
  identifiers: 'Identifiers',
  speaks: 'Speaks',
  behaviour: 'Observed behaviour',
  affiliation: 'Affiliation',
  active: 'active',
  archived: 'archived',
  target: 'TGT',
  classifying: 'Classifying',
  repository: 'Repo',
  indexing: 'Indexing',
  publicRepo: 'Public',
  transmission: 'TX',
  intercepting: 'Intercepting',
  intercepted: 'Transmission intercepted',
  decoded: 'Decoded',
  offDuty: 'Off duty',
  knownFacts: 'Known facts',
  feline: 'Feline',
  catLog: ['Asleep', 'Waking', 'Yawning', 'Stretching', 'On watch · by the file', 'Slow blink · trust', 'Settling in'],
  simulation: 'Simulation',
  play: 'Play',
  self: 'the Machine',
  handshake: 'Handshake',
  channelOpen: 'Channel open',
  dossier: 'Dossier',
  endOfFile: 'End of file',
  lastModified: 'last modified',
  feed: 'Feed 0412',
  skip: 'Skip',
  replay: 'Replay intro',
  fullFile: 'full file',
  navigating: 'accessing {} …',
  catSeen: 'entity in frame: {} · feline · not a threat',
};

const ALIASES: Record<string, string> = {
  whoami: 'asset',
  stack: 'asset',
  skills: 'asset',
  home: 'asset',
  companies: 'associations',
  work: 'associations',
  experience: 'associations',
  oss: 'opensource',
  repos: 'opensource',
  articles: 'writing',
  blog: 'writing',
  posts: 'writing',
  me: 'about',
  bio: 'about',
  personal: 'about',
  play: 'simulation',
  game: 'simulation',
  tictactoe: 'simulation',
  email: 'contact',
};

const HUMAN: Record<ShellLocale, HumanCopy> = {
  en: {
    subs: {
      asset: '',
      associations: 'Companies linked to the asset. Select one to open its record.',
      projects: 'Systems attributed to the asset, acquired and classified.',
      opensource: 'Code the asset left in the open. Every repository links to its source.',
      writing: 'Transmissions intercepted from the asset. Each one decodes into an article.',
      about: 'What the asset does when nobody is paying for it.',
      contact: '',
    },
    playSub: 'The Machine runs every outcome before it moves.',
    read: 'read transmission',
    viewSource: 'view source',
    outcomes: 'possible games',
    teaser: 'Bored? Play against {} at tic-tac-toe.',
    playTitle: 'Play the Machine',
    playDescription: 'Tic-tac-toe against a minimax search you can watch think.',
    download: 'download',
    skipToContent: 'Skip to content',
    skipHint: 'or any key',
    chipsLabel: 'Sections',
    inputLabel: 'Command line: type a section name, or help',
    logLabel: 'Command output',
    placeholder: 'type a section, or help',
    placeholderShort: 'section, or help',
    runLabel: 'Run command',
    completeLabel: 'Complete the suggestion',
    closeLabel: 'Close output',
    excerptEnds: 'Excerpt ends. The rest of the file is one command away.',
    still: 'reduced motion is on: the intro stays off.',
    catHelp: 'the particles know this one',
    aliases: ALIASES,
    t: {
      ...shellCopy.en.t,
      help: {
        asset: 'identity record: stack and employers',
        associations: 'companies, as tracked entities',
        projects: 'systems, acquired and classified',
        opensource: 'public repositories',
        writing: 'articles, as intercepted transmissions',
        about: 'the personal file',
        simulation: 'play the Machine at tic-tac-toe',
        contact: 'open a channel',
        open: 'a project, repository, company, article or link',
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
    subs: {
      asset: '',
      associations: 'Empresas vinculadas al asset. Selecciona una para abrir su expediente.',
      projects: 'Sistemas atribuidos al asset, adquiridos y clasificados.',
      opensource: 'Código que el asset dejó a la vista. Cada repositorio enlaza a su fuente.',
      writing: 'Transmisiones interceptadas al asset. Cada una se decodifica en un artículo.',
      about: 'Lo que hace el asset cuando nadie le paga por ello.',
      contact: '',
    },
    playSub: 'La Máquina recorre cada desenlace antes de mover.',
    read: 'leer transmisión',
    viewSource: 'ver código',
    outcomes: 'partidas posibles',
    teaser: '¿Aburrido? Juega contra {} al tres en raya.',
    playTitle: 'Juega contra la Máquina',
    playDescription: 'Tres en raya contra una búsqueda minimax que puedes ver pensar.',
    download: 'descargar',
    skipToContent: 'Saltar al contenido',
    skipHint: 'o cualquier tecla',
    chipsLabel: 'Secciones',
    inputLabel: 'Línea de comandos: escribe una sección, o help',
    logLabel: 'Salida de comandos',
    placeholder: 'escribe una sección, o help',
    placeholderShort: 'sección, o help',
    runLabel: 'Ejecutar comando',
    completeLabel: 'Completar la sugerencia',
    closeLabel: 'Cerrar salida',
    excerptEnds: 'Fin del extracto. El resto del archivo está a un comando.',
    still: 'movimiento reducido activo: la intro queda desactivada.',
    catHelp: 'las partículas la conocen',
    aliases: {
      ...ALIASES,
      empresas: 'associations',
      proyectos: 'projects',
      repositorios: 'opensource',
      articulos: 'writing',
      sobre: 'about',
      jugar: 'simulation',
      contacto: 'contact',
    },
    t: {
      ...shellCopy.es.t,
      help: {
        asset: 'ficha de identidad: stack y empleadores',
        associations: 'empresas, como entidades rastreadas',
        projects: 'sistemas, adquiridos y clasificados',
        opensource: 'repositorios públicos',
        writing: 'artículos, como transmisiones interceptadas',
        about: 'el expediente personal',
        simulation: 'juega tres en raya contra la Máquina',
        contact: 'abre un canal',
        open: 'un proyecto, repositorio, empresa, artículo o enlace',
        resume: 'descarga el dossier (PDF)',
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

function compose(locale: ShellLocale): MachineCopy {
  const { subs, ...human } = HUMAN[locale];
  const { sections, ...machine } = MACHINE;
  return {
    ...machine,
    ...human,
    sections: Object.fromEntries(SECTIONS.map((id) => [id, { ...sections[id], sub: subs[id] }])) as MachineCopy['sections'],
  };
}

export const machineCopy: Record<ShellLocale, MachineCopy> = { en: compose('en'), es: compose('es') };
