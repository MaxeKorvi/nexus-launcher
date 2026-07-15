/* Modal dialog (spec §1.3 — Dialog Window + Blur Overlay) */

window.Modal = {
  open({ title, body, footer, onClose, size }) {
    const mount = document.getElementById('modal-mount');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    if (size === 'large') modal.style.maxWidth = '900px';
    if (size === 'small') modal.style.minWidth = '320px';
    modal.innerHTML = `
      <h2>${title}</h2>
      <div class="modal-body"></div>
      <div class="modal-footer"></div>
    `;
    modal.querySelector('.modal-body').appendChild(body);
    if (footer) modal.querySelector('.modal-footer').appendChild(footer);
    backdrop.appendChild(modal);
    mount.appendChild(backdrop);

    const close = () => {
      backdrop.style.animation = 'fadeIn 200ms reverse';
      setTimeout(() => backdrop.remove(), 200);
      if (onClose) onClose();
    };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    // Esc to close
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    return { close, modal };
  },
  confirm({ title, message, okText = 'OK', cancelText = 'Отмена', onOk }) {
    const body = document.createElement('div');
    body.innerHTML = `<p style="color:var(--text-2);font-size:14px;">${message}</p>`;
    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="btn ghost btn-cancel">${cancelText}</button>
      <button class="btn primary btn-ok">${okText}</button>
    `;
    const inst = this.open({ title, body, footer, size: 'small' });
    footer.querySelector('.btn-cancel').onclick = () => inst.close();
    footer.querySelector('.btn-ok').onclick = () => { inst.close(); if (onOk) onOk(); };
  }
};
