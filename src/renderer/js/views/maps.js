/* ═══ Maps view ═══ */
window.Views = window.Views || {};

(function () {
  function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function targetKey(v) {
    return v.rootDir || v.path || v.profileId || v.id;
  }

  function formatTarget(v) {
    const name = v.displayName || v.title || v.profileId || v.id;
    const mc = v.minecraft || v.id || '';
    const kind = v.modpack ? ' · сборка' : '';
    return `${name}${mc && name !== mc ? ' · MC ' + mc : ''}${kind}`;
  }

  function isInstalled(installed, item) {
    return (installed || []).some(x => {
      if (x.source && item.source && String(x.source) === String(item.source) && x.id && item.id && String(x.id) === String(item.id)) return true;
      if (x.title && item.title && String(x.title).trim().toLowerCase() === String(item.title).trim().toLowerCase()) return true;
      return false;
    });
  }

  window.Views.maps = {
    query: '',
    mcVersion: '',
    page: 0,

    async refreshInstalled() {
      try { Store.set('installedVersions', await window.api.invoke('versions:get-installed')); } catch {}
      const targets = this.targets();
      const savedPath = Store.get('selectedInstallPath');
      const savedVersion = Store.get('selectedVersion');
      const current = targets.find(v => v.rootDir === savedPath || v.path === savedPath || v.id === savedVersion || v.profileId === savedVersion) || targets[0] || null;
      if (current) this.applyTarget(current, false);
      return targets;
    },

    targets() {
      return (Store.get('installedVersions') || []).filter(v => (v.rootDir || v.path) && (v.minecraft || v.id || v.profileId));
    },

    currentTarget() {
      const targets = this.targets();
      const savedPath = Store.get('selectedInstallPath');
      const savedVersion = Store.get('selectedVersion');
      return targets.find(v => v.rootDir === savedPath || v.path === savedPath || v.id === savedVersion || v.profileId === savedVersion) || targets[0] || null;
    },

    applyTarget(target, persist = true) {
      if (!target) return;
      const rootDir = target.rootDir || target.path;
      this.mcVersion = target.minecraft || target.id || '';
      if (persist) {
        Store.set('selectedInstallPath', rootDir);
        Store.set('selectedVersion', target.profileId || target.id);
        const bottom = document.getElementById('bottom-version');
        if (bottom) bottom.textContent = target.displayName || target.profileId || target.id;
      }
    },

    async render() {
      await this.refreshInstalled();
      const targets = this.targets();
      const current = this.currentTarget();

      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      const c = document.getElementById('library-view-content') || document.getElementById('view-container');
      if (c === document.getElementById('view-container')) {
        c.style.display = 'block';
      }
      c.innerHTML = `
        <div class="view" style="padding:24px;">
          <h1>Карты</h1>
          <p style="color:var(--text-2);margin-bottom:16px;">Карта ставится строго в <b>saves/ выбранной установленной версии</b>. Каталог берётся с Minecraft Inside.</p>
          <div class="search-bar" style="display:grid;grid-template-columns:1.4fr 1.4fr 0.8fr auto;gap:10px;align-items:center;">
            <input class="input" id="maps-search" placeholder="Поиск карты…" value="${esc(this.query)}">
            <select class="input" id="maps-target">
              ${targets.length ? targets.map(v => `<option value="${esc(targetKey(v))}" ${current && targetKey(v) === targetKey(current) ? 'selected' : ''}>${esc(formatTarget(v))}</option>`).join('') : '<option value="">Нет установленных версий</option>'}
            </select>
            <input class="input" id="maps-version" placeholder="Версия Minecraft" value="${esc(this.mcVersion)}" readonly>
            <button class="btn ghost" id="maps-installed">Локальные карты</button>
          </div>
          ${targets.length ? '' : '<div class="empty-state" style="margin-top:12px;">Сначала установите Minecraft во вкладке «Версии». Тогда карты будут ставиться в saves выбранной установки.</div>'}
          <div id="maps-context" style="margin:10px 0 0;color:var(--text-2);font-size:12px;"></div>
          <div id="maps-list" class="card grid" style="grid-template-columns:1fr;margin-top:16px;"></div>
          <div style="display:flex;justify-content:center;margin-top:12px;gap:8px;">
            <button class="btn ghost" id="maps-prev" style="${this.page > 0 ? '' : 'display:none;'}">← Назад</button>
            <span id="maps-page" style="padding:8px 14px;">Стр. ${this.page + 1}</span>
            <button class="btn ghost" id="maps-next">Вперёд →</button>
          </div>
        </div>
      `;
      let mapsSearchTimer = null;
      document.getElementById('maps-search').oninput = (e) => {
        this.query = e.target.value;
        clearTimeout(mapsSearchTimer);
        mapsSearchTimer = setTimeout(() => { this.page = 0; this.search(); }, 350);
      };
      document.getElementById('maps-search').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(mapsSearchTimer); this.query = e.target.value; this.page = 0; this.search(); } };
      document.getElementById('maps-target').onchange = (e) => {
        const target = this.targets().find(v => targetKey(v) === e.target.value);
        if (target) this.applyTarget(target, true);
        this.render();
      };
      document.getElementById('maps-installed').onclick = () => this.showInstalled();
      document.getElementById('maps-prev').onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
      document.getElementById('maps-next').onclick = () => { this.page++; this.search(); };
      this.updateContext();
      this.search();
    },

    updateContext() {
      const el = document.getElementById('maps-context');
      if (!el) return;
      const target = this.currentTarget();
      if (!target) {
        el.textContent = 'Установка карт отключена: нет установленной версии Minecraft.';
        return;
      }
      const rootDir = target.rootDir || target.path;
      el.textContent = `Каталог ограничен выбранной версией Minecraft: ${this.mcVersion || '—'}. Установка пойдёт сюда: ${rootDir}/saves`;
    },

    async search() {
      this.updateContext();
      const list = document.getElementById('maps-list');
      list.innerHTML = '<div class="empty-state"><span class="spinner"></span> Загрузка…</div>';
      try {
        const r = await window.api.invoke('maps:list', { query: this.query, mcVersion: this.mcVersion, page: this.page, pageSize: 60 });
        const pageEl = document.getElementById('maps-page');
        if (pageEl) pageEl.textContent = `Стр. ${this.page + 1}`;
        const prevBtn = document.getElementById('maps-prev');
        if (prevBtn) prevBtn.style.display = this.page > 0 ? '' : 'none';
        if (!r.hits.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуйте убрать версию или ввести другой запрос.</div>'; return; }
        const currentTarget = this.currentTarget();
        const hasTarget = Boolean(currentTarget);
        const rootDir = currentTarget && (currentTarget.rootDir || currentTarget.path);
        const installed = rootDir ? await window.api.invoke('maps:list-installed', rootDir) : [];
        list.innerHTML = r.hits.map((m, idx) => {
          const already = isInstalled(installed, m);
          return `
          <div class="mod-card">
            <div class="icon" style="${m.icon ? `background-image:url('${m.icon}')` : 'background:var(--bg-2);'}"></div>
            <div class="info">
              <h3>${esc(m.title)}</h3>
              <div class="author">${esc(m.author || 'Minecraft Inside')}</div>
              <div class="desc">${esc(m.description || '')}</div>
              <div class="stats">${m.mcVersions && m.mcVersions.length ? `<span>Версии: ${esc(m.mcVersions.slice(0,4).join(', '))}</span>` : ''}${already ? '<span style="color:var(--ok);">✓ Установлено</span>' : ''}</div>
            </div>
            <div class="actions">
              <button class="btn ${already ? 'ghost' : 'primary'}" style="padding:6px 14px;font-size:12px;" data-install="${idx}" ${hasTarget && !already ? '' : 'disabled'}>${already ? 'Установлено' : 'Скачать в выбранную версию'}</button>
              ${m.url ? `<a href="${m.url}" class="btn ghost" style="padding:6px 14px;font-size:12px;text-decoration:none;" data-external>Подробнее</a>` : ''}
            </div>
          </div>
        `;
        }).join('');
        list.querySelectorAll('[data-install]').forEach(b => b.onclick = async () => {
          const item = r.hits[Number(b.dataset.install)];
          const target = this.currentTarget();
          if (!target) { Toast.error('Нет версии', 'Сначала установите и выберите версию Minecraft.'); return; }
          const rootDir = target.rootDir || target.path;
          try {
            const result = await window.api.invoke('maps:install', { ...item, rootDir, gameDir: rootDir, mcVersion: target.minecraft || target.id || this.mcVersion });
            Toast.success('Карта скачана', result && result.path ? result.path : `${rootDir}/saves`); this.search();
          } catch (e) { Toast.error('Ошибка', e.message); }
        });
        list.querySelectorAll('[data-external]').forEach(a => a.onclick = (e) => { e.preventDefault(); window.api.shell.openExternal(a.href); });
      } catch (e) { list.innerHTML = `<div class="empty-state">Ошибка: ${esc(e.message)}</div>`; }
    },

    async showInstalled() {
      const target = this.currentTarget();
      const el = document.getElementById('maps-list');
      if (!target) { el.innerHTML = '<div class="empty-state">Нет выбранной установленной версии</div>'; return; }
      const rootDir = target.rootDir || target.path;
      const list = await window.api.invoke('maps:list-installed', rootDir);
      if (!list.length) { el.innerHTML = `<div class="empty-state">Нет локальных карт в ${esc(rootDir)}/saves</div>`; return; }
      el.innerHTML = list.map(x => `<div class="mod-card"><div class="icon"></div><div class="info"><h3>${esc(x.fileName)}</h3><div class="desc">${esc(x.path)}</div></div></div>`).join('');
    },

    destroy() {}
  };
})();
