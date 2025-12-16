  function createLogger(logEl) {
    function line(level, msg) {
      const time = new Date().toLocaleTimeString();
      const div = el('div', { class: level }, `[${time}] ${msg}`);
      logEl.appendChild(div);
      logEl.scrollTop = logEl.scrollHeight;
    }
    return {
      info: (msg) => line('dim', msg),
      ok: (msg) => line('ok', msg),
      err: (msg) => line('err', msg),
      error: (prefix, err) => line('err', `${prefix}：${formatErrorMessage(err)}`),
      clear: () => (logEl.textContent = ''),
    };
  }

