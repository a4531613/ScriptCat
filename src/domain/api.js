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

