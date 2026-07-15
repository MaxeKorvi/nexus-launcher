/* ═══ Менеджер шейдеров view ═══ */
window.Views = window.Views || {};

(function () {
  function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function sourceLabel(source) {
    if (source === 'minecraft-inside') return 'Minecraft Inside';
    if (source === 'curseforge') return 'CurseForge';
    if (source === 'modrinth') return 'Modrinth';
    return source || '—';
  }
  function targetKey(v) { return v.rootDir || v.path || v.profileId || v.id; }
  function formatTarget(v) {
    const name = v.displayName || v.title || v.profileId || v.id;
    const mc = v.minecraft || v.id || '';
    const loader = v.loader && v.loader !== 'vanilla' ? ` · ${v.loader}${v.loaderVersion ? ' ' + v.loaderVersion : ''}` : ' · Vanilla';
    const kind = v.modpack ? ' · сборка' : '';
    return `${name}${mc && name !== mc ? ' · MC ' + mc : ''}${loader}${kind}`;
  }
  function isInstalled(installed, item) {
    return (installed || []).some(x => {
      if (x.source && item.source && String(x.source) === String(item.source) && x.id && item.id && String(x.id) === String(item.id)) return true;
      if (x.title && item.title && String(x.title).trim().toLowerCase() === String(item.title).trim().toLowerCase()) return true;
      return false;
    });
  }

  window.Views.shaders = {
    query: '',
    page: 0,
    sources: ['curseforge', 'modrinth', 'minecraft-inside'],
    preferSource: 'curseforge',
    mcVersion: '',
    loader: '',

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
      this.loader = target.loader && target.loader !== 'vanilla' ? target.loader : '';
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
          <h1>Менеджер шейдеров</h1>
          <p style="color:var(--text-2);margin-bottom:16px;">Шейдер ставится строго в <b>shaderpacks/ выбранной установленной версии</b>. Выберите версию, каталог и файл попадёт туда.</p>
          <div class="search-bar" style="display:grid;grid-template-columns:1.2fr 1.35fr 0.75fr 0.9fr auto;gap:10px;align-items:center;">
            <input class="input" id="sh-search" placeholder="Поиск шейдера…" value="${esc(this.query)}">
            <select class="input" id="sh-target">
              ${targets.length ? targets.map(v => `<option value="${esc(targetKey(v))}" ${current && targetKey(v) === targetKey(current) ? 'selected' : ''}>${esc(formatTarget(v))}</option>`).join('') : '<option value="">Нет установленных версий</option>'}
            </select>
            <input class="input" id="sh-version" placeholder="Версия Minecraft" value="${esc(this.mcVersion)}" readonly>
            <select class="input" id="sh-prefer">
              <option value="curseforge" ${this.preferSource === 'curseforge' ? 'selected' : ''}>Приоритет: CurseForge</option>
              <option value="modrinth" ${this.preferSource === 'modrinth' ? 'selected' : ''}>Приоритет: Modrinth</option>
              <option value="minecraft-inside" ${this.preferSource === 'minecraft-inside' ? 'selected' : ''}>Приоритет: Minecraft Inside</option>
            </select>
            <button class="btn ghost" id="sh-installed">Установленные</button>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0 16px;">
            ${['curseforge','modrinth','minecraft-inside'].map(src => `<label class="pill-mini" style="display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;"><input type="checkbox" data-sh-src="${src}" ${this.sources.includes(src) ? 'checked' : ''}><span>${sourceLabel(src)}</span></label>`).join('')}
          </div>
          ${targets.length ? '' : '<div class="empty-state" style="margin:12px 0;">Сначала установите Minecraft во вкладке «Версии». После этого появится выбор, куда ставить.</div>'}
          <div id="sh-context" style="margin:10px 0 18px;color:var(--text-2);font-size:12px;"></div>
          <div id="sh-list" class="card grid" style="grid-template-columns:1fr;"></div>
          <div style="display:flex;justify-content:center;margin-top:12px;gap:8px;">
            <button class="btn ghost" id="sh-prev" style="${this.page > 0 ? '' : 'display:none;'}">← Назад</button>
            <span id="sh-page" style="padding:8px 14px;">Стр. ${this.page + 1}</span>
            <button class="btn ghost" id="sh-next">Вперёд →</button>
          </div>
        </div>`;

      let timer = null;
      document.getElementById('sh-search').oninput = (e) => {
        this.query = e.target.value;
        clearTimeout(timer);
        timer = setTimeout(() => { this.page = 0; this.search(); }, 350);
      };
      document.getElementById('sh-search').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(timer); this.query = e.target.value; this.page = 0; this.search(); } };
      document.getElementById('sh-target').onchange = (e) => {
        const target = this.targets().find(v => targetKey(v) === e.target.value);
        if (target) this.applyTarget(target, true);
        this.page = 0;
        this.render();
      };
      document.getElementById('sh-prefer').onchange = (e) => { this.preferSource = e.target.value; this.page = 0; this.search(); };
      document.querySelectorAll('[data-sh-src]').forEach(x => x.onchange = () => {
        this.sources = Array.from(document.querySelectorAll('[data-sh-src]:checked')).map(y => y.dataset.shSrc || y.getAttribute('data-sh-src'));
        if (!this.sources.length) this.sources = ['modrinth'];
        this.page = 0;
        this.search();
      });
      document.getElementById('sh-installed').onclick = () => this.showInstalled();
      document.getElementById('sh-prev').onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
      document.getElementById('sh-next').onclick = () => { this.page++; this.search(); };
      this.updateContext();
      this.search();
    },

    updateContext() {
      const el = document.getElementById('sh-context');
      if (!el) return;
      const target = this.currentTarget();
      if (!target) {
        el.textContent = 'Установка отключена: нет установленной версии Minecraft.';
        return;
      }
      const rootDir = target.rootDir || target.path;
      el.textContent = `Каталог ограничен выбранной версией Minecraft: ${this.mcVersion || '—'}. Установка пойдёт сюда: ${rootDir}/shaderpacks`;
    },

    async search() {
      this.updateContext();
      const list = document.getElementById('sh-list');
      list.innerHTML = '<div class="empty-state"><span class="spinner"></span> Загрузка…</div>';
      try {
        const r = await window.api.invoke('shaders:list', {
          query: this.query,
          sources: this.sources,
          preferSource: this.preferSource,
          mcVersion: this.mcVersion,
          loader: this.loader,
          page: this.page,
          pageSize: 60
        });
        const pageEl = document.getElementById('sh-page');
        if (pageEl) pageEl.textContent = `Стр. ${this.page + 1}`;
        const prevBtn = document.getElementById('sh-prev');
        if (prevBtn) prevBtn.style.display = this.page > 0 ? '' : 'none';
        if (!r.hits.length) { list.innerHTML = `<div class="empty-state">Ничего не найдено${r.errors && r.errors.length ? `<br><small>${esc(r.errors.join(' · '))}</small>` : ''}</div>`; return; }
        const target = this.currentTarget();
        const rootDir = target && (target.rootDir || target.path);
        const installed = rootDir ? await window.api.invoke('shaders:list-installed', rootDir) : [];
        const hasTarget = Boolean(rootDir);
        list.innerHTML = r.hits.map((item, idx) => {
          const already = isInstalled(installed, item);
          return `
          <div class="mod-card">
            <div class="icon" style="${item.icon ? `background-image:url('${item.icon}')` : 'background:var(--bg-2);'}"></div>
            <div class="info">
              <h3>${esc(item.title)}</h3>
              <div class="author">${esc(item.author || '—')} · ${sourceLabel(item.source)}</div>
              <div class="desc">${esc(item.description || '')}</div>
              <div class="stats">
                ${item.downloads ? `<span>⬇ ${Number(item.downloads).toLocaleString('ru-RU')}</span>` : ''}
                ${item.mcVersions && item.mcVersions.length ? `<span>Версии: ${esc(item.mcVersions.slice(0,4).join(', '))}</span>` : ''}
                ${already ? '<span style="color:var(--ok);">✓ Установлено</span>' : ''}
              </div>
            </div>
            <div class="actions">
              <button class="btn ${already ? 'ghost' : 'primary'}" style="padding:6px 14px;font-size:12px;" data-install="${idx}" ${hasTarget && !already ? '' : 'disabled'}>${already ? 'Установлено' : 'Установить'}</button>
              ${item.url ? `<a href="${item.url}" class="btn ghost" style="padding:6px 14px;font-size:12px;text-decoration:none;" data-external>Подробнее</a>` : ''}
            </div>
          </div>`;
        }).join('');
        list.querySelectorAll('[data-install]').forEach(b => b.onclick = async () => {
          const item = r.hits[Number(b.dataset.install)];
          const target = this.currentTarget();
          if (!target) { Toast.error('Нет версии', 'Сначала установите и выберите версию Minecraft.'); return; }
          const rootDir = target.rootDir || target.path;
          try {
            await window.api.invoke('shaders:install', {
              ...item,
              rootDir,
              gameDir: rootDir,
              mcVersion: target.minecraft || target.id || this.mcVersion,
              loader: target.loader && target.loader !== 'vanilla' ? target.loader : ''
            });
            Toast.success('Шейдер установлен', `${rootDir}/shaderpacks`);
            this.search();
          } catch (e) { Toast.error('Ошибка', e.message); }
        });
        list.querySelectorAll('[data-external]').forEach(a => a.onclick = (e) => { e.preventDefault(); window.api.shell.openExternal(a.href); });
      } catch (e) { list.innerHTML = `<div class="empty-state">Ошибка: ${esc(e.message)}</div>`; }
    },

    async showInstalled() {
      const target = this.currentTarget();
      const el = document.getElementById('sh-list');
      if (!target) { el.innerHTML = '<div class="empty-state">Нет выбранной установленной версии</div>'; return; }
      const rootDir = target.rootDir || target.path;
      const list = await window.api.invoke('shaders:list-installed', rootDir);
      if (!list.length) { el.innerHTML = `<div class="empty-state">Нет установленных файлов в ${esc(rootDir)}/shaderpacks</div>`; return; }
      el.innerHTML = list.map(x => `<div class="mod-card"><div class="icon"></div><div class="info"><h3>${esc(x.title || x.fileName)}</h3><div class="author">${esc(x.source || '')}</div><div class="desc">${esc(x.path || '')}</div></div></div>`).join('');
    },

    destroy() {}
  };
})();
