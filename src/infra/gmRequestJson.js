  function gmRequestJson({ method, url, headers, body, timeoutMs }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body,
        timeout: timeoutMs,
        responseType: 'text',
        onload: (resp) => {
          if (resp.status < 200 || resp.status >= 300) {
            reject(new Error(`HTTP ${resp.status}: ${resp.responseText?.slice?.(0, 500) || ''}`));
            return;
          }
          try {
            resolve(resp.responseText ? JSON.parse(resp.responseText) : null);
          } catch (e) {
            reject(new Error(`JSON parse failed: ${String(e)}`));
          }
        },
        ontimeout: () => reject(new Error('Request timeout')),
        onerror: () => reject(new Error('Request error')),
      });
    });
  }

