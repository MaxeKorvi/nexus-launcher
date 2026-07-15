/* ═══ Modpacks view ═══ */
window.Views = window.Views || {};

(function () {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sourceLabel(source) {
    if (source === 'minecraft-inside') return 'Minecraft Inside';
    if (source === 'curseforge') return 'CurseForge';
    if (source === 'modrinth') return 'Modrinth';
    return source || '—';
  }

  function formatSize(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '';
    if (n > 1024 * 1024) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1024).toFixed(1)} KB`;
  }

  function versionTitle(v) {
    const mc = v.mcVersions && v.mcVersions.length ? ` · MC ${v.mcVersions.slice(0, 3).join(', ')}` : '';
    const loaders = v.loaders && v.loaders.length ? ` · ${v.loaders.slice(0, 3).join(', ')}` : '';
    const type = v.versionType ? ` · ${v.versionType}` : '';
    const file = v.fileName ? ` · ${v.fileName}` : '';
    return `${v.title || v.versionNumber || v.id}${mc}${loaders}${type}${file}`;
  }

  function isPackInstalled(installed, pack) {
    return (installed || []).some(x => {
      if (x.catalogSource && pack.source && String(x.catalogSource) === String(pack.source) && x.catalogId && pack.id && String(x.catalogId) === String(pack.id)) return true;
      if (x.catalogSlug && pack.slug && String(x.catalogSlug) === String(pack.slug)) return true;
      if ((x.catalogTitle || x.name) && pack.title && String(x.catalogTitle || x.name).trim().toLowerCase() === String(pack.title).trim().toLowerCase()) return true;
      return false;
    });
  }

  window.Views.modpacks = {
    query: '',
    page: 0,
    sources: ['curseforge', 'modrinth', 'minecraft-inside'],
    preferSource: 'curseforge',
    mcVersion: '',
    loader: '',

    async ensureInstalled() {
      if (!Store.get('installedVersions') || !Store.get('installedVersions').length) {
        try { Store.set('installedVersions', await window.api.invoke('versions:get-installed')); } catch {}
      }
      const selectedId = Store.get('selectedVersion');
      const installed = Store.get('installedVersions') || [];
      const current = installed.find(v => v.id === selectedId || v.profileId === selectedId);
      if (current) {
        this.mcVersion = current.minecraft || current.id || this.mcVersion;
        this.loader = (current.loader && current.loader !== 'vanilla') ? current.loader : '';
      }
    },

    async render() {
      await this.ensureInstalled();
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      const c = document.getElementById('library-view-content') || document.getElementById('view-container');
      if (c === document.getElementById('view-container')) {
        c.style.display = 'block';
      }
      c.innerHTML = `
        <div class="view" style="padding:24px;">
          <h1>Менеджер сборок</h1>
          <p style="color:var(--text-2);margin-bottom:16px;">Нажмите на сборку в каталоге, чтобы открыть описание, фото и выбрать конкретную версию сборки.</p>

          <div class="search-bar" style="display:grid;grid-template-columns:1.4fr 0.8fr 0.8fr 0.9fr auto auto auto;gap:10px;align-items:center;">
            <input class="input" id="mp-search" placeholder="Поиск сборки…" value="${esc(this.query)}">
            <input class="input" id="mp-version" placeholder="Версия Minecraft" value="${esc(this.mcVersion)}">
            <select class="input" id="mp-loader">
              <option value="" ${!this.loader ? 'selected' : ''}>Любой загрузчик</option>
              <option value="forge" ${this.loader === 'forge' ? 'selected' : ''}>Forge</option>
              <option value="fabric" ${this.loader === 'fabric' ? 'selected' : ''}>Fabric</option>
              <option value="quilt" ${this.loader === 'quilt' ? 'selected' : ''}>Quilt</option>
              <option value="neoforge" ${this.loader === 'neoforge' ? 'selected' : ''}>NeoForge</option>
            </select>
            <select class="input" id="mp-prefer">
              <option value="curseforge" ${this.preferSource === 'curseforge' ? 'selected' : ''}>Приоритет: CurseForge</option>
              <option value="modrinth" ${this.preferSource === 'modrinth' ? 'selected' : ''}>Приоритет: Modrinth</option>
              <option value="minecraft-inside" ${this.preferSource === 'minecraft-inside' ? 'selected' : ''}>Приоритет: Minecraft Inside</option>
            </select>
            <button class="btn outline" id="mp-import">Импорт ZIP</button>
            <button class="btn outline" id="mp-export">Экспорт</button>
            <button class="btn ghost" id="mp-local">Локальные</button>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0 16px;">
            <span style="color:var(--text-2);font-size:12px;">Источники:</span>
            ${['curseforge', 'modrinth', 'minecraft-inside'].map(src => `
              <label class="pill-mini" style="display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;">
                <input type="checkbox" data-source="${src}" ${this.sources.includes(src) ? 'checked' : ''}>
                <span>${sourceLabel(src)}</span>
              </label>`).join('')}
          </div>

          <h2>Каталог сборок</h2>
          <div id="mp-list" class="card grid" style="grid-template-columns:1fr;"></div>
          <div style="display:flex;justify-content:center;margin-top:12px;gap:8px;">
            <button class="btn ghost" id="mp-prev" style="${this.page > 0 ? '' : 'display:none;'}">← Назад</button>
            <button class="btn ghost" id="mp-next">Вперёд →</button>
          </div>
        </div>
      `;

      let mpSearchTimer = null;
      document.getElementById('mp-search').oninput = (e) => {
        this.query = e.target.value;
        clearTimeout(mpSearchTimer);
        mpSearchTimer = setTimeout(() => { this.page = 0; this.search(); }, 350);
      };
      document.getElementById('mp-search').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(mpSearchTimer); this.query = e.target.value; this.page = 0; this.search(); } };
      document.getElementById('mp-version').onchange = (e) => { this.mcVersion = e.target.value.trim(); this.page = 0; this.search(); };
      document.getElementById('mp-loader').onchange = (e) => { this.loader = e.target.value; this.page = 0; this.search(); };
      document.getElementById('mp-prefer').onchange = (e) => { this.preferSource = e.target.value; this.page = 0; this.search(); };
      document.querySelectorAll('[data-source]').forEach(el => el.onchange = () => {
        this.sources = Array.from(document.querySelectorAll('[data-source]:checked')).map(x => x.dataset.source);
        if (!this.sources.length) this.sources = ['curseforge'];
        this.page = 0;
        this.search();
      });

      document.getElementById('mp-import').onclick = async () => {
        const paths = await window.api.dialog.openFile({
          title: 'Выберите .mrpack или .zip модпак',
          filters: [{ name: 'Modpack', extensions: ['zip', 'mrpack'] }],
          properties: ['openFile']
        });
        if (paths && paths[0]) {
          Toast.info('Импорт', 'Начато…');
          try {
            const result = await window.api.invoke('modpacks:import-zip', paths[0]);
            if (result && result.versionId) this.selectInstalled(result);
            Toast.success('Импорт завершён', result && result.name ? result.name : 'Готово');
          } catch (e) { Toast.error('Ошибка импорта', e.message); }
        }
      };

      document.getElementById('mp-export').onclick = async () => {
        const out = await window.api.dialog.saveFile({
          title: 'Куда сохранить .mrpack?',
          defaultPath: 'my-pack.mrpack',
          filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }]
        });
        if (out) {
          try {
            const result = await window.api.invoke('modpacks:export', out);
            Toast.success('Сборка экспортирована', result.path);
            window.api.shell.showInFolder(result.path);
          } catch (error) { Toast.error('Ошибка экспорта', error.message); }
        }
      };
      document.getElementById('mp-local').onclick = () => this.showLocal();
      document.getElementById('mp-prev').onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
      document.getElementById('mp-next').onclick = () => { this.page++; this.search(); };

      this.search();
    },

    selectInstalled(result) {
      Store.set('selectedModpack', { name: result.name, path: result.path, versionId: result.versionId });
      Store.set('selectedVersion', result.versionId);
      Store.set('selectedInstallPath', result.path);
      const bottom = document.getElementById('bottom-version');
      if (bottom) bottom.textContent = result.versionId;
    },

    async installPack(pack, version = null) {
      Toast.info('Установка', version ? `Версия: ${version.title || version.versionNumber || version.id}` : 'Сборка загружается…');
      const payload = {
        ...pack,
        versionId: version && version.source === 'modrinth' ? version.id : undefined,
        fileId: version && version.source === 'curseforge' ? version.fileId || version.id : pack.fileId,
        mcVersion: this.mcVersion,
        loader: this.loader
      };
      const result = await window.api.invoke('modpacks:install', payload);
      if (result && result.versionId) this.selectInstalled(result);
      Toast.success('Сборка установлена', result && result.name ? result.name : 'Готово');
      this.search();
      return result;
    },

    async search() {
      const list = document.getElementById('mp-list');
      list.innerHTML = '<div class="empty-state"><span class="spinner"></span> Поиск…</div>';
      try {
        const r = await window.api.invoke('modpacks:search', {
          query: this.query,
          sources: this.sources,
          preferSource: this.preferSource,
          mcVersion: this.mcVersion,
          loader: this.loader,
          page: this.page,
          pageSize: 60
        });
        const prevBtn = document.getElementById('mp-prev');
        if (prevBtn) prevBtn.style.display = this.page > 0 ? '' : 'none';
        if (!r.hits.length) {
          list.innerHTML = `<div class="empty-state">Ничего не найдено${r.errors && r.errors.length ? `<br><small>${esc(r.errors.join(' · '))}</small>` : ''}</div>`;
          return;
        }
        const installedPacks = await window.api.invoke('modpacks:list-local');
        list.innerHTML = r.hits.map((p, idx) => {
          const already = isPackInstalled(installedPacks, p);
          return `
          <div class="mod-card" data-open-index="${idx}" style="cursor:pointer;">
            <div class="icon" style="${p.icon ? `background-image:url('${p.icon}')` : ''}"></div>
            <div class="info">
              <h3>${esc(p.title)}</h3>
              <div class="author">${esc(p.author || '—')} · ${sourceLabel(p.source)}</div>
              <div class="desc">${esc(p.description || '')}</div>
              <div class="stats">
                ${p.downloads ? `<span>⬇ ${Number(p.downloads).toLocaleString('ru-RU')}</span>` : ''}
                ${p.mcVersions && p.mcVersions.length ? `<span>Версии: ${esc(p.mcVersions.slice(0, 4).join(', '))}</span>` : ''}
                ${already ? '<span style="color:var(--ok);">✓ Установлено</span>' : '<span style="color:var(--accent-hi);">Нажмите, чтобы выбрать версию</span>'}
              </div>
            </div>
            <div class="actions">
              <button class="btn primary" style="padding:6px 14px;font-size:12px;" data-open="${idx}">Открыть</button>
              <button class="btn ${already ? 'ghost' : 'outline'}" style="padding:6px 14px;font-size:12px;" data-install="${idx}" ${already ? 'disabled' : ''}>${already ? 'Установлено' : 'Быстрая установка'}</button>
              ${p.url ? `<a href="${p.url}" class="btn ghost" style="padding:6px 14px;font-size:12px;text-decoration:none;" data-external>Сайт</a>` : ''}
            </div>
          </div>
        `;
        }).join('');

        list.querySelectorAll('[data-open-index]').forEach(card => card.onclick = () => {
          const pack = r.hits[Number(card.dataset.openIndex)];
          this.showDetails(pack);
        });
        list.querySelectorAll('[data-open]').forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          this.showDetails(r.hits[Number(b.dataset.open)]);
        });
        list.querySelectorAll('[data-install]').forEach(b => b.onclick = async (e) => {
          e.stopPropagation();
          try { await this.installPack(r.hits[Number(b.dataset.install)]); }
          catch (e) { Toast.error('Ошибка', e.message); }
        });
        list.querySelectorAll('[data-external]').forEach(a => a.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.api.shell.openExternal(a.href);
        });
      } catch (e) {
        list.innerHTML = `<div class="empty-state">Ошибка: ${esc(e.message)}</div>`;
      }
    },

    async showDetails(pack) {
      const body = document.createElement('div');
      body.innerHTML = `
        <div class="empty-state" style="padding:28px;">
          <span class="spinner"></span>
          <p>Загружаю описание, фото и версии сборки…</p>
        </div>
      `;
      const footer = document.createElement('div');
      footer.innerHTML = `<button class="btn ghost" id="mp-detail-close">Закрыть</button>`;
      const opened = Modal.open({ title: esc(pack.title || 'Сборка'), body, footer, size: 'large' });
      footer.querySelector('#mp-detail-close').onclick = () => opened.close();

      try {
        const detail = await window.api.invoke('modpacks:get-details', pack);
        const versions = detail.versions || [];
        const defaultVersion = versions.find(v => v.installable) || versions[0] || null;
        body.innerHTML = `
          <div style="display:grid;grid-template-columns:120px 1fr;gap:16px;align-items:start;">
            <div class="icon" style="width:110px;height:110px;border-radius:22px;background-size:cover;background-position:center;${detail.icon ? `background-image:url('${detail.icon}')` : 'background:var(--bg-2);'}"></div>
            <div>
              <h2 style="margin:0 0 6px;">${esc(detail.title || pack.title)}</h2>
              <div style="color:var(--text-2);font-size:13px;margin-bottom:10px;">
                ${sourceLabel(detail.source)}${detail.author ? ` · ${esc(detail.author)}` : ''}${detail.downloads ? ` · ⬇ ${Number(detail.downloads).toLocaleString('ru-RU')}` : ''}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
                ${(detail.mcVersions || []).slice(0, 10).map(v => `<span class="pill-mini">${esc(v)}</span>`).join('')}
                ${(detail.loaders || []).slice(0, 6).map(v => `<span class="pill-mini ok">${esc(v)}</span>`).join('')}
              </div>
              <p style="color:var(--text-2);line-height:1.5;margin:0;">${esc(detail.summary || detail.description || pack.description || 'Описание отсутствует.')}</p>
            </div>
          </div>

          ${detail.screenshots && detail.screenshots.length ? `
            <h3 style="margin:18px 0 10px;">Фото</h3>
            <div style="display:flex;gap:10px;overflow:auto;padding-bottom:6px;">
              ${detail.screenshots.slice(0, 12).map(src => `<img src="${esc(src)}" style="height:160px;border-radius:16px;border:1px solid var(--border-soft);object-fit:cover;">`).join('')}
            </div>
          ` : ''}

          <h3 style="margin:18px 0 10px;">Описание</h3>
          <div style="max-height:210px;overflow:auto;white-space:pre-wrap;color:var(--text-2);line-height:1.5;background:var(--bg-2);border:1px solid var(--border-soft);border-radius:16px;padding:14px;">${esc(detail.description || detail.summary || pack.description || 'Описание отсутствует.')}</div>

          <h3 style="margin:18px 0 10px;">Версия сборки</h3>
          ${detail.error ? `<div style="color:var(--accent-hi);font-size:13px;margin-bottom:10px;">${esc(detail.error)}</div>` : ''}
          ${versions.length ? `
            <select class="input" id="mp-detail-version" style="width:100%;margin-bottom:10px;">
              ${versions.map((v, idx) => `<option value="${idx}" ${v === defaultVersion ? 'selected' : ''}>${esc(versionTitle(v))}${v.fileSize ? ` · ${formatSize(v.fileSize)}` : ''}</option>`).join('')}
            </select>
            <div id="mp-version-info" style="color:var(--text-2);font-size:12px;margin-bottom:10px;"></div>
          ` : '<div class="empty-state">Список версий не найден. Можно открыть сайт сборки.</div>'}
        `;

        const renderVersionInfo = () => {
          const select = body.querySelector('#mp-detail-version');
          const info = body.querySelector('#mp-version-info');
          if (!select || !info) return;
          const v = versions[Number(select.value)];
          info.textContent = v ? `${v.publishedAt ? new Date(v.publishedAt).toLocaleDateString('ru-RU') + ' · ' : ''}${v.downloads ? '⬇ ' + Number(v.downloads).toLocaleString('ru-RU') + ' · ' : ''}${v.fileName || ''}` : '';
        };
        body.querySelector('#mp-detail-version')?.addEventListener('change', renderVersionInfo);
        renderVersionInfo();

        footer.innerHTML = `
          ${detail.url ? '<button class="btn ghost" id="mp-detail-site">Открыть сайт</button>' : ''}
          <button class="btn primary" id="mp-detail-install" ${versions.length ? '' : 'disabled'}>Установить выбранную версию</button>
          <button class="btn outline" id="mp-detail-close">Закрыть</button>
        `;
        footer.querySelector('#mp-detail-close').onclick = () => opened.close();
        footer.querySelector('#mp-detail-site')?.addEventListener('click', () => window.api.shell.openExternal(detail.url));
        footer.querySelector('#mp-detail-install').onclick = async () => {
          try {
            const idx = Number(body.querySelector('#mp-detail-version')?.value || 0);
            const version = versions[idx] || null;
            await this.installPack(detail, version);
            opened.close();
          } catch (e) { Toast.error('Ошибка', e.message); }
        };
      } catch (e) {
        body.innerHTML = `<div class="empty-state">Не удалось открыть сборку: ${esc(e.message)}</div>`;
      }
    },

    async showLocal() {
      const list = await window.api.invoke('modpacks:list-local');
      const el = document.getElementById('mp-list');
      if (!list.length) { el.innerHTML = '<div class="empty-state">Нет локальных сборок</div>'; return; }
      el.innerHTML = list.map(p => `
        <div class="mod-card">
          <div class="icon" style="background:var(--bg-2);display:flex;align-items:center;justify-content:center;color:var(--accent);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v13h18V7M3 7l9-4 9 4M3 7h18"/></svg>
          </div>
          <div class="info">
            <h3>${esc(p.name)}</h3>
            <div class="author">${p.loader ? `${esc(p.loader)} ${esc(p.loaderVersion || '')} · ` : ''}${esc(p.minecraft || 'Minecraft')} · ${esc(p.path)}</div>
            ${p.warnings && p.warnings.length ? `<div class="desc" style="color:var(--accent-hi);">${esc(p.warnings.join(' '))}</div>` : ''}
          </div>
          <div class="actions">
            ${p.versionId ? `<button class="btn primary" style="padding:6px 14px;font-size:12px;" data-select="${esc(p.name)}" data-path="${esc(p.path)}" data-version="${esc(p.versionId)}">Выбрать</button>` : ''}
            <button class="btn outline" style="padding:6px 14px;font-size:12px;" data-folder="${esc(p.path)}">Папка</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('[data-select]').forEach(b => b.onclick = () => {
        Store.set('selectedModpack', { name: b.dataset.select, path: b.dataset.path, versionId: b.dataset.version });
        Store.set('selectedVersion', b.dataset.version);
        Store.set('selectedInstallPath', b.dataset.path);
        document.getElementById('bottom-version').textContent = b.dataset.version;
        Toast.success('Сборка выбрана', b.dataset.select);
      });
      el.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => window.api.shell.openPath(b.dataset.folder));
    },

    destroy() {}
  };
})();
