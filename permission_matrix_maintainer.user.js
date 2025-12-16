// ==UserScript==
// @name         权限矩阵维护工具（权限点/页面/角色合并绑定）
// @namespace    https://local.example/permission-matrix
// @version      0.1.0
// @description  在任意页面注入权限矩阵维护面板：查询原角色/目标角色/权限点/页面清单（前端过滤+分页），支持合并原角色绑定并绑定到目标角色，或直接绑定选中权限点/页面到目标角色。
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'permission_matrix_maintainer_config_v1';
  const DOM_IDS = Object.freeze({
    button: 'pmm_btn',
    overlay: 'pmm_overlay',
    panel: 'pmm_panel',
    styles: 'pmm_styles',
    modal: 'pmm_modal',
  });

  const BIND_MODE = Object.freeze({
    REPLACE: 'replace',
    ADD: 'add',
  });

  const defaultConfig = {
    ui: { title: '权限矩阵维护' },
    request: {
      timeoutMs: 60000,
      headers: { 'Content-Type': 'application/json' },
    },
    api: {
      roles: { method: 'GET', url: '/api/roles', dataPath: 'data' },
      permissions: { method: 'GET', url: '/api/permissions', dataPath: 'data' },
      pages: { method: 'GET', url: '/api/pages', dataPath: 'data' },
      rolePermissions: { method: 'GET', url: '/api/roles/{roleId}/permissions', dataPath: 'data' },
      rolePages: { method: 'GET', url: '/api/roles/{roleId}/pages', dataPath: 'data' },
      bindPermissions: {
        method: 'POST',
        url: '/api/roles/bind-permissions',
        bulk: true,
        roleIdsKey: 'roleIds',
        itemIdsKey: 'permissionIds',
        modeKey: 'mode',
      },
      bindPages: {
        method: 'POST',
        url: '/api/roles/bind-pages',
        bulk: true,
        roleIdsKey: 'roleIds',
        itemIdsKey: 'pageIds',
        modeKey: 'mode',
      },
    },
    fields: {
      role: { id: 'id', name: 'name', code: 'code' },
      permission: { id: 'id', name: 'name', code: 'code' },
      page: { id: 'id', name: 'name', path: 'path' },
    },
  };

  const configStore = createConfigStore(STORAGE_KEY, defaultConfig);

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

  function debounce(fn, delayMs) {
    let t = 0;
    return (...args) => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), delayMs);
    };
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v != null) node.setAttribute(k, String(v));
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }
  function injectStyles() {
    if (document.getElementById(DOM_IDS.styles)) return;
    const css = `
      :root {
        --pmm-bg: #0b1020;
        --pmm-panel: #121a33;
        --pmm-card: #0f1730;
        --pmm-fg: #e7e9ee;
        --pmm-dim: #9aa3b2;
        --pmm-border: rgba(255,255,255,.12);
        --pmm-accent: #6aa9ff;
        --pmm-danger: #ff6a6a;
        --pmm-ok: #6affbf;

        --pmm-space-1: 8px;
        --pmm-space-2: 12px;
        --pmm-space-3: 16px;
        --pmm-space-4: 24px;

        --pmm-radius-sm: 10px;
        --pmm-radius: 12px;
        --pmm-radius-md: 14px;
        --pmm-radius-lg: 16px;

        --pmm-font-xs: 12px;
        --pmm-shadow-float: 0 10px 28px rgba(0,0,0,.35);
        --pmm-shadow-panel: 0 22px 80px rgba(0,0,0,.55);
      }
      #pmm_btn { position: fixed; right: var(--pmm-space-3); bottom: var(--pmm-space-3); z-index: 2147483647;
                 padding: 10px var(--pmm-space-2); border-radius: var(--pmm-radius-sm);
                 background: linear-gradient(135deg, rgba(106,169,255,.95), rgba(106,255,191,.85));
                 color: #0b1020; border: none; box-shadow: var(--pmm-shadow-float); cursor: pointer; font-weight: 700; }
      #pmm_overlay { position: fixed; inset: 0; z-index: 2147483646; background: rgba(0,0,0,.55); display: none; }
      #pmm_panel { position: absolute; inset: var(--pmm-space-4); border: 1px solid var(--pmm-border); background: rgba(18,26,51,.98);
                   border-radius: var(--pmm-radius-lg); overflow: hidden; box-shadow: var(--pmm-shadow-panel); color: var(--pmm-fg); }
      #pmm_header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--pmm-border); }
      #pmm_header h2 { margin: 0; font-size: 16px; letter-spacing: .5px; }
      #pmm_header .spacer { flex: 1; }
      .pmm_btn { background: rgba(255,255,255,.08); color: var(--pmm-fg); border: 1px solid var(--pmm-border);
                 padding: 8px 10px; border-radius: 10px; cursor: pointer; }
      .pmm_btn:hover { border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.10); }
      .pmm_btn.primary { background: rgba(106,169,255,.18); border-color: rgba(106,169,255,.35); }
      .pmm_btn.danger { background: rgba(255,106,106,.12); border-color: rgba(255,106,106,.28); }
      #pmm_body { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; gap: var(--pmm-space-2); padding: var(--pmm-space-2); height: calc(100% - 56px); }
      .pmm_card { background: rgba(15,23,48,.85); border: 1px solid var(--pmm-border); border-radius: var(--pmm-radius-md); overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
      .pmm_card_header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--pmm-border); }
      .pmm_card_header .title { font-weight: 700; }
      .pmm_toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .pmm_input { background: rgba(255,255,255,.06); color: var(--pmm-fg); border: 1px solid var(--pmm-border); border-radius: 10px; padding: 7px 10px; outline: none; }
      .pmm_input::placeholder { color: rgba(231,233,238,.55); }
      .pmm_select { background: rgba(255,255,255,.06); color: var(--pmm-fg); border: 1px solid var(--pmm-border); border-radius: 10px; padding: 7px 10px; outline: none; }
      .pmm_table_wrap { overflow: auto; flex: 1; }
      .pmm_table { width: 100%; border-collapse: collapse; font-size: var(--pmm-font-xs); }
      .pmm_table th, .pmm_table td { border-bottom: 1px solid rgba(255,255,255,.08); padding: 8px 10px; white-space: nowrap; }
      .pmm_table th { position: sticky; top: 0; background: rgba(15,23,48,.98); text-align: left; z-index: 1; }
      .pmm_table td { color: rgba(231,233,238,.92); }
      .pmm_dim { color: rgba(231,233,238,.64); }
      .pmm_pager { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--pmm-border); }
      .pmm_pager .spacer { flex: 1; }
      .pmm_badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); font-size: 12px; }
      #pmm_actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 10px var(--pmm-space-2); border-radius: var(--pmm-radius-md);
                    border: 1px solid var(--pmm-border); background: rgba(15,23,48,.7); }
      #pmm_log { flex: 1; min-height: 0; max-height: 120px; overflow: auto; border: 1px solid rgba(255,255,255,.10); border-radius: var(--pmm-radius); padding: var(--pmm-space-1) 10px; background: rgba(0,0,0,.18); font-size: var(--pmm-font-xs); }
      #pmm_log .ok { color: var(--pmm-ok); }
      #pmm_log .err { color: var(--pmm-danger); }
      #pmm_log .dim { color: rgba(231,233,238,.66); }
      #pmm_modal { position: fixed; inset: 0; z-index: 2147483647; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.55); }
      #pmm_modal .box { width: min(1000px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow: hidden; background: rgba(18,26,51,.98);
                        border: 1px solid var(--pmm-border); border-radius: 16px; box-shadow: 0 24px 88px rgba(0,0,0,.58); color: var(--pmm-fg); }
      #pmm_modal .box header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--pmm-border); }
      #pmm_modal .box header .title { font-weight: 800; }
      #pmm_modal textarea { width: 100%; height: min(520px, calc(100vh - 220px)); background: rgba(0,0,0,.18); color: var(--pmm-fg);
                            border: none; outline: none; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
      #pmm_modal .box footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 14px; border-top: 1px solid var(--pmm-border); }
      @media (max-width: 980px) { #pmm_body { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto; } #pmm_actions { flex-wrap: wrap; } }
    `;
    document.head.appendChild(el('style', { id: DOM_IDS.styles }, css));
  }

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
  function createTableCard({ title, columns, onReload }) {
    const state = {
      data: [],
      query: '',
      pageSize: 20,
      page: 1,
      selected: new Set(),
      loading: false,
    };

    const badge = el('span', { class: 'pmm_badge' }, '0 条 / 0 选中');
    const input = el('input', { class: 'pmm_input', placeholder: '过滤（前端）…' });
    const reloadBtn = el('button', { class: 'pmm_btn primary', type: 'button' }, '刷新');
    const clearSelBtn = el('button', { class: 'pmm_btn', type: 'button' }, '清空选择');
    const selectAllFilteredBtn = el('button', { class: 'pmm_btn', type: 'button' }, '全选(过滤后)');

    const pageSizeSel = el(
      'select',
      { class: 'pmm_select' },
      ...[10, 20, 50, 100, 200].map((n) => el('option', { value: String(n) }, `${n}/页`))
    );
    pageSizeSel.value = String(state.pageSize);

    const prevBtn = el('button', { class: 'pmm_btn', type: 'button' }, '上一页');
    const nextBtn = el('button', { class: 'pmm_btn', type: 'button' }, '下一页');
    const pageInfo = el('span', { class: 'pmm_dim' }, '第 1/1 页');

    const table = el('table', { class: 'pmm_table' });
    const thead = el('thead');
    const tbody = el('tbody');
    const headRow = el('tr');
    const headCheck = el('input', { type: 'checkbox' });
    headRow.appendChild(el('th', {}, headCheck));
    for (const col of columns) headRow.appendChild(el('th', {}, col.title));
    thead.appendChild(headRow);
    table.appendChild(thead);
    table.appendChild(tbody);

    const wrap = el('div', { class: 'pmm_table_wrap' }, table);

    const header = el(
      'div',
      { class: 'pmm_card_header' },
      el('div', { class: 'title' }, title),
      el('div', { class: 'pmm_toolbar' }, badge, input, reloadBtn, clearSelBtn, selectAllFilteredBtn)
    );

    const pager = el(
      'div',
      { class: 'pmm_pager' },
      pageSizeSel,
      prevBtn,
      nextBtn,
      pageInfo,
      el('div', { class: 'spacer' }),
      el('span', { class: 'pmm_dim' }, '勾选可跨页累计')
    );

    const card = el('div', { class: 'pmm_card' }, header, wrap, pager);

    function computeFiltered() {
      const q = state.query.trim().toLowerCase();
      if (!q) return state.data;
      return state.data.filter((item) => {
        for (const col of columns) {
          const v = item?.[col.key];
          if (v == null) continue;
          if (String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    function updateBadge(filteredCount) {
      badge.textContent = `${filteredCount} 条 / ${state.selected.size} 选中`;
    }

    function updateHeaderCheckbox() {
      const filtered = computeFiltered();
      const total = filtered.length;
      if (total === 0) {
        headCheck.indeterminate = false;
        headCheck.checked = false;
        return;
      }
      const start = (state.page - 1) * state.pageSize;
      const pageItems = filtered.slice(start, start + state.pageSize);
      const pageIds = pageItems.map((x) => toId(x?.__pmm_id)).filter(Boolean);
      const selectedCount = pageIds.filter((id) => state.selected.has(id)).length;
      headCheck.checked = selectedCount > 0 && selectedCount === pageIds.length;
      headCheck.indeterminate = selectedCount > 0 && selectedCount < pageIds.length;
    }

    function render() {
      const filtered = computeFiltered();
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / state.pageSize));
      state.page = Math.min(Math.max(1, state.page), pages);
      const start = (state.page - 1) * state.pageSize;
      const pageItems = filtered.slice(start, start + state.pageSize);

      tbody.textContent = '';
      for (const item of pageItems) {
        const id = toId(item?.__pmm_id);
        const checked = state.selected.has(id);
        const rowCheck = el('input', { type: 'checkbox' });
        rowCheck.checked = checked;
        rowCheck.addEventListener('change', () => {
          if (rowCheck.checked) state.selected.add(id);
          else state.selected.delete(id);
          updateHeaderCheckbox();
          updateBadge(filtered.length);
        });
        const tr = el('tr');
        tr.appendChild(el('td', {}, rowCheck));
        for (const col of columns) tr.appendChild(el('td', {}, String(item?.[col.key] ?? '')));
        tbody.appendChild(tr);
      }

      pageInfo.textContent = `第 ${state.page}/${pages} 页`;
      prevBtn.disabled = state.page <= 1;
      nextBtn.disabled = state.page >= pages;

      updateHeaderCheckbox();
      updateBadge(filtered.length);
    }

    function setData(items) {
      state.data = items;
      state.page = 1;
      render();
    }

    function setLoading(isLoading) {
      state.loading = isLoading;
      reloadBtn.disabled = isLoading;
      reloadBtn.textContent = isLoading ? '加载中…' : '刷新';
    }

    function getSelectedIds() {
      return Array.from(state.selected.values());
    }

    function clearSelection() {
      state.selected.clear();
      render();
    }

    function selectAllFiltered() {
      const filtered = computeFiltered();
      for (const item of filtered) {
        const id = toId(item?.__pmm_id);
        if (id) state.selected.add(id);
      }
      render();
    }

    input.addEventListener(
      'input',
      debounce(() => {
        state.query = input.value || '';
        state.page = 1;
        render();
      }, 200)
    );

    async function reload() {
      await onReload?.({ setData, setLoading, clearSelection });
    }

    reloadBtn.addEventListener('click', () => void reload());
    clearSelBtn.addEventListener('click', () => clearSelection());
    selectAllFilteredBtn.addEventListener('click', () => selectAllFiltered());

    prevBtn.addEventListener('click', () => {
      state.page -= 1;
      render();
    });
    nextBtn.addEventListener('click', () => {
      state.page += 1;
      render();
    });
    pageSizeSel.addEventListener('change', () => {
      state.pageSize = Number(pageSizeSel.value) || 20;
      state.page = 1;
      render();
    });

    headCheck.addEventListener('change', () => {
      const filtered = computeFiltered();
      const start = (state.page - 1) * state.pageSize;
      const pageItems = filtered.slice(start, start + state.pageSize);
      const pageIds = pageItems.map((x) => toId(x?.__pmm_id)).filter(Boolean);
      if (headCheck.checked) for (const id of pageIds) state.selected.add(id);
      else for (const id of pageIds) state.selected.delete(id);
      render();
    });

    return { el: card, reload, setData, setLoading, getSelectedIds, clearSelection };
  }
  function createModal() {
    const modal = el(
      'div',
      { id: DOM_IDS.modal },
      el(
        'div',
        { class: 'box' },
        el(
          'header',
          {},
          el('div', { class: 'title' }, '配置'),
          el('button', { class: 'pmm_btn', type: 'button', id: 'pmm_modal_close' }, '关闭')
        ),
        el('textarea', { id: 'pmm_modal_text' }),
        el(
          'footer',
          {},
          el('button', { class: 'pmm_btn', type: 'button', id: 'pmm_modal_reset' }, '恢复默认'),
          el('button', { class: 'pmm_btn primary', type: 'button', id: 'pmm_modal_save' }, '保存')
        )
      )
    );
    document.body.appendChild(modal);
    const textarea = modal.querySelector('#pmm_modal_text');
    const closeBtn = modal.querySelector('#pmm_modal_close');
    const saveBtn = modal.querySelector('#pmm_modal_save');
    const resetBtn = modal.querySelector('#pmm_modal_reset');

    function open(title, initialText, { onSave } = {}) {
      modal.style.display = 'flex';
      modal.querySelector('header .title').textContent = title || '配置';
      textarea.value = initialText || '';
      textarea.focus();
      saveBtn.onclick = () => onSave?.(textarea.value);
    }
    function close() {
      modal.style.display = 'none';
    }
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    return { open, close, resetBtn };
  }
  function normalizeList(raw, dataPath) {
    const data = getByPath(raw, dataPath);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.list)) return data.list;
    if (data && Array.isArray(data.records)) return data.records;
    return [];
  }

  async function loadList(config, endpoint, { type, fields }) {
    const headers = { ...(config.request?.headers || {}) };
    const method = (endpoint.method || 'GET').toUpperCase();
    const raw = await gmRequestJson({
      method,
      url: endpoint.url,
      headers,
      body: undefined,
      timeoutMs: config.request.timeoutMs,
    });
    const list = normalizeList(raw, endpoint.dataPath);
    const idKey = fields.id;
    return list.map((item) => {
      const id = toId(item?.[idKey]);
      const projected = { __pmm_type: type, __pmm_id: id };
      for (const key of Object.values(fields)) projected[key] = item?.[key];
      return projected;
    });
  }

  async function loadRoleItems(config, { roleId, kind }) {
    const ep = kind === 'permission' ? config.api.rolePermissions : config.api.rolePages;
    const url = substituteUrl(ep.url, { roleId });
    const method = (ep.method || 'GET').toUpperCase();
    const raw = await gmRequestJson({
      method,
      url,
      headers: { ...(config.request?.headers || {}) },
      body: undefined,
      timeoutMs: config.request.timeoutMs,
    });
    const list = normalizeList(raw, ep.dataPath);
    const fields = kind === 'permission' ? config.fields.permission : config.fields.page;
    const idKey = fields.id;
    return uniqueStrings(list.map((x) => (typeof x === 'object' ? x?.[idKey] : x)));
  }

  async function bindItemsToRoles(config, { roleIds, itemIds, kind, mode }, logger) {
    const ep = kind === 'permission' ? config.api.bindPermissions : config.api.bindPages;
    const url = ep.url;
    const method = (ep.method || 'POST').toUpperCase();
    const headers = { ...(config.request?.headers || {}) };

    if (!roleIds.length) throw new Error('未选择目标角色');
    if (!itemIds.length) throw new Error(`未选择${kind === 'permission' ? '权限点' : '页面'}`);

    async function callOne(payload) {
      return gmRequestJson({
        method,
        url,
        headers,
        body: JSON.stringify(payload),
        timeoutMs: config.request.timeoutMs,
      });
    }

    if (ep.bulk) {
      const payload = {
        [ep.roleIdsKey || 'roleIds']: roleIds,
        [ep.itemIdsKey || (kind === 'permission' ? 'permissionIds' : 'pageIds')]: itemIds,
        ...(ep.modeKey ? { [ep.modeKey]: mode } : {}),
      };
      logger?.info(`提交绑定：roles=${roleIds.length}, items=${itemIds.length}, mode=${mode}`);
      await callOne(payload);
      logger?.ok('绑定完成');
      return;
    }

    for (const roleId of roleIds) {
      const payload = {
        roleId,
        [ep.itemIdsKey || (kind === 'permission' ? 'permissionIds' : 'pageIds')]: itemIds,
        ...(ep.modeKey ? { [ep.modeKey]: mode } : {}),
      };
      logger?.info(`提交绑定：role=${roleId}, items=${itemIds.length}, mode=${mode}`);
      await callOne(payload);
    }
    logger?.ok('绑定完成');
  }
  function mount() {
    injectStyles();
    if (document.getElementById(DOM_IDS.button)) return;
    const config = getConfig();

    const btn = el('button', { id: DOM_IDS.button, type: 'button' }, config.ui?.title || '权限矩阵');
    const overlay = el('div', { id: DOM_IDS.overlay });
    const panel = el('div', { id: DOM_IDS.panel });
    overlay.appendChild(panel);

    const closeBtn = el('button', { class: 'pmm_btn', type: 'button' }, '关闭');
    const settingsBtn = el('button', { class: 'pmm_btn', type: 'button' }, '配置');
    const reloadAllBtn = el('button', { class: 'pmm_btn primary', type: 'button' }, '全部刷新');
    const header = el(
      'div',
      { id: 'pmm_header' },
      el('h2', {}, config.ui?.title || '权限矩阵维护'),
      el('span', { class: 'pmm_dim' }, '前端过滤 + 前端分页'),
      el('div', { class: 'spacer' }),
      reloadAllBtn,
      settingsBtn,
      closeBtn
    );

    const logEl = el('div', { id: 'pmm_log' });
    const logger = createLogger(logEl);

    const modeSel = el(
      'select',
      { class: 'pmm_select', title: '绑定方式' },
      el('option', { value: BIND_MODE.REPLACE }, '覆盖绑定(替换)'),
      el('option', { value: BIND_MODE.ADD }, '追加绑定(合并)')
    );
    modeSel.value = BIND_MODE.REPLACE;

    const actionMergePermBtn = el('button', { class: 'pmm_btn primary', type: 'button' }, '合并原角色权限点 → 绑定目标角色');
    const actionMergePageBtn = el('button', { class: 'pmm_btn primary', type: 'button' }, '合并原角色页面 → 绑定目标角色');
    const actionBindPermBtn = el('button', { class: 'pmm_btn', type: 'button' }, '绑定选中权限点 → 目标角色');
    const actionBindPageBtn = el('button', { class: 'pmm_btn', type: 'button' }, '绑定选中页面 → 目标角色');
    const clearLogBtn = el('button', { class: 'pmm_btn danger', type: 'button' }, '清空日志');

    const actions = el(
      'div',
      { id: 'pmm_actions' },
      el('span', { class: 'pmm_badge' }, '操作'),
      modeSel,
      actionMergePermBtn,
      actionMergePageBtn,
      actionBindPermBtn,
      actionBindPageBtn,
      clearLogBtn,
      logEl
    );

    const body = el('div', { id: 'pmm_body' });

    const roleCols = [
      { key: config.fields.role.code || 'code', title: 'Code' },
      { key: config.fields.role.name || 'name', title: '名称' },
      { key: config.fields.role.id || 'id', title: 'ID' },
    ];
    const permCols = [
      { key: config.fields.permission.code || 'code', title: 'Code' },
      { key: config.fields.permission.name || 'name', title: '名称' },
      { key: config.fields.permission.id || 'id', title: 'ID' },
    ];
      const pageCols = [
        { key: config.fields.page.path || 'path', title: 'Path' },
        { key: config.fields.page.name || 'name', title: '名称' },
        { key: config.fields.page.id || 'id', title: 'ID' },
      ];

      function createListCard({ title, columns, load, okText, errText }) {
        return createTableCard({
          title,
          columns,
          onReload: async ({ setData, setLoading, clearSelection }) => {
            const cfg = getConfig();
            setLoading(true);
            try {
              const list = await load(cfg);
              clearSelection();
              setData(list);
              logger.ok(`${okText}：${list.length} 条`);
            } catch (e) {
              logger.error(errText, e);
            } finally {
              setLoading(false);
            }
          },
        });
      }

      const loadRoles = (cfg) => loadList(cfg, cfg.api.roles, { type: 'role', fields: cfg.fields.role });
      const originalRolesCard = createListCard({
        title: '原角色清单（多选）',
        columns: roleCols,
        load: loadRoles,
        okText: '原角色加载完成',
        errText: '原角色加载失败',
      });

      const targetRolesCard = createListCard({
        title: '目标角色清单（多选）',
        columns: roleCols,
        load: loadRoles,
        okText: '目标角色加载完成',
        errText: '目标角色加载失败',
      });

      const permissionsCard = createListCard({
        title: '权限点清单（多选）',
        columns: permCols,
        load: (cfg) => loadList(cfg, cfg.api.permissions, { type: 'permission', fields: cfg.fields.permission }),
        okText: '权限点加载完成',
        errText: '权限点加载失败',
      });

      const pagesCard = createListCard({
        title: '页面清单（多选）',
        columns: pageCols,
        load: (cfg) => loadList(cfg, cfg.api.pages, { type: 'page', fields: cfg.fields.page }),
        okText: '页面加载完成',
        errText: '页面加载失败',
      });

    body.appendChild(originalRolesCard.el);
    body.appendChild(targetRolesCard.el);
    body.appendChild(permissionsCard.el);
    body.appendChild(pagesCard.el);
    body.appendChild(actions);

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(btn);
    document.body.appendChild(overlay);

    function openPanel() {
      overlay.style.display = 'block';
    }
    function closePanel() {
      overlay.style.display = 'none';
    }
    btn.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });

    const modal = createModal();
    modal.resetBtn.addEventListener('click', () => {
      modal.open('配置（JSON）', JSON.stringify(defaultConfig, null, 2), {
        onSave: (txt) => {
          try {
            const cfg = JSON.parse(txt);
            setConfig(cfg);
            modal.close();
            logger.ok('已恢复默认并保存配置（重新打开面板以生效字段列/接口）');
          } catch (e) {
            logger.error('配置JSON无效', e);
          }
        },
      });
    });

    settingsBtn.addEventListener('click', () => {
      const cfg = getConfig();
      modal.open('配置（JSON）', JSON.stringify(cfg, null, 2), {
        onSave: (txt) => {
          try {
            const next = JSON.parse(txt);
            setConfig(next);
            modal.close();
            logger.ok('配置已保存（重新打开面板以生效字段列/接口）');
          } catch (e) {
            logger.error('配置JSON无效', e);
          }
        },
      });
    });

    clearLogBtn.addEventListener('click', () => logger.clear());

    reloadAllBtn.addEventListener('click', () => {
      logger.info('开始全部刷新…');
      void originalRolesCard.reload();
      void targetRolesCard.reload();
      void permissionsCard.reload();
      void pagesCard.reload();
    });

    async function runAction(actionName, fn) {
      try {
        logger.info(`执行：${actionName}`);
        await fn();
        logger.ok(`完成：${actionName}`);
      } catch (e) {
        logger.error(`失败：${actionName}`, e);
      }
    }

    actionMergePermBtn.addEventListener('click', () =>
      runAction('合并原角色权限点 → 绑定目标角色', async () => {
        const cfg = getConfig();
        const mode = modeSel.value || BIND_MODE.REPLACE;
        const originalRoleIds = originalRolesCard.getSelectedIds();
        const targetRoleIds = targetRolesCard.getSelectedIds();
        if (!originalRoleIds.length) throw new Error('未选择原角色');
        if (!targetRoleIds.length) throw new Error('未选择目标角色');

        logger.info(`拉取原角色权限点：roles=${originalRoleIds.length}`);
        const all = new Set();
        for (const roleId of originalRoleIds) {
          const ids = await loadRoleItems(cfg, { roleId, kind: 'permission' });
          logger.info(`- role=${roleId} permissions=${ids.length}`);
          for (const id of ids) all.add(id);
        }
        const mergedIds = Array.from(all.values());
        logger.info(`合并结果：permissions=${mergedIds.length}`);
        await bindItemsToRoles(cfg, { roleIds: targetRoleIds, itemIds: mergedIds, kind: 'permission', mode }, logger);
      })
    );

    actionMergePageBtn.addEventListener('click', () =>
      runAction('合并原角色页面 → 绑定目标角色', async () => {
        const cfg = getConfig();
        const mode = modeSel.value || BIND_MODE.REPLACE;
        const originalRoleIds = originalRolesCard.getSelectedIds();
        const targetRoleIds = targetRolesCard.getSelectedIds();
        if (!originalRoleIds.length) throw new Error('未选择原角色');
        if (!targetRoleIds.length) throw new Error('未选择目标角色');

        logger.info(`拉取原角色页面：roles=${originalRoleIds.length}`);
        const all = new Set();
        for (const roleId of originalRoleIds) {
          const ids = await loadRoleItems(cfg, { roleId, kind: 'page' });
          logger.info(`- role=${roleId} pages=${ids.length}`);
          for (const id of ids) all.add(id);
        }
        const mergedIds = Array.from(all.values());
        logger.info(`合并结果：pages=${mergedIds.length}`);
        await bindItemsToRoles(cfg, { roleIds: targetRoleIds, itemIds: mergedIds, kind: 'page', mode }, logger);
      })
    );

    actionBindPermBtn.addEventListener('click', () =>
      runAction('绑定选中权限点 → 目标角色', async () => {
        const cfg = getConfig();
        const mode = modeSel.value || BIND_MODE.REPLACE;
        const targetRoleIds = targetRolesCard.getSelectedIds();
        const permissionIds = permissionsCard.getSelectedIds();
        await bindItemsToRoles(cfg, { roleIds: targetRoleIds, itemIds: permissionIds, kind: 'permission', mode }, logger);
      })
    );

    actionBindPageBtn.addEventListener('click', () =>
      runAction('绑定选中页面 → 目标角色', async () => {
        const cfg = getConfig();
        const mode = modeSel.value || BIND_MODE.REPLACE;
        const targetRoleIds = targetRolesCard.getSelectedIds();
        const pageIds = pagesCard.getSelectedIds();
        await bindItemsToRoles(cfg, { roleIds: targetRoleIds, itemIds: pageIds, kind: 'page', mode }, logger);
      })
    );

    GM_registerMenuCommand('权限矩阵维护：打开面板', () => openPanel());
    GM_registerMenuCommand('权限矩阵维护：编辑配置(JSON)', () => settingsBtn.click());

    logger.info('提示：先点“全部刷新”加载四张表；接口无分页时可在这里前端分页/过滤/多选。');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
