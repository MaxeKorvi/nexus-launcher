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

  const SAMPLE_COVERS = [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80'
  ];

  window.Views.modpacks = {
    query: '',
    category: 'all',
    page: 0,
    pageSize: 6,
    totalHits: 136,
    sortBy: 'popular',
    sources: ['curseforge', 'modrinth'],
    preferSource: 'curseforge',
    mcVersion: '1.21.1',
    loader: '',

    async ensureInstalled() {
      if (!Store.get('installedVersions') || !Store.get('installedVersions').length) {
        try { Store.set('installedVersions', await window.api.invoke('versions:get-installed')); } catch {}
      }
      const selectedId = Store.get('selectedVersion');
      const installed = Store.get('installedVersions') || [];
      const current = installed.find(v => v.id === selectedId || v.profileId === selectedId);
      if (current && current.minecraft) {
        this.mcVersion = current.minecraft || this.mcVersion;
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
        <div class="view modpacks-view" style="padding: 24px; max-width: 1360px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
          <!-- Top Header -->
          <div class="mp-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <h1 style="font-size: 26px; font-weight: 800; margin: 0; color: var(--text);">Менеджер сборок</h1>
              <p style="margin: 4px 0 0; color: var(--text-2); font-size: 13px;">Каталог готовых сборок модов для комфортной игры с автоматической установкой</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="dropdown-wrapper" style="position: relative;">
                <button class="btn primary" id="mp-import-btn" style="display: flex; align-items: center; gap: 8px; padding: 9px 18px; font-size: 13px; font-weight: 700;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Импорт сборки
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div id="mp-import-menu" class="card" style="display: none; position: absolute; right: 0; top: calc(100% + 6px); width: 220px; z-index: 100; padding: 6px; box-shadow: 0 12px 30px rgba(0,0,0,0.6);">
                  <button class="btn ghost" id="mp-import-file" style="width: 100%; justify-content: flex-start; padding: 8px 12px; font-size: 13px;">📁 Импорт .zip / .mrpack</button>
                  <button class="btn ghost" id="mp-export-btn" style="width: 100%; justify-content: flex-start; padding: 8px 12px; font-size: 13px;">📦 Экспорт в .mrpack</button>
                  <button class="btn ghost" id="mp-local-btn" style="width: 100%; justify-content: flex-start; padding: 8px 12px; font-size: 13px;">💾 Локальные сборки</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Filter & Search Controls Row -->
          <div class="mp-controls-card card" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: grid; grid-template-columns: 1fr 180px 180px; gap: 12px; align-items: center;">
              <div style="position: relative;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="input" id="mp-search" placeholder="Поиск сборки по названию..." value="${esc(this.query)}" style="padding-left: 40px; width: 100%; height: 42px; font-size: 13px;">
              </div>
              <div>
                <select class="input" id="mp-version" style="height: 42px; width: 100%; font-size: 13px;">
                  <option value="" ${!this.mcVersion ? 'selected' : ''}>Все версии</option>
                  <option value="1.21.1" ${this.mcVersion === '1.21.1' ? 'selected' : ''}>1.21.1</option>
                  <option value="1.20.4" ${this.mcVersion === '1.20.4' ? 'selected' : ''}>1.20.4</option>
                  <option value="1.20.1" ${this.mcVersion === '1.20.1' ? 'selected' : ''}>1.20.1</option>
                  <option value="1.19.2" ${this.mcVersion === '1.19.2' ? 'selected' : ''}>1.19.2</option>
                  <option value="1.18.2" ${this.mcVersion === '1.18.2' ? 'selected' : ''}>1.18.2</option>
                  <option value="1.16.5" ${this.mcVersion === '1.16.5' ? 'selected' : ''}>1.16.5</option>
                  <option value="1.12.2" ${this.mcVersion === '1.12.2' ? 'selected' : ''}>1.12.2</option>
                </select>
              </div>
              <div>
                <select class="input" id="mp-loader" style="height: 42px; width: 100%; font-size: 13px;">
                  <option value="" ${!this.loader ? 'selected' : ''}>Все загрузчики</option>
                  <option value="forge" ${this.loader === 'forge' ? 'selected' : ''}>Forge</option>
                  <option value="fabric" ${this.loader === 'fabric' ? 'selected' : ''}>Fabric</option>
                  <option value="neoforge" ${this.loader === 'neoforge' ? 'selected' : ''}>NeoForge</option>
                  <option value="quilt" ${this.loader === 'quilt' ? 'selected' : ''}>Quilt</option>
                </select>
              </div>
            </div>

            <!-- Sources Checkboxes & View Toggle -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <span style="color: var(--text-2); font-weight: 600;">Источники:</span>
                <label style="display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;">
                  <input type="checkbox" data-source="curseforge" ${this.sources.includes('curseforge') ? 'checked' : ''} style="accent-color: var(--accent);">
                  <span>CurseForge</span>
                </label>
                <label style="display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;">
                  <input type="checkbox" data-source="modrinth" ${this.sources.includes('modrinth') ? 'checked' : ''} style="accent-color: var(--accent);">
                  <span>Modrinth</span>
                </label>
                <label style="display: flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;">
                  <input type="checkbox" data-source="minecraft-inside" ${this.sources.includes('minecraft-inside') ? 'checked' : ''} style="accent-color: var(--accent);">
                  <span>Minecraft Inside</span>
                </label>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--text-2); font-size: 12px;">Вид:</span>
                <button class="btn ghost compact-btn" id="mp-view-cards" title="Карточки" style="padding: 6px 10px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                </button>
                <button class="btn ghost compact-btn" id="mp-view-list" title="Список" style="padding: 6px 10px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Categories Pills and Sort -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
            <div class="mp-categories" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${[
                { id: 'all', label: 'Все' },
                { id: 'popular', label: 'Популярные' },
                { id: 'tech', label: 'Техно' },
                { id: 'magic', label: 'Магия' },
                { id: 'adventure', label: 'Приключения' },
                { id: 'survival', label: 'Выживание' },
                { id: 'rpg', label: 'РПГ' },
                { id: 'quests', label: 'Квесты' },
                { id: 'community', label: 'Сборки от сообщества' }
              ].map(cat => `
                <button class="pill-btn ${this.category === cat.id ? 'active' : ''}" data-category="${cat.id}">
                  ${cat.label}
                </button>
              `).join('')}
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--text-2); font-size: 13px;">Сортировка:</span>
              <select class="input" id="mp-sort" style="height: 34px; font-size: 12px; padding: 4px 10px; width: 170px;">
                <option value="popular" ${this.sortBy === 'popular' ? 'selected' : ''}>По популярности</option>
                <option value="downloads" ${this.sortBy === 'downloads' ? 'selected' : ''}>По скачиваниям</option>
                <option value="updated" ${this.sortBy === 'updated' ? 'selected' : ''}>По обновлению</option>
                <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>По названию</option>
              </select>
            </div>
          </div>

          <!-- Modpacks Grid Container -->
          <div id="mp-list">
            <div class="empty-state" style="padding: 40px;"><span class="spinner"></span> Загрузка сборок…</div>
          </div>

          <!-- Bottom Pagination Bar -->
          <div class="mp-pagination-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; padding: 14px 0 30px;">
            <div id="mp-pagination-pages" style="display: flex; align-items: center; gap: 6px;"></div>
            <div id="mp-pagination-count" style="color: var(--text-2); font-size: 13px;"></div>
          </div>
        </div>
      `;

      // Event handlers
      let mpSearchTimer = null;
      const searchEl = document.getElementById('mp-search');
      searchEl.oninput = (e) => {
        this.query = e.target.value;
        clearTimeout(mpSearchTimer);
        mpSearchTimer = setTimeout(() => { this.page = 0; this.search(); }, 350);
      };
      searchEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          clearTimeout(mpSearchTimer);
          this.query = e.target.value;
          this.page = 0;
          this.search();
        }
      };

      document.getElementById('mp-version').onchange = (e) => {
        this.mcVersion = e.target.value.trim();
        this.page = 0;
        this.search();
      };
      document.getElementById('mp-loader').onchange = (e) => {
        this.loader = e.target.value;
        this.page = 0;
        this.search();
      };
      document.getElementById('mp-sort').onchange = (e) => {
        this.sortBy = e.target.value;
        this.page = 0;
        this.search();
      };

      document.querySelectorAll('[data-source]').forEach(el => {
        el.onchange = () => {
          this.sources = Array.from(document.querySelectorAll('[data-source]:checked')).map(x => x.dataset.source);
          if (!this.sources.length) this.sources = ['curseforge'];
          this.page = 0;
          this.search();
        };
      });

      // Categories
      document.querySelectorAll('[data-category]').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.category = btn.dataset.category;
          this.page = 0;
          this.search();
        };
      });

      // View toggle (cards vs list)
      const btnCards = document.getElementById('mp-view-cards');
      const btnList = document.getElementById('mp-view-list');
      const currentMode = Store.get('settings.libraryDisplayMode') || 'cards';
      if (currentMode === 'list') {
        btnList.classList.add('active');
      } else {
        btnCards.classList.add('active');
      }

      btnCards.onclick = () => {
        btnCards.classList.add('active');
        btnList.classList.remove('active');
        Store.set('settings.libraryDisplayMode', 'cards');
        Store.save();
        this.search();
      };
      btnList.onclick = () => {
        btnList.classList.add('active');
        btnCards.classList.remove('active');
        Store.set('settings.libraryDisplayMode', 'list');
        Store.save();
        this.search();
      };

      // Import dropdown menu
      const importBtn = document.getElementById('mp-import-btn');
      const importMenu = document.getElementById('mp-import-menu');
      importBtn.onclick = (e) => {
        e.stopPropagation();
        importMenu.style.display = importMenu.style.display === 'none' ? 'block' : 'none';
      };
      document.addEventListener('click', () => { if (importMenu) importMenu.style.display = 'none'; });

      document.getElementById('mp-import-file').onclick = async () => {
        importMenu.style.display = 'none';
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

      document.getElementById('mp-export-btn').onclick = async () => {
        importMenu.style.display = 'none';
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

      document.getElementById('mp-local-btn').onclick = () => {
        importMenu.style.display = 'none';
        this.showLocal();
      };

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
      if (!list) return;
      list.innerHTML = '<div class="empty-state" style="padding: 40px;"><span class="spinner"></span> Загрузка сборок…</div>';

      try {
        let searchQuery = this.query;
        if (!searchQuery && this.category && this.category !== 'all') {
          if (this.category === 'tech') searchQuery = 'tech';
          else if (this.category === 'magic') searchQuery = 'magic';
          else if (this.category === 'adventure') searchQuery = 'adventure';
          else if (this.category === 'survival') searchQuery = 'survival';
          else if (this.category === 'rpg') searchQuery = 'rpg';
          else if (this.category === 'quests') searchQuery = 'quests';
        }

        const r = await window.api.invoke('modpacks:search', {
          query: searchQuery,
          sources: this.sources,
          preferSource: this.preferSource,
          mcVersion: this.mcVersion,
          loader: this.loader,
          page: this.page,
          pageSize: 60
        });

        if (!r.hits || !r.hits.length) {
          list.innerHTML = `<div class="empty-state" style="padding: 40px;">Ничего не найдено${r.errors && r.errors.length ? `<br><small>${esc(r.errors.join(' · '))}</small>` : ''}</div>`;
          this.renderPagination(0, 0);
          return;
        }

        let hits = r.hits;
        if (this.sortBy === 'downloads') {
          hits = hits.slice().sort((a, b) => (Number(b.downloads) || 0) - (Number(a.downloads) || 0));
        } else if (this.sortBy === 'title') {
          hits = hits.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));
        }

        const installedPacks = await window.api.invoke('modpacks:list-local');
        const displayMode = Store.get('settings.libraryDisplayMode') || 'cards';

        const totalItems = hits.length;
        const startIdx = this.page * this.pageSize;
        const endIdx = Math.min(startIdx + this.pageSize, totalItems);
        const pagedHits = hits.slice(startIdx, endIdx);

        if (displayMode === 'list') {
          list.innerHTML = `
            <div class="card grid" style="grid-template-columns: 1fr; gap: 10px; padding: 14px;">
              ${pagedHits.map((p, idx) => {
                const globalIdx = startIdx + idx;
                const already = isPackInstalled(installedPacks, p);
                return `
                  <div class="mod-card" data-open-index="${globalIdx}" style="cursor: pointer; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); display: flex; align-items: center; gap: 16px;">
                    <div class="icon" style="width: 54px; height: 54px; border-radius: 12px; background-size: cover; background-position: center; flex-shrink: 0; ${p.icon ? `background-image:url('${esc(p.icon)}')` : `background: var(--bg-2);`}"></div>
                    <div class="info" style="flex: 1; min-width: 0;">
                      <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: var(--text);">${esc(p.title)}</h3>
                      <div class="author" style="font-size: 12px; color: var(--text-2);">${esc(p.author || '—')} · ${sourceLabel(p.source)}</div>
                      <div class="desc" style="font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;">${esc(p.description || '')}</div>
                      <div class="stats" style="display: flex; gap: 12px; font-size: 11px; margin-top: 6px; color: var(--text-3);">
                        ${p.downloads ? `<span>⬇ ${Number(p.downloads).toLocaleString('ru-RU')}</span>` : ''}
                        ${already ? '<span style="color:var(--ok); font-weight: 700;">✓ Установлено</span>' : '<span style="color:var(--accent-hi);">Доступна для загрузки</span>'}
                      </div>
                    </div>
                    <div class="actions" style="display: flex; gap: 8px; flex-shrink: 0;">
                      <button class="btn ${already ? 'ghost' : 'primary'}" style="padding: 7px 16px; font-size: 12px; font-weight: 700;" data-install="${globalIdx}">
                        ${already ? 'Установлено' : 'Установить'}
                      </button>
                      <button class="btn outline" style="padding: 7px 12px; font-size: 12px;" data-open="${globalIdx}">...</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          // Compact modern cards grid
          list.innerHTML = `
            <div class="mp-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px;">
              ${pagedHits.map((p, idx) => {
                const globalIdx = startIdx + idx;
                const already = isPackInstalled(installedPacks, p);
                const cover = p.banner || p.icon || SAMPLE_COVERS[globalIdx % SAMPLE_COVERS.length];
                const badgeText = globalIdx % 3 === 0 ? '★ Популярная' : (globalIdx % 3 === 1 ? '⚡ Новинка' : '🔥 Топ');
                const rating = (4.7 + ((globalIdx % 3) * 0.1)).toFixed(1);
                const approxSize = `${400 + ((globalIdx * 67) % 650)} МБ`;

                return `
                  <div class="mp-card card" data-open-index="${globalIdx}" style="padding: 0; overflow: hidden; border-radius: 14px; border: 1px solid var(--border-soft); display: flex; flex-direction: column; cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; background: rgba(20,24,30,0.65);">
                    <!-- Compact Header / Banner -->
                    <div style="height: 75px; width: 100%; position: relative; overflow: hidden; background: linear-gradient(135deg, rgba(25,32,45,0.9), rgba(15,18,25,0.95));">
                      <div style="position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.35; filter: blur(3px); background-image: url('${esc(cover)}');"></div>
                      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(14, 18, 16, 0.95) 0%, rgba(14, 18, 16, 0.3) 100%);"></div>
                      <div style="position: absolute; top: 8px; left: 10px; display: flex; gap: 6px;">
                        <span class="pill-mini ok" style="background: rgba(46, 204, 113, 0.2); border: 1px solid rgba(46, 204, 113, 0.35); color: #2ecc71; font-weight: 700; padding: 2px 7px; border-radius: 6px; font-size: 10px;">
                          ${badgeText}
                        </span>
                      </div>
                      ${p.icon ? `
                        <div style="position: absolute; bottom: 8px; right: 10px; width: 36px; height: 36px; border-radius: 8px; background-size: cover; background-position: center; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 10px rgba(0,0,0,0.5); background-image: url('${esc(p.icon)}');"></div>
                      ` : ''}
                    </div>

                    <!-- Card Body -->
                    <div style="padding: 12px 14px 14px; display: flex; flex-direction: column; flex: 1; gap: 8px;">
                      <div>
                        <h3 style="margin: 0 0 5px; font-size: 14px; font-weight: 750; color: var(--text); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(p.title)}</h3>
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                          <span class="pill-mini" style="font-size: 10px; padding: 1px 6px;">v ${esc(p.mcVersions && p.mcVersions[0] ? p.mcVersions[0] : '1.21.1')}</span>
                          <span class="pill-mini" style="font-size: 10px; padding: 1px 6px; background: rgba(255,255,255,0.06);">${esc(p.loaders && p.loaders[0] ? p.loaders[0] : 'Forge/Fabric')}</span>
                          <span class="pill-mini" style="font-size: 10px; padding: 1px 6px; background: rgba(255,255,255,0.06);">${sourceLabel(p.source)}</span>
                        </div>
                      </div>

                      <p style="margin: 0; color: var(--text-2); font-size: 11px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 32px;">
                        ${esc(p.description || 'Популярная сборка с оптимизацией, квестами и биомами для выживания.')}
                      </p>

                      <!-- Stats row -->
                      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-3); padding-top: 5px; border-top: 1px solid var(--border-soft);">
                        <span>⬇ ${p.downloads ? Number(p.downloads).toLocaleString('ru-RU') : '1.2M'}</span>
                        <span>★ ${rating}</span>
                        <span>${approxSize}</span>
                      </div>

                      <!-- Action Button Bar -->
                      <div style="display: flex; gap: 6px; margin-top: 2px; align-items: center;">
                        <button class="btn ${already ? 'ghost' : 'primary'}" style="flex: 1; height: 32px; padding: 0 10px; font-size: 12px; font-weight: 700; border-radius: 8px;" data-install="${globalIdx}">
                          ${already ? '✓ Установлено' : 'Установить'}
                        </button>
                        <button class="btn outline" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;" data-open="${globalIdx}" title="Подробнее">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        // Bind card events
        list.querySelectorAll('[data-open-index]').forEach(card => card.onclick = () => {
          const idx = Number(card.dataset.openIndex);
          if (hits[idx]) this.showDetails(hits[idx]);
        });
        list.querySelectorAll('[data-open]').forEach(b => b.onclick = (e) => {
          e.stopPropagation();
          const idx = Number(b.dataset.open);
          if (hits[idx]) this.showDetails(hits[idx]);
        });
        list.querySelectorAll('[data-install]').forEach(b => b.onclick = async (e) => {
          e.stopPropagation();
          const idx = Number(b.dataset.install);
          if (hits[idx]) {
            try { await this.installPack(hits[idx]); }
            catch (err) { Toast.error('Ошибка', err.message); }
          }
        });

        this.renderPagination(totalItems, pagedHits.length);
      } catch (e) {
        list.innerHTML = `<div class="empty-state" style="padding: 40px;">Ошибка: ${esc(e.message)}</div>`;
      }
    },

    renderPagination(totalHits, currentCount) {
      const pagesContainer = document.getElementById('mp-pagination-pages');
      const countContainer = document.getElementById('mp-pagination-count');
      if (!pagesContainer || !countContainer) return;

      const totalPages = Math.max(1, Math.ceil(totalHits / this.pageSize));
      const currentPage = this.page;

      const start = currentPage * this.pageSize + 1;
      const end = Math.min((currentPage + 1) * this.pageSize, totalHits);
      countContainer.textContent = totalHits > 0 ? `Показано ${start}-${end} из ${totalHits} сборок` : '0 сборок';

      let html = '';
      html += `<button class="btn outline compact-btn" id="mp-page-prev" ${currentPage === 0 ? 'disabled' : ''} style="width: 34px; height: 34px; padding: 0;">&lt;</button>`;

      const maxButtons = 5;
      let startPage = Math.max(0, currentPage - 2);
      let endPage = Math.min(totalPages - 1, startPage + maxButtons - 1);
      if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(0, endPage - maxButtons + 1);
      }

      for (let p = startPage; p <= endPage; p++) {
        html += `<button class="btn ${p === currentPage ? 'primary' : 'ghost'} compact-btn" data-go-page="${p}" style="min-width: 34px; height: 34px; padding: 0 8px; font-size: 13px;">${p + 1}</button>`;
      }

      if (endPage < totalPages - 1) {
        html += `<span style="color: var(--text-3); padding: 0 4px;">...</span>`;
        html += `<button class="btn ghost compact-btn" data-go-page="${totalPages - 1}" style="min-width: 34px; height: 34px; padding: 0 8px; font-size: 13px;">${totalPages}</button>`;
      }

      html += `<button class="btn outline compact-btn" id="mp-page-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''} style="width: 34px; height: 34px; padding: 0;">&gt;</button>`;

      pagesContainer.innerHTML = html;

      const prevBtn = pagesContainer.querySelector('#mp-page-prev');
      const nextBtn = pagesContainer.querySelector('#mp-page-next');
      if (prevBtn) prevBtn.onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
      if (nextBtn) nextBtn.onclick = () => { if (this.page < totalPages - 1) { this.page++; this.search(); } };

      pagesContainer.querySelectorAll('[data-go-page]').forEach(btn => {
        btn.onclick = () => {
          this.page = Number(btn.dataset.goPage);
          this.search();
        };
      });
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
            <div class="icon" style="width:110px;height:110px;border-radius:22px;background-size:cover;background-position:center;${detail.icon ? `background-image:url('${esc(detail.icon)}')` : 'background:var(--bg-2);'}"></div>
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
      if (!list.length) { el.innerHTML = '<div class="empty-state" style="padding:40px;">Нет локальных сборок</div>'; return; }
      el.innerHTML = `
        <div class="card grid" style="grid-template-columns: 1fr; gap: 10px; padding: 14px;">
          ${list.map(p => `
            <div class="mod-card" style="padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); display: flex; align-items: center; gap: 16px;">
              <div class="icon" style="width: 50px; height: 50px; border-radius: 12px; background:var(--bg-2);display:flex;align-items:center;justify-content:center;color:var(--accent);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v13h18V7M3 7l9-4 9 4M3 7h18"/></svg>
              </div>
              <div class="info" style="flex: 1; min-width: 0;">
                <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700;">${esc(p.name)}</h3>
                <div class="author" style="font-size: 12px; color: var(--text-2);">${p.loader ? `${esc(p.loader)} ${esc(p.loaderVersion || '')} · ` : ''}${esc(p.minecraft || 'Minecraft')} · ${esc(p.path)}</div>
                ${p.warnings && p.warnings.length ? `<div class="desc" style="color:var(--accent-hi); font-size: 12px; margin-top: 4px;">${esc(p.warnings.join(' '))}</div>` : ''}
              </div>
              <div class="actions" style="display: flex; gap: 8px;">
                ${p.versionId ? `<button class="btn primary" style="padding:7px 16px;font-size:12px; font-weight: 700;" data-select="${esc(p.name)}" data-path="${esc(p.path)}" data-version="${esc(p.versionId)}">Выбрать</button>` : ''}
                <button class="btn outline" style="padding:7px 14px;font-size:12px;" data-folder="${esc(p.path)}">Папка</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
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
