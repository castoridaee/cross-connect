/**
 * A simple logger utility that respects the environment.
 * In production, it silences .log and .debug calls.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },
  debug: (...args) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  warn: (...args) => {
    // Keep warnings in production as they often indicate non-fatal but important issues
    console.warn(...args);
  },
  error: (...args) => {
    // Always keep errors in production
    console.error(...args);
  },
  info: (...args) => {
    if (isDev) {
      console.info(...args);
    }
  }
};
