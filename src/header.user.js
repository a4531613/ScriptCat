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

