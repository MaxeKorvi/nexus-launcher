/* Modal dialog (spec §1.3 — Dialog Window + Blur Overlay) */

window.Modal = {
  _currentInstance: null,

  open({ title = '', body, footer, onClose, size }) {
    const mount = document.getElementById('modal-mount') || document.body;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    if (size === 'large') modal.style.maxWidth = '920px';
    if (size === 'small') modal.style.minWidth = '340px';

    modal.innerHTML = `
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <h2 style="margin:0;font-size:18px;font-weight:800;color:var(--text);">${title}</h2>
        <button class="modal-close-btn" style="background:none;border:none;color:var(--text-2);font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1;transition:all 150ms;display:flex;align-items:center;justify-content:center;" title="Закрыть (Esc)">✕</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;max-height:75vh;"></div>
      <div class="modal-footer" style="margin-top:16px;"></div>
    `;

    const bodyEl = modal.querySelector('.modal-body');
    if (body) {
      if (typeof body === 'string') {
        bodyEl.innerHTML = body;
      } else if (body instanceof Node) {
        bodyEl.appendChild(body);
      }
    }

    const footerEl = modal.querySelector('.modal-footer');
    if (footer) {
      if (typeof footer === 'string') {
        footerEl.innerHTML = footer;
      } else if (footer instanceof Node) {
        footerEl.appendChild(footer);
      }
    } else {
      footerEl.style.display = 'none';
    }

    backdrop.appendChild(modal);
    mount.appendChild(backdrop);

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.onmouseenter = () => { closeBtn.style.color = 'var(--accent-hi)'; closeBtn.style.background = 'rgba(255,255,255,0.06)'; };
      closeBtn.onmouseleave = () => { closeBtn.style.color = 'var(--text-2)'; closeBtn.style.background = 'none'; };
      closeBtn.onclick = () => close();
    }

    const close = () => {
      backdrop.style.animation = 'fadeIn 200ms reverse';
      setTimeout(() => backdrop.remove(), 200);
      document.removeEventListener('keydown', escHandler);
      if (this._currentInstance && this._currentInstance.modal === modal) {
        this._currentInstance = null;
      }
      if (onClose) onClose();
    };

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', escHandler);

    const instance = { close, modal };
    this._currentInstance = instance;
    return instance;
  },

  close() {
    if (this._currentInstance) {
      this._currentInstance.close();
    } else {
      const b = document.querySelector('.modal-backdrop');
      if (b) b.remove();
    }
  },

  confirm({ title, message, okText = 'OK', cancelText = 'Отмена', onOk }) {
    const body = document.createElement('div');
    body.innerHTML = `<p style="color:var(--text-2);font-size:14px;line-height:1.5;margin:0;">${message}</p>`;
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '8px';
    footer.innerHTML = `
      <button class="btn ghost btn-cancel">${cancelText}</button>
      <button class="btn primary btn-ok">${okText}</button>
    `;
    const inst = this.open({ title, body, footer, size: 'small' });
    footer.querySelector('.btn-cancel').onclick = () => inst.close();
    footer.querySelector('.btn-ok').onclick = () => { inst.close(); if (onOk) onOk(); };
  }
};
