// logger.js
// Production: suppress routine console output and redact sensitive fields.
// This is a logging hygiene layer, not a security boundary.
const isProd =
  location.hostname !== 'localhost' &&
  !location.hostname.startsWith('127.') &&
  !location.hostname.startsWith('192.168.') &&
  !location.hostname.endsWith('.local');

const noop = () => {};
const nativeConsole = typeof console === 'undefined'
  ? { log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop }
  : {
      log: console.log?.bind(console) || noop,
      info: console.info?.bind(console) || noop,
      warn: console.warn?.bind(console) || noop,
      error: console.error?.bind(console) || noop,
      debug: console.debug?.bind(console) || noop,
      trace: console.trace?.bind(console) || noop,
    };

const SENSITIVE = [
  /password/i, /token/i, /api[_-]?key/i, /secret/i,
  /uid/i, /rosterid/i, /signature/i, /authorization/i,
  /credential/i, /access[_-]?token/i, /refresh[_-]?token/i
];

function scrub(args) {
  return args.map(a => {
    if (a instanceof Error) {
      return { name: a.name, code: a.code || '', message: String(a.message || '') };
    }
    if (typeof a === 'string') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) return '[email]';
      return a.length > 400 ? a.slice(0, 400) + '…' : a;
    }
    if (a && typeof a === 'object') {
      try {
        const clone = {};
        for (const [k, v] of Object.entries(a)) {
          clone[k] = SENSITIVE.some(r => r.test(k)) ? '[redacted]' : v;
        }
        return clone;
      } catch {
        return '[object]';
      }
    }
    return a;
  });
}

export const log = {
  info: (...a) => { if (!isProd) nativeConsole.info(...scrub(a)); },
  warn: (...a) => { if (!isProd) nativeConsole.warn(...scrub(a)); },
  debug: (...a) => { if (!isProd) nativeConsole.debug(...scrub(a)); },
  error: (...a) => nativeConsole.error(...scrub(a)),
};

let hardened = false;

export function hardenConsole() {
  if (!isProd || hardened || typeof console === 'undefined') return;
  hardened = true;
  try {
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.trace = noop;
    console.warn = noop;
    // Keep errors available to the developer, but only through the scrubbed logger.
    console.error = (...a) => nativeConsole.error(...scrub(a));
  } catch {}
}
