/* ═══ Console view (spec §3 — console with highlighting, filters) ═══ */
window.Views = window.Views || {};

window.Views.console = {
  filter: 'all',
  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    document.querySelector('main.content').style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';
    c.innerHTML = `
      <div class="view" style="padding:24px;display:flex;flex-direction:column;height:calc(100vh - 90px);">
        <h1>Консоль лаунчера</h1>
        <p style="color:var(--text-2);margin-bottom:12px;">Логи запуска Minecraft и операции лаунчера. Ошибки — красным, успех — зелёным.</p>
        <div class="search-bar" style="display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap: wrap;">
          <input type="text" id="c-search" placeholder="Поиск в консоли..." style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-soft); background:rgba(255,255,255,0.03); color:#fff; width:220px; font-size:12px;">
          <button class="btn ghost btn-filter primary" data-f="all">Все</button>
          <button class="btn ghost btn-filter" data-f="info">Info</button>
          <button class="btn ghost btn-filter" data-f="error">Ошибки</button>
          <button class="btn ghost btn-filter" data-f="success">Успех</button>
          <button class="btn outline" id="c-clear" style="margin-left:auto;">Очистить</button>
          <button class="btn outline" id="c-copy">Копировать</button>
          <button class="btn outline" id="c-open">Открыть файл</button>
        </div>
        <div id="c-output" class="console" style="flex:1; overflow-y:auto; font-family: monospace; background:#020202; border:1px solid var(--border-soft); border-radius:8px; padding:12px; font-size:12px; line-height:1.6;"></div>
      </div>
    `;

    const searchInput = document.getElementById('c-search');
    if (searchInput) {
      searchInput.oninput = () => this.renderLines();
    }

    document.querySelectorAll('.btn-filter').forEach(b => {
      b.onclick = () => {
        this.filter = b.dataset.f;
        document.querySelectorAll('.btn-filter').forEach(x => x.classList.remove('primary'));
        b.classList.add('primary');
        this.renderLines();
      };
    });

    document.getElementById('c-clear').onclick = () => { Store.set('consoleLines', []); this.renderLines(); };
    
    document.getElementById('c-copy').onclick = async () => {
      const txt = Store.get('consoleLines').map(l => l.text).join('\n');
      try {
        await navigator.clipboard.writeText(txt);
        Toast.success('Скопировано в буфер обмена');
      } catch (err) {
        Toast.error('Не удалось скопировать лог');
      }
    };
    
    document.getElementById('c-open').onclick = () => window.api.invoke('settings:open-logs');

    this._unsub = window.api.on('launcher:console', (line) => {
      const lines = Store.get('consoleLines') || [];
      let type = 'info';
      if (/error|exception|fail/i.test(line)) type = 'error';
      else if (/success|complete|done/i.test(line)) type = 'success';
      lines.push({ text: line, type });
      if (lines.length > 2000) lines.shift();
      Store.set('consoleLines', lines);
      this.appendLine({ text: line, type });
    });

    this.renderLines();
  },

  appendLine({ text, type }) {
    const el = document.getElementById('c-output');
    if (!el) return;
    if (this.filter !== 'all' && this.filter !== type) return;
    
    const q = (document.getElementById('c-search')?.value || '').toLowerCase().trim();
    if (q && !text.toLowerCase().includes(q)) return;

    const div = document.createElement('div');
    div.className = `line ${type}`;
    div.textContent = text;
    
    // Quick inline styling for error/success colors in console output
    if (type === 'error') {
      div.style.color = 'var(--error)';
    } else if (type === 'success') {
      div.style.color = 'var(--success)';
    } else {
      div.style.color = '#dfdfdf';
    }

    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  renderLines() {
    const el = document.getElementById('c-output');
    if (!el) return;
    el.innerHTML = '';
    
    const q = (document.getElementById('c-search')?.value || '').toLowerCase().trim();
    const rawLines = Store.get('consoleLines') || [];
    
    const lines = rawLines.filter(l => {
      const matchFilter = this.filter === 'all' || l.type === this.filter;
      const matchQuery = !q || l.text.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });

    for (const l of lines.slice(-500)) {
      const div = document.createElement('div');
      div.className = `line ${l.type}`;
      div.textContent = l.text;
      
      if (l.type === 'error') {
        div.style.color = 'var(--error)';
      } else if (l.type === 'success') {
        div.style.color = 'var(--success)';
      } else {
        div.style.color = '#dfdfdf';
      }
      
      el.appendChild(div);
    }
    el.scrollTop = el.scrollHeight;
  },

  destroy() {
    if (this._unsub) this._unsub();
  }
};
