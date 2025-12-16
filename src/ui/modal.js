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

