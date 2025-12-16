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

