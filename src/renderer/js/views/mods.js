/* ═══ Mods view ═══ */
window.Views = window.Views || {};

(function () {
  const escapeHtml = Shared.escapeHtml;

  function sourceLabel(source) {
    if (source === 'minecraft-inside') return 'Minecraft Inside';
    if (source === 'curseforge') return 'CurseForge';
    if (source === 'modrinth') return 'Modrinth';
    return source || '—';
  }

  function formatTarget(v) {
    const name = v.displayName || v.title || v.profileId || v.id;
    const mc = v.minecraft || v.id || '';
    const loader = v.loader && v.loader !== 'vanilla' ? ` · ${v.loader}${v.loaderVersion ? ' ' + v.loaderVersion : ''}` : ' · Vanilla';
    const kind = v.modpack ? ' · сборка' : '';
    return `${name}${mc && name !== mc ? ' · MC ' + mc : ''}${loader}${kind}`;
  }

  function targetKey(v) {
    return v.rootDir || v.path || v.profileId || v.id;
  }

  function isInstalled(installed, item) {
    return (installed || []).some(x => {
      if (x.source && item.source && String(x.source) === String(item.source) && x.id && item.id && String(x.id) === String(item.id)) return true;
      if (x.title && item.title && String(x.title).trim().toLowerCase() === String(item.title).trim().toLowerCase()) return true;
      return false;
    });
  }

  window.Views.mods = {
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
      let current = targets.find(v => v.rootDir === savedPath || v.path === savedPath || v.id === savedVersion || v.profileId === savedVersion) || targets[0] || null;
      if (current) this.applyTarget(current, false);
      return targets;
    },

    targets() {
      const installed = Store.get('installedVersions') || [];
      return installed.filter(v => (v.rootDir || v.path) && (v.minecraft || v.id || v.profileId));
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
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      const c = document.getElementById('library-view-content') || document.getElementById('view-container');
      if (c === document.getElementById('view-container')) {
        c.style.display = 'block';
      }

      const targets = this.targets();
      const current = this.currentTarget();
      c.innerHTML = `
        <div class="view" style="padding:24px;">
          <h1>Менеджер модов</h1>
          <p style="color:var(--text-2);margin-bottom:16px;">Мод ставится строго в <b>mods/ выбранной установленной версии</b>. Если версий нет — установка блокируется, чтобы файл не улетел в общую .minecraft.</p>

          <div class="search-bar" style="display:grid;grid-template-columns:1.4fr 1.4fr 0.8fr 0.9fr auto;gap:10px;align-items:center;">
            <input class="input" id="m-search" placeholder="Поиск мода…" value="${escapeHtml(this.query)}">
            <select class="input" id="m-target">
              ${targets.length ? targets.map(v => `<option value="${escapeHtml(targetKey(v))}" ${current && targetKey(v) === targetKey(current) ? 'selected' : ''}>${escapeHtml(formatTarget(v))}</option>`).join('') : '<option value="">Нет установленных версий</option>'}
            </select>
            <input class="input" id="m-version" placeholder="Версия Minecraft" value="${escapeHtml(this.mcVersion)}" readonly>
            <select class="input" id="m-prefer">
              <option value="curseforge" ${this.preferSource === 'curseforge' ? 'selected' : ''}>Приоритет: CurseForge</option>
              <option value="modrinth" ${this.preferSource === 'modrinth' ? 'selected' : ''}>Приоритет: Modrinth</option>
              <option value="minecraft-inside" ${this.preferSource === 'minecraft-inside' ? 'selected' : ''}>Приоритет: Minecraft Inside</option>
            </select>
            <button class="btn outline" id="m-installed">Установленные</button>
          </div>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0 16px;">
            <span style="color:var(--text-2);font-size:12px;">Источники:</span>
            ${['curseforge', 'modrinth', 'minecraft-inside'].map(src => `
              <label class="pill-mini" style="display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;">
                <input type="checkbox" data-source="${src}" ${this.sources.includes(src) ? 'checked' : ''}>
                <span>${sourceLabel(src)}</span>
              </label>`).join('')}
            <button class="btn ghost" id="m-reset-filters">Обновить версии</button>
          </div>

          ${targets.length ? '' : '<div class="empty-state" style="margin:12px 0;">Сначала установите Minecraft/Forge/Fabric во вкладке «Версии». После этого тут появится выбор, куда ставить моды.</div>'}

          <div id="m-dropzone" class="drop-zone">Перетащите .jar сюда — он попадёт в mods/ выбранной версии</div>
          <div id="m-context" style="margin:10px 0 18px;color:var(--text-2);font-size:12px;"></div>

          <h2>Результаты поиска</h2>
          <div id="m-list" class="card grid" style="grid-template-columns:1fr;"></div>
          <div style="display:flex;justify-content:center;margin-top:12px;gap:8px;">
            <button class="btn ghost" id="m-prev" style="${this.page > 0 ? '' : 'display:none;'}">← Назад</button>
            <span id="m-page" style="padding:8px 14px;">Стр. 1</span>
            <button class="btn ghost" id="m-next">Вперёд →</button>
          </div>
        </div>
      `;

      let modSearchTimer = null;
      document.getElementById('m-search').oninput = (e) => {
        this.query = e.target.value;
        clearTimeout(modSearchTimer);
        modSearchTimer = setTimeout(() => { this.page = 0; this.search(); }, 350);
      };
      document.getElementById('m-search').onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(modSearchTimer); this.page = 0; this.search(); } };
      document.getElementById('m-target').onchange = (e) => {
        const target = this.targets().find(v => targetKey(v) === e.target.value);
        if (target) this.applyTarget(target, true);
        this.page = 0;
        this.render();
      };
      document.getElementById('m-prefer').onchange = (e) => { this.preferSource = e.target.value; this.page = 0; this.search(); };
      document.querySelectorAll('[data-source]').forEach(el => el.onchange = () => {
        this.sources = Array.from(document.querySelectorAll('[data-source]:checked')).map(x => x.dataset.source);
        if (!this.sources.length) this.sources = ['curseforge'];
        this.page = 0;
        this.search();
      });
      document.getElementById('m-reset-filters').onclick = async () => {
        await this.refreshInstalled();
        this.render();
      };
      document.getElementById('m-prev').onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
      document.getElementById('m-next').onclick = () => { this.page++; this.search(); };
      document.getElementById('m-installed').onclick = () => this.showInstalled();

      const dz = document.getElementById('m-dropzone');
      dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = async (e) => {
        e.preventDefault();
        dz.classList.remove('over');
        const target = this.currentTarget();
        if (!target) { Toast.error('Нет версии', 'Сначала установите и выберите версию Minecraft.'); return; }
        const rootDir = target.rootDir || target.path;
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar'));
        for (const f of files) {
          const buf = await f.arrayBuffer();
          await window.api.invoke('mods:install', { fileName: f.name, buffer: buf, rootDir, gameDir: rootDir });
        }
        Toast.success('Готово', `Установлено ${files.length} модов в ${rootDir}/mods`);
      };

      this.updateContext();
      this.search();
    },

    updateContext() {
      const el = document.getElementById('m-context');
      if (!el) return;
      const target = this.currentTarget();
      if (!target) {
        el.textContent = 'Установка модов отключена: нет установленной версии Minecraft.';
        return;
      }
      const version = this.mcVersion || 'любая версия';
      const loader = this.loader || 'vanilla/любой загрузчик';
      const path = target.rootDir || target.path;
      el.textContent = `Каталог ограничен выбранной версией: ${version} · ${loader}. Установка пойдёт сюда: ${path}/mods`;
    },

    async showInstallDialog(mod) {
      const targets = this.targets();
      if (!targets.length) {
        Toast.error('Нет версий', 'Сначала установите Minecraft/Forge/Fabric во вкладке «Версии».');
        return;
      }
      const current = this.currentTarget() || targets[0];
      const body = document.createElement('div');
      body.innerHTML = `
        <p style="color:var(--text-2);margin-top:0;">Выберите установленную версию Minecraft, куда поставить мод.</p>
        <label style="font-size:12px;color:var(--text-2);">Куда установить</label>
        <select class="input" id="mod-install-target" style="width:100%;margin:6px 0 12px;">
          ${targets.map(v => `<option value="${escapeHtml(targetKey(v))}" ${targetKey(v) === targetKey(current) ? 'selected' : ''}>${escapeHtml(formatTarget(v))}</option>`).join('')}
        </select>
        <div id="mod-version-box" style="margin-top:10px;color:var(--text-2);font-size:13px;">${mod.source === 'modrinth' ? 'Загружаю версии файла…' : 'Для этого источника будет выбран совместимый файл автоматически.'}</div>
      `;
      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn primary" id="mod-install-ok">Установить</button>
        <button class="btn outline" id="mod-install-cancel">Отмена</button>
      `;
      const modal = Modal.open({ title: escapeHtml(mod.title || 'Установка мода'), body, footer, size: 'large' });
      footer.querySelector('#mod-install-cancel').onclick = () => modal.close();

      let versionList = [];
      const selectTarget = body.querySelector('#mod-install-target');
      const box = body.querySelector('#mod-version-box');

      const loadFileVersions = async () => {
        const target = targets.find(v => targetKey(v) === selectTarget.value) || current;
        if (mod.source !== 'modrinth') {
          box.textContent = `Мод будет установлен в ${target.rootDir || target.path}/mods`;
          return;
        }
        box.innerHTML = '<span class="spinner"></span> Загружаю версии файла…';
        try {
          const info = await window.api.invoke('mods:get-by-id', mod.id, mod.source);
          const targetMc = target.minecraft || target.id || '';
          const targetLoader = target.loader && target.loader !== 'vanilla' ? target.loader : '';
          versionList = (info.versions || []).filter(v => {
            const okMc = !targetMc || (v.game_versions || []).includes(targetMc);
            const okLoader = !targetLoader || (v.loaders || []).includes(targetLoader);
            return okMc && okLoader && (v.files || []).length;
          });
          if (!versionList.length) versionList = (info.versions || []).filter(v => (v.files || []).length).slice(0, 30);
          box.innerHTML = versionList.length ? `
            <label style="font-size:12px;color:var(--text-2);">Версия файла мода</label>
            <select class="input" id="mod-file-version" style="width:100%;margin-top:6px;">
              ${versionList.slice(0, 60).map((v, idx) => {
                const file = (v.files || []).find(f => f.primary) || (v.files || [])[0] || {};
                const mc = (v.game_versions || []).slice(0, 3).join(', ');
                const loaders = (v.loaders || []).slice(0, 3).join(', ');
                return `<option value="${idx}">${escapeHtml(v.name || v.version_number || v.id)} · MC ${escapeHtml(mc)} · ${escapeHtml(loaders)} · ${escapeHtml(file.filename || '')}</option>`;
              }).join('')}
            </select>
          ` : '<div style="color:var(--accent-hi);">Совместимый файл не найден. Можно попробовать быструю автоматическую установку.</div>';
        } catch (e) {
          box.innerHTML = `<div style="color:var(--accent-hi);">Не удалось загрузить версии файла: ${escapeHtml(e.message)}. Будет выбран совместимый файл автоматически.</div>`;
        }
      };

      selectTarget.onchange = () => loadFileVersions();
      loadFileVersions();

      footer.querySelector('#mod-install-ok').onclick = async () => {
        const target = targets.find(v => targetKey(v) === selectTarget.value) || current;
        this.applyTarget(target, true);
        const rootDir = target.rootDir || target.path;
        let versionId = undefined;
        const fileSelect = body.querySelector('#mod-file-version');
        if (fileSelect && versionList[Number(fileSelect.value)]) versionId = versionList[Number(fileSelect.value)].id;

        Toast.info('Установка', `${mod.title || 'Мод'} → ${rootDir}/mods`);
        try {
          const result = await window.api.invoke('mods:install', {
            ...mod,
            versionId,
            mcVersion: target.minecraft || target.id || this.mcVersion,
            loader: target.loader && target.loader !== 'vanilla' ? target.loader : '',
            rootDir,
            gameDir: rootDir
          });
          if (result && result.warning) {
            Toast.show({ title: 'Внимание!', message: result.warning, type: 'error', duration: 8000 });
          } else {
            Toast.success('Мод установлен', `${rootDir}/mods`);
          }
          modal.close();
          this.search();
        } catch (e) {
          Toast.error('Ошибка', e.message);
        }
      };
    },

    async search() {
      this.updateContext();
      const list = document.getElementById('m-list');
      list.innerHTML = '<div class="empty-state"><span class="spinner"></span> Поиск…</div>';
      try {
        const r = await window.api.invoke('mods:search', {
          query: this.query,
          sources: this.sources,
          preferSource: this.preferSource,
          mcVersion: this.mcVersion,
          loader: this.loader,
          page: this.page
        });
        document.getElementById('m-page').textContent = `Стр. ${this.page + 1}`;
        const prevBtn = document.getElementById('m-prev');
        if (prevBtn) prevBtn.style.display = this.page > 0 ? '' : 'none';
        if (!r.hits.length) {
          list.innerHTML = `<div class="empty-state">Ничего не найдено${r.errors && r.errors.length ? `<br><small>${escapeHtml(r.errors.join(' · '))}</small>` : ''}</div>`;
          return;
        }
        const currentTarget = this.currentTarget();
        const hasTarget = Boolean(currentTarget);
        const rootDir = currentTarget && (currentTarget.rootDir || currentTarget.path);
        const installed = rootDir ? await window.api.invoke('mods:list-installed', rootDir) : [];
        list.innerHTML = r.hits.map((m, idx) => {
          const already = isInstalled(installed, m);
          return `
          <div class="mod-card">
            <div class="icon" style="${m.icon ? `background-image:url('${m.icon}')` : ''}"></div>
            <div class="info">
              <h3>${escapeHtml(m.title)}</h3>
              <div class="author">${escapeHtml(m.author || '—')} · ${sourceLabel(m.source)}</div>
              <div class="desc">${escapeHtml(m.description || '')}</div>
              <div class="stats">
                ${m.downloads ? `<span>⬇ ${Number(m.downloads).toLocaleString('ru-RU')}</span>` : ''}
                ${m.mcVersions && m.mcVersions.length ? `<span>Версии: ${escapeHtml(m.mcVersions.slice(0, 4).join(', '))}</span>` : ''}
                ${m.loader ? `<span>${escapeHtml(m.loader)}</span>` : ''}
                ${already ? '<span style="color:var(--ok);">✓ Установлено</span>' : ''}
              </div>
            </div>
            <div class="actions">
              <button class="btn ${already ? 'ghost' : 'primary'}" style="padding:6px 14px;font-size:12px;" data-install="${idx}" ${hasTarget && !already ? '' : 'disabled'}>${already ? 'Установлено' : 'Выбрать и установить'}</button>
              ${m.url ? `<a href="${m.url}" class="btn ghost" style="padding:6px 14px;font-size:12px;text-decoration:none;" data-external>Подробнее</a>` : ''}
            </div>
          </div>
        `;
        }).join('');
        list.querySelectorAll('[data-install]').forEach(b => b.onclick = () => this.showInstallDialog(r.hits[Number(b.dataset.install)]));
        list.querySelectorAll('[data-external]').forEach(a => a.onclick = (e) => {
          e.preventDefault(); window.api.shell.openExternal(a.href);
        });
      } catch (e) {
        list.innerHTML = `<div class="empty-state">Ошибка: ${escapeHtml(e.message)}</div>`;
      }
    },

    async showInstalled() {
      const target = this.currentTarget();
      const el = document.getElementById('m-list');
      if (!target) {
        el.innerHTML = '<div class="empty-state">Нет выбранной установленной версии</div>';
        return;
      }
      const rootDir = target.rootDir || target.path;
      const list = await window.api.invoke('mods:list-installed', rootDir);
      if (!list.length) {
        el.innerHTML = `<div class="empty-state">Нет установленных модов в ${escapeHtml(rootDir)}/mods</div>`;
        return;
      }
      el.innerHTML = list.map(m => `
        <div class="mod-card">
          <div class="icon" style="background:var(--bg-2);display:flex;align-items:center;justify-content:center;color:var(--accent);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2v6h6"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          </div>
          <div class="info">
            <h3>${escapeHtml(m.fileName)}</h3>
            <div class="author">${(m.size / 1024).toFixed(1)} KB</div>
            <div class="desc">${escapeHtml(m.path || '')}</div>
          </div>
          <div class="actions">
            <button class="btn ghost" style="padding:6px 14px;font-size:12px;" data-del="${escapeHtml(m.fileName)}">Удалить</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        await window.api.invoke('mods:remove', { fileName: b.dataset.del, rootDir });
        Toast.info('Удалено');
        this.showInstalled();
      });
    },

    destroy() {}
  };
})();
