/* ═══ Versions view ═══ */
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

  window.Views.versions = {
    currentFilter: 'release',
    query: '',
    loader: 'vanilla',
    allVersions: [],
    availabilityCache: {},
    availabilityLoading: false,

    render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      c.style.display = 'block';
      c.innerHTML = `
        <div class="view versions-view">
          <div class="view-hero">
            <div>
              <div class="eyebrow">Nexus Versions</div>
              <h1>Менеджер версий Minecraft</h1>
              <p>Лаунчер проверяет совместимость загрузчика с конкретной версией Minecraft и не даст поставить Fabric, Forge, OptiFine, Quilt или NeoForge там, где загрузчика нет.</p>
            </div>
            <div class="hero-badge" id="loader-status-badge">Vanilla · Fabric · Forge · OptiFine · Quilt · NeoForge</div>
          </div>

          <div class="toolbar version-toolbar">
            <input class="input" id="v-search" placeholder="Поиск версии…" value="${esc(this.query)}">
            <select class="input" id="v-loader" title="Загрузчик модов">
              <option value="vanilla" ${this.loader === 'vanilla' ? 'selected' : ''}>Vanilla</option>
              <option value="fabric" ${this.loader === 'fabric' ? 'selected' : ''}>Fabric</option>
              <option value="forge" ${this.loader === 'forge' ? 'selected' : ''}>Forge</option>
              <option value="forgeoptifine" ${this.loader === 'forgeoptifine' ? 'selected' : ''}>Forge + OptiFine</option>
              <option value="quilt" ${this.loader === 'quilt' ? 'selected' : ''}>Quilt</option>
              <option value="neoforge" ${this.loader === 'neoforge' ? 'selected' : ''}>NeoForge</option>
            </select>
            <div class="filters">
              <button class="btn ghost btn-filter" data-f="release">Release</button>
              <button class="btn ghost btn-filter" data-f="snapshot">Snapshot</button>
              <button class="btn ghost btn-filter" data-f="old_beta">Beta</button>
              <button class="btn ghost btn-filter" data-f="old_alpha">Alpha</button>
              <button class="btn ghost btn-filter" data-f="all">Все</button>
            </div>
            <button class="btn outline" id="v-refresh" title="Обновить">↻</button>
          </div>

          <div class="split-grid">
            <section class="panel-card">
              <div class="section-heading compact"><h2>Доступные версии <span id="v-count"></span></h2></div>
              <div id="v-list" class="version-table-wrap">
                <div class="empty-state"><span class="spinner"></span><p>Загрузка манифеста Mojang…</p></div>
              </div>
            </section>
            <section class="panel-card">
              <div class="section-heading compact"><h2>Установленные версии и сборки</h2></div>
              <div id="v-installed" class="installed-list"></div>
            </section>
          </div>
        </div>
      `;

      document.getElementById('v-search').oninput = (e) => { this.query = e.target.value; this.renderList(); };
      document.getElementById('v-loader').onchange = async (e) => {
        this.loader = e.target.value;
        this.renderList();
        await this.ensureAvailability(true);
        this.renderList();
      };
      document.querySelectorAll('.btn-filter').forEach(b => {
        b.onclick = () => {
          this.currentFilter = b.dataset.f;
          document.querySelectorAll('.btn-filter').forEach(x => x.classList.remove('primary'));
          b.classList.add('primary');
          this.renderList();
        };
      });
      document.getElementById('v-refresh').onclick = () => this.refresh(true);
      document.querySelector(`.btn-filter[data-f="${this.currentFilter}"]`)?.classList.add('primary');
      this.refresh();
    },

    async refresh(force = false) {
      if (force || !this.allVersions.length) {
        try {
          const r = await window.api.invoke('versions:list', { type: 'all' });
          this.allVersions = r.versions || [];
          Store.set('versions', r);
        } catch (e) { Toast.error('Не удалось загрузить манифест', e.message); }
      }
      await this.ensureAvailability(force);
      this.renderList();
      this.renderInstalled();
    },

    async ensureAvailability(force = false) {
      const badge = document.getElementById('loader-status-badge');
      if (this.loader === 'vanilla') {
        if (badge) badge.textContent = 'Vanilla доступен для всех версий';
        return;
      }
      if (!force && this.availabilityCache[this.loader]) {
        if (badge) badge.textContent = `${LOADER_LABELS[this.loader]}: совместимость проверена`;
        return;
      }
      if (!this.allVersions.length || this.availabilityLoading) return;
      this.availabilityLoading = true;
      if (badge) badge.innerHTML = `<span class="spinner"></span> Проверяю ${LOADER_LABELS[this.loader]}…`;
      try {
        const response = await window.api.invoke('versions:get-loader-availability', {
          loader: this.loader,
          mcVersions: this.allVersions.map(v => v.id)
        });
        this.availabilityCache[this.loader] = (response && response.versions) || {};
        const supported = Object.values(this.availabilityCache[this.loader]).filter(x => x && x.available).length;
        if (badge) badge.textContent = `${LOADER_LABELS[this.loader]}: найдено ${supported} совместимых версий`;
      } catch (e) {
        this.availabilityCache[this.loader] = {};
        if (badge) badge.textContent = `${LOADER_LABELS[this.loader]}: не удалось проверить`;
        Toast.error('Проверка загрузчика не выполнена', e.message);
      } finally {
        this.availabilityLoading = false;
      }
    },

    filteredList() {
      let list = this.allVersions;
      if (this.currentFilter !== 'all') list = list.filter(v => v.type === this.currentFilter);
      if (this.query) {
        const q = this.query.toLowerCase();
        list = list.filter(v => v.id.toLowerCase().includes(q));
      }
      return list;
    },

    loaderInfoFor(versionId) {
      if (this.loader === 'vanilla') return { available: true, label: 'Vanilla', version: versionId };
      const info = (this.availabilityCache[this.loader] || {})[versionId];
      if (!info) return { checking: true, available: false, label: LOADER_LABELS[this.loader] };
      return info;
    },

    loaderCell(versionId) {
      const info = this.loaderInfoFor(versionId);
      if (info.checking) return `<span class="pill-mini muted">проверка…</span>`;
      if (!info.available) return `<span class="pill-mini disabled">нет ${esc(LOADER_LABELS[this.loader])}</span>`;
      const version = info.version && this.loader !== 'vanilla' ? ` ${esc(info.version)}` : '';
      return `<span class="pill-mini ok">${esc(LOADER_LABELS[this.loader])}${version}</span>`;
    },

    selectedRowId: null,

    renderList() {
      const el = document.getElementById('v-list');
      if (!el) return;
      const list = this.filteredList();
      const count = document.getElementById('v-count');
      if (count) count.textContent = `— ${list.length} из ${this.allVersions.length}`;
      if (!list.length) { el.innerHTML = '<div class="empty-state">Нет версий по фильтру</div>'; return; }

      if (!this.selectedRowId || !list.some(v => v.id === this.selectedRowId)) {
        this.selectedRowId = list[0].id;
      }

      const activeInfo = this.loaderInfoFor(this.selectedRowId);
      const activeDisabled = activeInfo.checking || !activeInfo.available;
      const activeLoaderName = this.loader === 'vanilla' ? 'Vanilla' : LOADER_LABELS[this.loader];

      el.innerHTML = `
        <div class="version-action-card" id="v-action-card">
          <div class="vac-info">
            <div class="vac-title">⚡ Выбрана версия: <b>${esc(this.selectedRowId)}</b> <span class="pill-mini ok">${esc(activeLoaderName)}</span></div>
            <div class="vac-sub">Кликните «Установить», нажмите на кнопку ниже или сделайте двойной клик по строке</div>
          </div>
          <div class="vac-actions">
            <button class="btn primary compact-btn" id="vac-install-btn" ${activeDisabled ? 'disabled' : ''}>
              ⚡ Установить ${esc(this.selectedRowId)}
            </button>
          </div>
        </div>

        <table class="table versions-table">
          <thead>
            <tr>
              <th>Версия</th>
              <th>Загрузчик</th>
              <th style="text-align: right; min-width: 100px;">Действие</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(v => {
              const info = this.loaderInfoFor(v.id);
              const disabled = info.checking || !info.available;
              const text = info.checking ? '…' : (info.available ? 'Установить' : 'Недоступно');
              const isSelected = this.selectedRowId === v.id;
              const dateStr = v.releaseTime ? new Date(v.releaseTime).toLocaleDateString('ru-RU') : '';
              return `
                <tr data-row-id="${esc(v.id)}" class="${isSelected ? 'active-version-row' : ''} ${disabled ? 'unsupported-loader' : ''}">
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <b>${esc(v.id)}</b>
                      <span class="pill-mini">${esc(v.type)}</span>
                    </div>
                    ${dateStr ? `<small style="color: var(--text-2); font-size: 11px;">Релиз: ${esc(dateStr)}</small>` : ''}
                  </td>
                  <td>${this.loaderCell(v.id)}</td>
                  <td style="text-align: right;">
                    <button class="btn ${disabled ? 'ghost' : 'primary'} compact-btn" data-install="${esc(v.id)}" ${disabled ? 'disabled' : ''}>${text}</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      // Row click to select & update top banner
      el.querySelectorAll('tr[data-row-id]').forEach(tr => {
        tr.onclick = (e) => {
          if (e.target.closest('[data-install]')) return;
          this.selectedRowId = tr.dataset.rowId;
          this.renderList();
        };
        tr.ondblclick = () => {
          this.selectedRowId = tr.dataset.rowId;
          this.installVersion(tr.dataset.rowId);
        };
      });

      const topInstallBtn = document.getElementById('vac-install-btn');
      if (topInstallBtn) {
        topInstallBtn.onclick = () => this.installVersion(this.selectedRowId, topInstallBtn);
      }

      el.querySelectorAll('[data-install]').forEach(b => {
        b.onclick = async (e) => {
          e.stopPropagation();
          await this.installVersion(b.dataset.install, b);
        };
      });
    },

    async installVersion(id, button = null) {
      const info = this.loaderInfoFor(id);
      if (this.loader !== 'vanilla' && (!info || !info.available)) {
        Toast.error('Загрузчик недоступен', `${LOADER_LABELS[this.loader]} не найден для Minecraft ${id}`);
        return;
      }

      const settings = Store.get('settings') || {};
      let customDirName = null;
      if (settings.askVersionFolderName) {
        const defaultDir = this.loader === 'vanilla'
          ? `${id}-Vanilla`
          : `${id}-${LOADER_LABELS[this.loader] || this.loader}`.replace(/\s+/g, '-');
        customDirName = await new Promise(resolve => {
          const body = document.createElement('div');
          body.innerHTML = `
            <p style="margin-bottom: 12px; color: var(--text-2);">Укажите название папки для установки версии <b>${esc(id)}</b>:</p>
            <input class="input" id="modal-folder-name-input" value="${esc(defaultDir)}" style="width: 100%;">
          `;
          const footer = document.createElement('div');
          footer.style.display = 'flex';
          footer.style.justifyContent = 'flex-end';
          footer.style.gap = '8px';
          footer.innerHTML = `
            <button class="btn ghost" id="mfn-cancel">Отмена</button>
            <button class="btn primary" id="mfn-ok">Установить</button>
          `;
          const inst = Modal.open({ title: 'Имя папки версии', body, footer });
          const input = body.querySelector('#modal-folder-name-input');
          footer.querySelector('#mfn-cancel').onclick = () => { inst.close(); resolve(null); };
          footer.querySelector('#mfn-ok').onclick = () => {
            const val = input.value.trim();
            inst.close();
            resolve(val || defaultDir);
          };
          input.onkeydown = (e) => {
            if (e.key === 'Enter') footer.querySelector('#mfn-ok').click();
          };
          setTimeout(() => input.focus(), 50);
        });
        if (!customDirName) return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = 'Ставлю…';
      }

      // Auto-select immediately
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
          ? { versionId: id, customDirName }
          : { versionId: id, loader: this.loader, loaderVersion: info.version || null, customDirName };
        const result = await window.api.invoke('versions:install', payload);
        const selectedId = (result && (result.versionId || result.id)) || id;
        Store.set('selectedVersion', selectedId);
        Store.set('selectedModpack', null);
        Store.set('selectedInstallPath', result && (result.rootDir || result.path));
        if (bVer) bVer.textContent = selectedId;
        Toast.success('Версия установлена', selectedId);
        await this.renderInstalled();
        window.App.updateSelectedFolderHint && window.App.updateSelectedFolderHint();
        if (window.App && typeof window.App.updateHomeProfile === 'function') {
          window.App.updateHomeProfile();
        }

        if (Store.get('queueLaunchAfterInstall')) {
          Store.set('queueLaunchAfterInstall', false);
          Toast.info('Автозапуск', `Запуск Minecraft ${selectedId}…`);
          if (window.App && typeof window.App.launch === 'function') {
            await window.App.launch();
          }
        }
      } catch (e) {
        Toast.error('Ошибка установки', e.message);
      } finally {
        Store.set('installingVersion', null);
        if (button) {
          button.disabled = false;
          const infoNow = this.loaderInfoFor(id);
          button.textContent = infoNow && infoNow.available ? 'Установить' : 'Недоступно';
        }
      }
    },

    async renderInstalled() {
      const el = document.getElementById('v-installed');
      if (!el) return;
      try {
        const list = await window.api.invoke('versions:get-installed');
        Store.set('installedVersions', list);
        if (!list.length) { el.innerHTML = '<div class="empty-state">Нет установленных версий</div>'; return; }
        el.innerHTML = list.map(v => {
          const title = v.displayName || v.title || v.id;
          const sub = v.kind === 'modpack'
            ? `${v.minecraft || v.id} · ${v.loader || 'vanilla'} · сборка`
            : `${v.minecraft && v.minecraft !== v.id ? v.minecraft + ' · ' : ''}${v.loader || 'vanilla'}${v.legacy ? ' · legacy' : ''}`;
          const selected = Store.get('selectedVersion') === v.id;
          return `
            <div class="installed-item ${selected ? 'selected' : ''}">
              <div class="install-icon">${esc((v.loader || v.kind || 'V').charAt(0).toUpperCase())}</div>
              <div class="install-info">
                <b>${esc(title)}</b>
                <span>${esc(sub)}</span>
                <small>${esc(v.path || '')}</small>
              </div>
              <div class="install-actions">
                <button class="btn primary compact-btn" data-use="${esc(v.id)}" data-path="${esc(v.path || '')}" data-modpack="${v.kind === 'modpack' ? '1' : ''}" data-name="${esc(title)}">Выбрать</button>
                <button class="btn outline compact-btn" data-folder="${esc(v.path || '')}">Папка</button>
                <button class="btn ghost compact-btn" data-del="${esc(v.id)}" data-path="${esc(v.path || '')}" data-name="${esc(title)}">Удалить</button>
              </div>
            </div>`;
        }).join('');
        el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
          Store.set('selectedVersion', b.dataset.use);
          Store.set('selectedInstallPath', b.dataset.path || null);
          Store.set('selectedModpack', b.dataset.modpack ? { name: b.dataset.name, path: b.dataset.path, versionId: b.dataset.use } : null);
          document.getElementById('bottom-version').textContent = b.dataset.use;
          Toast.success('Выбрано', b.dataset.name || b.dataset.use);
          window.App.updateSelectedFolderHint && window.App.updateSelectedFolderHint();
          this.renderInstalled();
        });
        el.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => b.dataset.folder && window.api.shell.openPath(b.dataset.folder));
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          const verName = b.dataset.name || b.dataset.del;
          Modal.confirm({
            title: 'Удалить установку?',
            message: `Будет удалена версия: ${verName}`,
            okText: 'Удалить',
            onOk: async () => {
              try {
                await window.api.invoke('versions:remove', b.dataset.del, b.dataset.path || null);
                if (Store.get('selectedVersion') === b.dataset.del || Store.get('selectedInstallPath') === b.dataset.path) {
                  Store.set('selectedVersion', '—');
                  Store.set('selectedInstallPath', null);
                  Store.set('selectedModpack', null);
                  const bVer = document.getElementById('bottom-version');
                  if (bVer) bVer.textContent = '—';
                }
                Toast.info('Версия удалена', verName);
                await this.renderInstalled();
                if (window.App && typeof window.App.updateHomeProfile === 'function') {
                  window.App.updateHomeProfile();
                }
                if (window.App && typeof window.App.updateSelectedFolderHint === 'function') {
                  window.App.updateSelectedFolderHint();
                }
              } catch (err) {
                Toast.error('Ошибка при удалении', err.message || String(err));
              }
            }
          });
        });
      } catch (e) { el.innerHTML = `<div class="empty-state">Ошибка: ${esc(e.message)}</div>`; }
    },

    destroy() {}
  };
})();
