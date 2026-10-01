// UI chrome for /lab/shell: strings that are not facts about the person.
// Profile content never lives here; it comes from getContent()/getResume().

import type { ShellLocale, ShellStrings } from './commands';

interface ShellCopy {
  /** Screen-reader names for the sections, appended to each command heading. */
  sections: Record<'projects' | 'stack' | 'principles' | 'experience' | 'writing' | 'contact', string>;
  chipsLabel: string;
  inputLabel: string;
  logLabel: string;
  placeholder: string;
  runLabel: string;
  skip: string;
  motd: string;
  exitLabel: string;
  t: ShellStrings;
}

export const shellCopy: Record<ShellLocale, ShellCopy> = {
  en: {
    sections: {
      projects: 'Projects',
      stack: 'Stack',
      principles: 'Principles',
      experience: 'Experience',
      writing: 'Writing',
      contact: 'Contact',
    },
    chipsLabel: 'Commands',
    inputLabel: 'Terminal command',
    logLabel: 'Terminal output',
    placeholder: 'type a command, or try help',
    runLabel: 'Run command',
    skip: 'any key or tap to skip',
    motd: 'This page is a shell. Type below, or tap a command.',
    exitLabel: 'main site',
    t: {
      help: {
        help: 'this list',
        whoami: 'who this is',
        ls: 'list files: ls, ls projects/, ls writing/',
        cat: 'print a file: cat stack.txt',
        projects: 'selected work',
        open: 'open a project, post or link',
        stack: 'tools, by layer',
        principles: 'how the work gets done',
        experience: 'work history',
        writing: 'posts',
        contact: 'ways to reach out',
        history: 'what you typed (--work for the career)',
        lang: 'switch language',
        clear: 'clear the screen',
        reset: 'print everything again',
        reboot: 'replay the boot sequence',
      },
      helpIntro: 'Tab completes, ↑ ↓ walk history. Every row below is clickable.',
      notFound: '{}: command not found',
      didYouMean: 'did you mean `{}`?',
      noSuchFile: '{}: No such file or directory',
      isDirectory: '{}: Is a directory',
      missingOperand: 'missing operand',
      binary: 'binary file, try `{}`',
      opening: 'opening {} …',
      readWith: 'full text: `{}`',
      langUsage: 'usage: lang en|es',
      langAlready: 'already speaking {}',
      sudo: '{} is not in the sudoers file. This incident will be reported.',
      rm: 'cannot remove: Read-only file system. Nice try.',
      cd: 'restricted shell. Try `ls projects/`.',
      hello: 'Hello, friend.',
      logout: 'logout',
    },
  },
  es: {
    sections: {
      projects: 'Proyectos',
      stack: 'Stack',
      principles: 'Principios',
      experience: 'Experiencia',
      writing: 'Artículos',
      contact: 'Contacto',
    },
    chipsLabel: 'Comandos',
    inputLabel: 'Comando de terminal',
    logLabel: 'Salida de la terminal',
    placeholder: 'escribe un comando, o prueba help',
    runLabel: 'Ejecutar comando',
    skip: 'pulsa una tecla o toca para saltar',
    motd: 'Esta página es una shell. Escribe abajo, o toca un comando.',
    exitLabel: 'sitio principal',
    t: {
      help: {
        help: 'esta lista',
        whoami: 'quién es',
        ls: 'lista archivos: ls, ls projects/, ls writing/',
        cat: 'imprime un archivo: cat stack.txt',
        projects: 'trabajo seleccionado',
        open: 'abre un proyecto, artículo o enlace',
        stack: 'herramientas, por capa',
        principles: 'cómo se hace el trabajo',
        experience: 'historial laboral',
        writing: 'artículos',
        contact: 'formas de contacto',
        history: 'lo que escribiste (--work para la carrera)',
        lang: 'cambia de idioma',
        clear: 'limpia la pantalla',
        reset: 'imprime todo de nuevo',
        reboot: 'repite la secuencia de arranque',
      },
      helpIntro: 'Tab completa, ↑ ↓ recorren el historial. Cada fila es clicable.',
      notFound: '{}: orden no encontrada',
      didYouMean: '¿quisiste decir `{}`?',
      noSuchFile: '{}: No existe el archivo o el directorio',
      isDirectory: '{}: Es un directorio',
      missingOperand: 'falta un operando',
      binary: 'archivo binario, prueba `{}`',
      opening: 'abriendo {} …',
      readWith: 'texto completo: `{}`',
      langUsage: 'uso: lang en|es',
      langAlready: 'ya hablamos {}',
      sudo: '{} no está en el archivo sudoers. Este incidente será reportado.',
      rm: 'no se puede borrar: sistema de archivos de solo lectura. Buen intento.',
      cd: 'shell restringida. Prueba `ls projects/`.',
      hello: 'Hola, amigo.',
      logout: 'logout',
    },
  },
};
