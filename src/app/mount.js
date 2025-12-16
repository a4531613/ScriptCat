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

