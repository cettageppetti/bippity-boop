// Small event target for integration tests: retain every handler and honor once.
export function eventTarget() {
  const handlers = new Map();
  const listeners = {};
  return {
    listeners,
    addEventListener(type, callback, options = {}) {
      if (!handlers.has(type)) handlers.set(type, []);
      const registrations = handlers.get(type);
      if (!registrations.some(entry => entry.callback === callback)) {
        registrations.push({ callback, once: options?.once });
      }
      listeners[type] = event => {
        for (const entry of [...registrations]) {
          if (entry.once) registrations.splice(registrations.indexOf(entry), 1);
          entry.callback(event);
        }
      };
    }
  };
}
