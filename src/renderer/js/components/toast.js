/* Toast notifications (spec §1.3 — Notification component) */

window.Toast = {
  show({ title, message, type = 'info', duration = 3000 }) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 280);
    }, duration);
  },
  success(title, message) { this.show({ title, message, type: 'success' }); },
  error(title, message) { this.show({ title, message, type: 'error', duration: 5000 }); },
  info(title, message) { this.show({ title, message, type: 'info' }); }
};
