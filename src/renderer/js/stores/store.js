/* =========================================================================
 * Global store — minimal reactive state (spec §6.2 UIState / DataStore)
 * ========================================================================= */

window.Store = (() => {
  const state = {
    accounts: [],
    activeAccount: null,
    versions: { latest: {}, list: [], counts: {} },
    installedVersions: [],
    selectedVersion: null,
    selectedModpack: null,
    selectedInstallPath: null,
    settings: {},
    downloads: { active: [], queue: [], completed: [], paused: [] },
    consoleLines: [],
    news: [],
    isLaunching: false,
    currentView: 'home'
  };

  const listeners = new Map();  // key → Set<fn>

  function get(key) { return state[key]; }
  function set(key, val) {
    state[key] = val;
    if (listeners.has(key)) listeners.get(key).forEach(fn => fn(val));
  }
  function patch(key, partial) {
    state[key] = { ...state[key], ...partial };
    if (listeners.has(key)) listeners.get(key).forEach(fn => fn(state[key]));
  }
  function push(key, item) {
    state[key] = [...state[key], item];
    if (listeners.has(key)) listeners.get(key).forEach(fn => fn(state[key]));
  }
  function on(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  }

  return { get, set, patch, push, on, state };
})();
