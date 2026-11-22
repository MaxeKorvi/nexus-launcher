/* Toast notifications (spec §1.3 — Notification component) */

window.Toast = {
  show({ title, message, type = 'info', duration = 2400 }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Remove older toasts if there are already 2 or more to prevent screen spam
    while (container.children.length >= 2) {
      const oldest = container.firstElementChild;
      if (oldest) oldest.remove();
    }

    // Dismiss existing toast with same title to prevent stacking duplicate spam
    const existing = Array.from(container.children).find(c => {
      const t = c.querySelector('.toast-title');
      return t && t.textContent === title;
    });
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 220);
    }, duration);
  },
  dismissAll() {
    const container = document.getElementById('toast-container');
    if (container) container.innerHTML = '';
  },
  success(title, message) { this.show({ title, message, type: 'success' }); },
  error(title, message) { this.show({ title, message, type: 'error', duration: 4500 }); },
  info(title, message) { this.show({ title, message, type: 'info' }); }
};
