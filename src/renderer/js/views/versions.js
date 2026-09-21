/* ═══ Versions view (Менеджер версий Minecraft — Concept 2026.1.2) ═══ */
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

  const LOADER_LABELS = {
    vanilla: 'Vanilla',
    fabric: 'Fabric',
    forge: 'Forge',
    forgeoptifine: 'Forge + OptiFine',
    quilt: 'Quilt',
    neoforge: 'NeoForge'
  };

  const SOURCE_OPTIONS = [
    { id: 'vanilla', name: 'Официальный Minecraft', sub: 'Все версии от Mojang', icon: 'grass' },
    { id: 'fabric', name: 'Fabric Loader', sub: 'Современный быстрый загрузчик', icon: 'fabric' },
    { id: 'forge', name: 'Forge', sub: 'Классический загрузчик модов', icon: 'forge' },
    { id: 'neoforge', name: 'NeoForge', sub: 'Современный форк Forge для 1.20.4+', icon: 'neoforge' },
    { id: 'quilt', name: 'Quilt Loader', sub: 'Модульный расширенный загрузчик', icon: 'quilt' },
    { id: 'forgeoptifine', name: 'Forge + OptiFine', sub: 'Для модов, шейдеров и оптимизации', icon: 'optifine' }
  ];

  const VERSION_IMAGES = {
    release_modern: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=240&q=80',
    release_nature: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=240&q=80',
    release_caves: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=240&q=80',
    snapshot: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=240&q=80',
    beta: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=240&q=80',
    alpha: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=240&q=80',
    fallback: 'assets/nexus-brand-showcase.png'
  };

  function getVersionThumb(v) {
    if (v.type === 'snapshot') return VERSION_IMAGES.snapshot;
    if (v.type === 'old_beta') return VERSION_IMAGES.beta;
    if (v.type === 'old_alpha') return VERSION_IMAGES.alpha;
    if (v.id.startsWith('1.21') || v.id.startsWith('1.20')) return VERSION_IMAGES.release_modern;
    if (v.id.startsWith('1.19') || v.id.startsWith('1.18')) return VERSION_IMAGES.release_nature;
    return VERSION_IMAGES.release_caves;
  }

  function getVersionDescription(v) {
    if (v.type === 'snapshot') return 'Экспериментальные функции и изменения для будущих обновлений.';
    if (v.type === 'old_beta') return 'Тестирование новых функций перед релизом.';
    if (v.type === 'old_alpha') return 'Ранняя альфа-версия классического Minecraft.';
    if (v.id === '1.21.1' || v.id === '1.21') return 'Стабильная версия с новыми испытаниями, комнатами и исправлениями ошибок.';
    if (v.id.startsWith('1.20')) return 'Приключения, археология, вишнёвые рощи и новые механики игрового процесса.';
    if (v.id.startsWith('1.19')) return 'Дикое обновление: Тёмные глубины, Хранитель и мангровые болота.';
    if (v.id.startsWith('1.18')) return 'Пещеры и скалы: увеличенная высота мира и обновлённые биомы.';
    if (v.id.startsWith('1.16')) return 'Масштабное обновление Незера с новыми биомами и пиглинами.';
    if (v.id === '1.12.2') return 'Золотой стандарт моддинга: тысячи легендарных модов и сборок.';
    if (v.id === '1.7.10') return 'Классическая стабильная база для глобальных технико-магических сборок.';
    return 'Официальный релиз Minecraft с исправлениями стабильности и оптимизацией.';
  }

  function formatRussianDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  }

  function renderLoaderIcon(loader, size = 24) {
    const l = String(loader || 'vanilla').toLowerCase();
    if (l === 'forge') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#ff9e33" stroke-width="2"><path d="M4 19h16M7 19l2-9h6l2 9M6 10h12L17 5H7L6 10z"/></svg>`;
    }
    if (l === 'forgeoptifine' || l === 'optifine') {
      return `<span style="display:inline-flex;align-items:center;justify-content:center;background:#b91c1c;color:#fff;font-weight:900;font-size:${size * 0.45}px;padding:2px 4px;border-radius:4px;line-height:1;">OF</span>`;
    }
    if (l === 'fabric') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
    }
    if (l === 'quilt') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
    }
    if (l === 'neoforge') {
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    }
    // Grass block for vanilla
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`;
  }

  window.Views.versions = {
    currentFilter: 'all',
    query: '',
    loader: 'vanilla',
    sortOrder: 'newest', // newest | oldest | name
    viewMode: 'list',    // list | grid
    allVersions: [],
    installedList: [],
    availabilityCache: {},
    availabilityLoading: false,

    render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      const mainContent = document.querySelector('main.content');
      if (mainContent) {
        mainContent.style.display = 'grid';
        mainContent.classList.add('view-mode');
      }
      if (home) home.style.display = 'none';
      c.style.display = 'block';

      const currentSource = SOURCE_OPTIONS.find(s => s.id === this.loader) || SOURCE_OPTIONS[0];

      c.innerHTML = `
        <div class="view vm-container">
          <!-- ═══ 1. Controls & Filter Bar (Hero banner removed) ═══ -->
          <div class="vm-top-bar">
            <div class="vm-source-box">
              <span class="vm-source-label">Источник версий:</span>
              <div style="position: relative;">
                <button class="vm-source-dropdown-btn" id="vm-source-btn">
                  <div class="vm-source-icon" id="vm-source-icon">${renderLoaderIcon(currentSource.id, 22)}</div>
                  <div class="vm-source-text">
                    <span class="vm-source-title" id="vm-source-title">${esc(currentSource.name)}</span>
                    <span class="vm-source-sub" id="vm-source-sub">${esc(currentSource.sub)}</span>
                  </div>
                  <svg class="vm-source-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="vm-source-menu" id="vm-source-menu">
                  ${SOURCE_OPTIONS.map(opt => `
                    <button class="vm-source-item ${opt.id === this.loader ? 'active' : ''}" data-source-id="${opt.id}">
                      <div class="vm-source-icon">${renderLoaderIcon(opt.id, 20)}</div>
                      <div class="vm-source-text">
                        <span class="vm-source-title">${esc(opt.name)}</span>
                        <span class="vm-source-sub">${esc(opt.sub)}</span>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="vm-filter-pills" id="vm-filter-pills">
              <button class="vm-filter-pill ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                Все версии <span class="vm-badge-count" id="count-all">…</span>
              </button>
              <button class="vm-filter-pill ${this.currentFilter === 'release' ? 'active' : ''}" data-filter="release">
                Release <span class="vm-badge-count" id="count-release">…</span>
              </button>
              <button class="vm-filter-pill ${this.currentFilter === 'snapshot' ? 'active' : ''}" data-filter="snapshot">
                Snapshot <span class="vm-badge-count" id="count-snapshot">…</span>
              </button>
              <button class="vm-filter-pill ${this.currentFilter === 'old_beta' ? 'active' : ''}" data-filter="old_beta">
                Beta <span class="vm-badge-count" id="count-beta">…</span>
              </button>
              <button class="vm-filter-pill ${this.currentFilter === 'old_alpha' ? 'active' : ''}" data-filter="old_alpha">
                Alpha <span class="vm-badge-count" id="count-alpha">…</span>
              </button>
            </div>

            <div class="vm-sort-box">
              <span class="vm-sort-label">Сортировка:</span>
              <select class="vm-sort-select" id="vm-sort">
                <option value="newest" ${this.sortOrder === 'newest' ? 'selected' : ''}>Сначала новые</option>
                <option value="oldest" ${this.sortOrder === 'oldest' ? 'selected' : ''}>Сначала старые</option>
                <option value="name" ${this.sortOrder === 'name' ? 'selected' : ''}>По названию</option>
              </select>
            </div>
          </div>

          <!-- ═══ 2. Two-column Layout: Available versions & Installed versions ═══ -->
          <div class="vm-split-grid">
            <!-- Left Column: Available Versions -->
            <section class="vm-column available-col">
              <div class="vm-column-head">
                <div class="vm-col-title-wrap">
                  <h2>Доступные версии</h2>
                  <span id="vm-available-count">Загрузка…</span>
                </div>
                <div class="vm-view-toggle">
                  <button class="vm-icon-btn ${this.viewMode === 'grid' ? 'active' : ''}" id="vm-toggle-grid" title="Сетка">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  </button>
                  <button class="vm-icon-btn ${this.viewMode === 'list' ? 'active' : ''}" id="vm-toggle-list" title="Список">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <!-- Search input placed right above the available versions -->
              <div class="vm-search-box">
                <svg class="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="vm-search-input" id="vm-search" placeholder="Поиск версии (например: 1.20.1, snapshot, fabric...)" value="${esc(this.query)}">
                <button class="vm-search-clear" id="vm-clear-search" style="${this.query ? '' : 'display:none;'}">✕</button>
              </div>

              <div class="vm-cards-scroll ${this.viewMode === 'grid' ? 'grid-mode' : ''}" id="vm-available-list">
                <div class="empty-state"><span class="spinner"></span><p>Получение версий от Mojang…</p></div>
              </div>
            </section>

            <!-- Right Column: Installed Versions & Modpacks -->
            <section class="vm-column installed-col">
              <div class="vm-column-head">
                <div class="vm-col-title-wrap">
                  <h2>Установленные версии и сборки</h2>
                  <span id="vm-installed-count">0 версий</span>
                </div>
                <button class="vm-icon-btn" id="vm-open-folder-btn" title="Открыть папку версий" style="width: auto; padding: 0 10px; gap: 6px; font-size: 12px; font-weight: 600;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  Открыть папку
                </button>
              </div>
              <div class="vm-cards-scroll" id="vm-installed-list">
                <div class="empty-state"><span class="spinner"></span><p>Проверка установленных версий…</p></div>
              </div>
            </section>
          </div>
        </div>
      `;

      this.bindEvents();
      this.refresh();
    },

    bindEvents() {
      // Source dropdown toggle
      const srcBtn = document.getElementById('vm-source-btn');
      const srcMenu = document.getElementById('vm-source-menu');
      if (srcBtn && srcMenu) {
        srcBtn.onclick = (e) => {
          e.stopPropagation();
          srcMenu.classList.toggle('open');
        };
        document.addEventListener('click', (e) => {
          if (!srcMenu.contains(e.target) && !srcBtn.contains(e.target)) {
            srcMenu.classList.remove('open');
          }
        });
        srcMenu.querySelectorAll('[data-source-id]').forEach(b => {
          b.onclick = async () => {
            const sid = b.dataset.sourceId;
            this.loader = sid;
            const opt = SOURCE_OPTIONS.find(x => x.id === sid);
            if (opt) {
              document.getElementById('vm-source-icon').innerHTML = renderLoaderIcon(opt.id, 22);
              document.getElementById('vm-source-title').textContent = opt.name;
              document.getElementById('vm-source-sub').textContent = opt.sub;
            }
            srcMenu.querySelectorAll('.vm-source-item').forEach(x => x.classList.toggle('active', x.dataset.sourceId === sid));
            srcMenu.classList.remove('open');
            this.renderAvailableList();
            await this.ensureAvailability(true);
            this.renderAvailableList();
          };
        });
      }

      // Search
      const sInput = document.getElementById('vm-search');
      const sClear = document.getElementById('vm-clear-search');
      if (sInput) {
        sInput.oninput = () => {
          this.query = sInput.value;
          if (sClear) sClear.style.display = this.query ? 'block' : 'none';
          this.renderAvailableList();
        };
      }
      if (sClear) {
        sClear.onclick = () => {
          this.query = '';
          if (sInput) sInput.value = '';
          sClear.style.display = 'none';
          this.renderAvailableList();
        };
      }

      // Filter pills
      document.querySelectorAll('.vm-filter-pill[data-filter]').forEach(b => {
        b.onclick = () => {
          this.currentFilter = b.dataset.filter;
          document.querySelectorAll('.vm-filter-pill[data-filter]').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          this.renderAvailableList();
        };
      });

      // Sorting
      const sortSel = document.getElementById('vm-sort');
      if (sortSel) {
        sortSel.onchange = () => {
          this.sortOrder = sortSel.value;
          this.renderAvailableList();
        };
      }

      // View toggle (grid / list)
      const btnGrid = document.getElementById('vm-toggle-grid');
      const btnList = document.getElementById('vm-toggle-list');
      const listContainer = document.getElementById('vm-available-list');
      if (btnGrid && btnList && listContainer) {
        btnGrid.onclick = () => {
          this.viewMode = 'grid';
          btnGrid.classList.add('active');
          btnList.classList.remove('active');
          listContainer.classList.add('grid-mode');
        };
        btnList.onclick = () => {
          this.viewMode = 'list';
          btnList.classList.add('active');
          btnGrid.classList.remove('active');
          listContainer.classList.remove('grid-mode');
        };
      }

      // Open versions folder
      const openFolderBtn = document.getElementById('vm-open-folder-btn');
      if (openFolderBtn) {
        openFolderBtn.onclick = async () => {
          try {
            const p = await window.api.invoke('versions:get-storage-paths', null);
            if (p && p.all) {
              await window.api.shell.openPath(p.all);
            }
          } catch (e) {
            Toast.error('Не удалось открыть папку', e.message);
          }
        };
      }
    },

    async refresh(force = false) {
      if (force || !this.allVersions.length) {
        try {
          const r = await window.api.invoke('versions:list', { type: 'all' });
          this.allVersions = r.versions || [];
          Store.set('versions', r);
          this.updateCounts(r);
        } catch (e) {
          Toast.error('Не удалось загрузить манифест', e.message);
        }
      } else {
        const cached = Store.get('versions');
        if (cached) this.updateCounts(cached);
      }

      await this.loadInstalled();
      await this.ensureAvailability(force);
      this.renderAvailableList();
      this.renderInstalledList();
    },

    updateCounts(r) {
      const counts = r.counts || {};
      const all = (r.versions || []).length;
      const el = (id) => document.getElementById(id);
      if (el('count-all')) el('count-all').textContent = all;
      if (el('count-release')) el('count-release').textContent = counts.release || (r.versions || []).filter(v => v.type === 'release').length;
      if (el('count-snapshot')) el('count-snapshot').textContent = counts.snapshot || (r.versions || []).filter(v => v.type === 'snapshot').length;
      if (el('count-beta')) el('count-beta').textContent = counts.old_beta || (r.versions || []).filter(v => v.type === 'old_beta').length;
      if (el('count-alpha')) el('count-alpha').textContent = counts.old_alpha || (r.versions || []).filter(v => v.type === 'old_alpha').length;
    },

    async loadInstalled() {
      try {
        const list = await window.api.invoke('versions:get-installed');
        this.installedList = list || [];
        Store.set('installedVersions', this.installedList);
      } catch {
        this.installedList = [];
      }
    },

    async ensureAvailability(force = false) {
      if (this.loader === 'vanilla') return;
      if (!force && this.availabilityCache[this.loader]) return;
      if (!this.allVersions.length || this.availabilityLoading) return;
      this.availabilityLoading = true;
      try {
        const response = await window.api.invoke('versions:get-loader-availability', {
          loader: this.loader,
          mcVersions: this.allVersions.map(v => v.id)
        });
        this.availabilityCache[this.loader] = (response && response.versions) || {};
      } catch (e) {
        this.availabilityCache[this.loader] = {};
      } finally {
        this.availabilityLoading = false;
      }
    },

    loaderInfoFor(versionId) {
      if (this.loader === 'vanilla') return { available: true, label: 'Vanilla', version: versionId };
      const info = (this.availabilityCache[this.loader] || {})[versionId];
      if (!info) return { checking: true, available: false, label: LOADER_LABELS[this.loader] };
      return info;
    },

    isVersionInstalled(versionId) {
      return this.installedList.some(v => v.minecraft === versionId || v.id === versionId);
    },

    filteredVersions() {
      let list = [...this.allVersions];
      if (this.currentFilter !== 'all') {
        list = list.filter(v => v.type === this.currentFilter);
      }
      if (this.query) {
        const q = this.query.toLowerCase();
        list = list.filter(v => v.id.toLowerCase().includes(q));
      }

      if (this.sortOrder === 'oldest') {
        list.sort((a, b) => new Date(a.releaseTime || 0) - new Date(b.releaseTime || 0));
      } else if (this.sortOrder === 'name') {
        list.sort((a, b) => a.id.localeCompare(b.id));
      } else {
        list.sort((a, b) => new Date(b.releaseTime || 0) - new Date(a.releaseTime || 0));
      }
      return list;
    },

    renderAvailableList() {
      const el = document.getElementById('vm-available-list');
      const countEl = document.getElementById('vm-available-count');
      if (!el) return;

      const list = this.filteredVersions();
      if (countEl) countEl.textContent = `Найдено ${list.length} версий`;

      if (!list.length) {
        el.innerHTML = '<div class="empty-state">Нет версий по заданным фильтрам</div>';
        return;
      }

      el.innerHTML = list.slice(0, 100).map(v => {
        const thumb = getVersionThumb(v);
        const tagClass = v.type === 'snapshot' ? 'tag-snapshot' : (v.type === 'old_beta' ? 'tag-beta' : (v.type === 'old_alpha' ? 'tag-alpha' : 'tag-release'));
        const tagLabel = v.type === 'snapshot' ? 'Snapshot' : (v.type === 'old_beta' ? 'Beta' : (v.type === 'old_alpha' ? 'Alpha' : 'Release'));
        const dateStr = formatRussianDate(v.releaseTime);
        const desc = getVersionDescription(v);
        const isInstalled = this.isVersionInstalled(v.id);
        const info = this.loaderInfoFor(v.id);
        const disabled = info.checking || !info.available;

        return `
          <div class="vm-version-card" data-ver-id="${esc(v.id)}">
            <div class="vm-card-thumb" style="background-image: url('${thumb}');"></div>
            <div class="vm-card-info">
              <div class="vm-card-tag-row">
                <span class="vm-tag ${tagClass}">${tagLabel}</span>
                <span class="vm-card-title">${esc(v.id)}</span>
              </div>
              ${dateStr ? `<span class="vm-card-date">${esc(dateStr)}</span>` : ''}
              <p class="vm-card-desc">${esc(desc)}</p>
            </div>
            <div class="vm-card-actions">
              ${isInstalled ? `
                <button class="vm-btn-install vm-btn-installed" data-play-ver="${esc(v.id)}" title="Запустить игру">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Играть
                </button>
              ` : `
                <button class="vm-btn-install" data-install-ver="${esc(v.id)}" ${disabled ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Установить ${esc(v.id)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  ${disabled ? (info.checking ? '…' : 'Недоступно') : 'Установить'}
                </button>
              `}
              <button class="vm-btn-more" data-ver-info="${esc(v.id)}" title="Подробнее">•••</button>
            </div>
          </div>
        `;
      }).join('');

      // Actions
      el.querySelectorAll('[data-install-ver]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.installVersion(btn.dataset.installVer, btn);
        };
      });

      el.querySelectorAll('[data-play-ver]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.playVersion(btn.dataset.playVer);
        };
      });

      el.querySelectorAll('[data-ver-info]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.showVersionDetails(btn.dataset.verInfo);
        };
      });
    },

    renderInstalledList() {
      const el = document.getElementById('vm-installed-list');
      const countEl = document.getElementById('vm-installed-count');
      if (!el) return;

      const list = this.installedList;
      const verCount = list.filter(x => x.kind !== 'modpack').length;
      const packCount = list.filter(x => x.kind === 'modpack').length;
      if (countEl) countEl.textContent = `${verCount} версий • ${packCount} сборки`;

      if (!list.length) {
        el.innerHTML = '<div class="empty-state">Нет установленных версий или сборок</div>';
        return;
      }

      el.innerHTML = list.map(v => {
        const title = v.displayName || v.title || v.id;
        const loaderLabel = LOADER_LABELS[v.loader] || v.loader || 'Vanilla';
        const sub = v.kind === 'modpack'
          ? `Сборка • ${v.minecraft || '1.12.2'} (${loaderLabel})`
          : `Release • ${v.loader && v.loader !== 'vanilla' ? `С модами (${loaderLabel})` : 'Ванильная'}`;
        const isSelected = Store.get('selectedVersion') === v.id;

        return `
          <div class="vm-installed-card ${isSelected ? 'selected' : ''}" data-installed-id="${esc(v.id)}">
            <div class="vm-installed-icon">
              ${v.icon ? `<img src="${esc(v.icon)}">` : renderLoaderIcon(v.loader, 24)}
            </div>
            <div class="vm-installed-info">
              <span class="vm-installed-title">${esc(title)}</span>
              <span class="vm-installed-sub">${esc(sub)}</span>
            </div>
            <div class="vm-card-actions">
              <button class="vm-btn-play" data-play-installed="${esc(v.id)}" data-path="${esc(v.path || '')}" data-modpack="${v.kind === 'modpack' ? '1' : ''}" data-name="${esc(title)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Играть
              </button>
              <button class="vm-btn-more" data-installed-menu="${esc(v.id)}" data-path="${esc(v.path || '')}" data-name="${esc(title)}">•••</button>
            </div>
          </div>
        `;
      }).join('');

      el.querySelectorAll('.vm-installed-card').forEach(card => {
        card.onclick = (e) => {
          if (e.target.closest('button')) return;
          const id = card.dataset.installedId;
          if (!id) return;
          const v = this.installedList.find(x => x.id === id);
          if (!v) return;
          const title = v.displayName || v.minecraft || v.id;
          Store.set('selectedVersion', v.id);
          Store.set('selectedInstallPath', v.path || null);
          Store.set('selectedModpack', v.kind === 'modpack' ? { name: title, path: v.path, versionId: v.id } : null);
          const bVer = document.getElementById('bottom-version');
          if (bVer) bVer.textContent = v.id;
          Toast.info('Выбрана версия для игры', title);
          if (window.App && typeof window.App.updateHomeProfile === 'function') {
            window.App.updateHomeProfile();
          }
          this.renderInstalledList();
        };
      });

      el.querySelectorAll('[data-play-installed]').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          Store.set('selectedVersion', b.dataset.playInstalled);
          Store.set('selectedInstallPath', b.dataset.path || null);
          Store.set('selectedModpack', b.dataset.modpack ? { name: b.dataset.name, path: b.dataset.path, versionId: b.dataset.playInstalled } : null);
          const bVer = document.getElementById('bottom-version');
          if (bVer) bVer.textContent = b.dataset.playInstalled;
          Toast.success('Версия выбрана', b.dataset.name);
          if (window.App && typeof window.App.launch === 'function') {
            window.App.launch();
          }
        };
      });

      el.querySelectorAll('[data-installed-menu]').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          this.showInstalledMenu(b.dataset.installedMenu, b.dataset.path, b.dataset.name);
        };
      });
    },

    showInstalledMenu(versionId, versionPath, name) {
      Modal.open({
        title: `Управление: ${name || versionId}`,
        body: `
          <div style="display:flex;flex-direction:column;gap:10px;">
            <p style="color:var(--text-2);font-size:13px;">Путь: <code>${esc(versionPath || 'Стандартная папка')}</code></p>
            <button class="btn outline" id="modal-act-folder" style="justify-content:flex-start;gap:8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Открыть папку версии
            </button>
            <button class="btn outline" id="modal-act-repair" style="justify-content:flex-start;gap:8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Проверить и починить файлы
            </button>
            <button class="btn ghost" id="modal-act-delete" style="justify-content:flex-start;gap:8px;color:var(--error);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Удалить установку
            </button>
          </div>
        `,
        footer: `<button class="btn primary" id="modal-act-close">Закрыть</button>`
      });

      setTimeout(() => {
        document.getElementById('modal-act-close').onclick = () => Modal.close();
        document.getElementById('modal-act-folder').onclick = () => {
          Modal.close();
          if (versionPath) window.api.shell.openPath(versionPath);
        };
        document.getElementById('modal-act-repair').onclick = async () => {
          Modal.close();
          Toast.info('Восстановление', `Проверяем файлы ${versionId}…`);
          try {
            await window.api.invoke('versions:repair', { versionId, rootDir: versionPath });
            Toast.success('Файлы в порядке', `Версия ${versionId} проверена`);
          } catch (e) {
            Toast.error('Ошибка проверки', e.message);
          }
        };
        document.getElementById('modal-act-delete').onclick = () => {
          Modal.close();
          Modal.confirm({
            title: 'Удалить версию?',
            message: `Вы действительно хотите удалить ${name || versionId}? Все локальные данные этой версии будут стёрты.`,
            okText: 'Удалить',
            onOk: async () => {
              try {
                await window.api.invoke('versions:remove', versionId, versionPath);
                Toast.info('Удалено', name || versionId);
                await this.refresh(true);
              } catch (e) {
                Toast.error('Ошибка удаления', e.message);
              }
            }
          });
        };
      }, 50);
    },

    showVersionDetails(versionId) {
      const v = this.allVersions.find(x => x.id === versionId) || { id: versionId };
      const desc = getVersionDescription(v);
      Modal.open({
        title: `Minecraft ${versionId}`,
        body: `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <p style="font-size:14px;color:var(--text);">${esc(desc)}</p>
            <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:8px;font-size:12px;color:var(--text-2);">
              <div><b>Тип:</b> ${esc(v.type || 'Релиз')}</div>
              <div><b>Дата релиза:</b> ${esc(formatRussianDate(v.releaseTime) || '—')}</div>
              <div><b>Совместимость с загрузчиками:</b> Fabric, Forge, NeoForge, Quilt</div>
            </div>
          </div>
        `,
        footer: `
          <button class="btn ghost" onclick="Modal.close()">Закрыть</button>
          <button class="btn primary" id="modal-details-install">Установить сейчас</button>
        `
      });
      setTimeout(() => {
        const b = document.getElementById('modal-details-install');
        if (b) {
          b.onclick = () => {
            Modal.close();
            this.installVersion(versionId);
          };
        }
      }, 50);
    },

    playVersion(versionId) {
      const found = this.installedList.find(x => x.minecraft === versionId || x.id === versionId);
      if (found) {
        Store.set('selectedVersion', found.id);
        Store.set('selectedInstallPath', found.path || null);
        Store.set('selectedModpack', found.kind === 'modpack' ? { name: found.displayName || found.id, path: found.path, versionId: found.id } : null);
        const bVer = document.getElementById('bottom-version');
        if (bVer) bVer.textContent = found.id;
        if (window.App && typeof window.App.launch === 'function') {
          window.App.launch();
        }
      } else {
        this.installVersion(versionId);
      }
    },

    async installVersion(id, button = null) {
      const info = this.loaderInfoFor(id);
      if (this.loader !== 'vanilla' && (!info || !info.available)) {
        Toast.error('Загрузчик недоступен', `${LOADER_LABELS[this.loader]} не найден для Minecraft ${id}`);
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Установка…';
      }

      Store.set('selectedVersion', id);
      Store.set('selectedModpack', null);
      Store.set('installingVersion', id);
      const bVer = document.getElementById('bottom-version');
      if (bVer) bVer.textContent = id;
      if (window.App && typeof window.App.updateHomeProfile === 'function') {
        window.App.updateHomeProfile();
      }

      Toast.info('Установка началась', `${id} · ${this.loader === 'vanilla' ? 'Vanilla' : LOADER_LABELS[this.loader]}`);
      try {
        const payload = this.loader === 'vanilla'
          ? { versionId: id }
          : { versionId: id, loader: this.loader, loaderVersion: info.version || null };
        const result = await window.api.invoke('versions:install', payload);
        const selectedId = (result && (result.versionId || result.id)) || id;
        Store.set('selectedVersion', selectedId);
        Store.set('selectedModpack', null);
        Store.set('selectedInstallPath', result && (result.rootDir || result.path));
        if (bVer) bVer.textContent = selectedId;
        Toast.success('Версия установлена', selectedId);
        await this.loadInstalled();
        this.renderAvailableList();
        this.renderInstalledList();
        if (window.App && typeof window.App.updateHomeProfile === 'function') {
          window.App.updateHomeProfile();
        }
      } catch (e) {
        Toast.error('Ошибка установки', e.message);
      } finally {
        Store.set('installingVersion', null);
        if (button) {
          button.disabled = false;
          button.textContent = 'Установить';
        }
      }
    },

    destroy() {}
  };
})();
