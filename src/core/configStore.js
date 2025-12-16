  function deepMerge(base, override) {
    if (!override || typeof override !== 'object') return base;
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        base &&
        typeof base[key] === 'object' &&
        !Array.isArray(base[key])
      ) {
        out[key] = deepMerge(base[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function createConfigStore(storageKey, defaults) {
    function read() {
      const raw = GM_getValue(storageKey, '');
      if (!raw) return defaults;
      try {
        const parsed = JSON.parse(raw);
        return deepMerge(defaults, parsed);
      } catch {
        return defaults;
      }
    }

    function write(nextConfig) {
      GM_setValue(storageKey, JSON.stringify(nextConfig));
    }

    function reset() {
      write(defaults);
    }

    return { read, write, reset };
  }

  const configStore = createConfigStore(STORAGE_KEY, defaultConfig);

  function getConfig() {
    return configStore.read();
  }

  function setConfig(config) {
    configStore.write(config);
  }

  function formatErrorMessage(err) {
    if (!err) return '未知错误';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message || String(err);
    return String(err);
  }

  function getByPath(obj, path) {
    if (!path) return obj;
    const parts = String(path).split('.').filter(Boolean);
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function toId(value) {
    if (value == null) return '';
    return String(value);
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    for (const v of values) {
      const s = toId(v);
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function substituteUrl(url, params) {
    let out = url;
    for (const [k, v] of Object.entries(params || {})) {
      out = out.replaceAll(`{${k}}`, encodeURIComponent(String(v)));
    }
    return out;
  }

  function debounce(fn, delayMs) {
    let t = 0;
    return (...args) => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), delayMs);
    };
  }

