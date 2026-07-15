/* ═══ Downloads view (spec §3.4 — pause/resume, speed, ETA) ═══ */
window.Views = window.Views || {};

window.Views.downloads = {
  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    document.querySelector('main.content').style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';
    c.innerHTML = `
      <div class="view" style="padding:24px;">
        <h1>Загрузки</h1>
        <p style="color:var(--text-2);margin-bottom:16px;">Активные и ожидающие загрузки. Поддержка pause/resume/cancel.</p>
        <div id="dl-list" class="card" style="padding:0;overflow:hidden;"></div>
      </div>
    `;
    this.refresh();
    this._interval = setInterval(() => this.refresh(), 1000);
  },

  async refresh() {
    const el = document.getElementById('dl-list');
    if (!el) return;
    const r = await window.api.invoke('downloads:list');
    const items = [...r.active, ...r.queue];
    if (!items.length) {
      el.innerHTML = '<div class="empty-state">Нет активных загрузок</div>';
      return;
    }
    el.innerHTML = items.map(d => {
      const pct = d.total > 0 ? Math.min(100, (d.received / d.total) * 100) : 0;
      const speed = d.received && d.startedAt ? (d.received / ((Date.now() - d.startedAt) / 1000)) : 0;
      return `
        <div style="padding:12px 14px;border-bottom:1px solid var(--border-soft);">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;">${d.id}</div>
              <div style="font-size:11px;color:var(--text-2);">${d.path || ''}</div>
            </div>
            <div style="font-size:12px;color:var(--text-2);text-align:right;">
              ${d.received ? `${(d.received / 1048576).toFixed(1)} MB` : '—'} / ${d.total ? `${(d.total / 1048576).toFixed(1)} MB` : '?'}
              ${speed ? `<br>${(speed / 1048576).toFixed(2)} MB/s` : ''}
            </div>
          </div>
          <div class="progress"><div class="fill" style="width:${pct}%;"></div></div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn ghost" style="padding:4px 10px;font-size:11px;" data-pause="${d.id}">Пауза</button>
            <button class="btn outline" style="padding:4px 10px;font-size:11px;" data-cancel="${d.id}">Отмена</button>
          </div>
        </div>
      `;
    }).join('');
    el.querySelectorAll('[data-pause]').forEach(b => b.onclick = async () => {
      await window.api.invoke('downloads:pause', b.dataset.pause);
      this.refresh();
    });
    el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
      await window.api.invoke('downloads:cancel', b.dataset.cancel);
      this.refresh();
    });
  },

  destroy() {
    clearInterval(this._interval);
  }
};
