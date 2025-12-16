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

