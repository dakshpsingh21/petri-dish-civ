// events.js: a tiny event bus (publish / subscribe).
// The sim EMITS rare, important facts ("tribe founded", "tribe extinct"). Anyone can
// LISTEN (console now, History Book in S10-S11) without the sim knowing who's there.
//
// Rules: only rare events go here (never one per trade: 5k agents would flood it).
// Listeners must NOT change sim state, or history would depend on who is listening.

export function createBus() {
  const listeners = new Map();   // event type -> array of callback functions

  return {
    // Subscribe. Returns an "unsubscribe" function, so callers can clean up later.
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
      return () => {
        const fns = listeners.get(type);
        fns.splice(fns.indexOf(fn), 1);
      };
    },
    // Publish. Calls every listener for this type, in the order they subscribed.
    emit(type, data) {
      const fns = listeners.get(type);
      if (fns) for (const fn of fns) fn(data);
    },
  };
}
