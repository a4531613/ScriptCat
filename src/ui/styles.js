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

