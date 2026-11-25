/* ═══ Worlds & Save Backups View ═══ */
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

  window.Views.worlds = {
    _worldsCount: 0,
    _backupsCount: 0,

    async render(container) {
      const root = container || document.getElementById('library-view-content') || document.getElementById('view-container');
      if (!root) return;

      const [instances, settings] = await Promise.all([
        window.api.invoke('instances:list').catch(() => []),
        window.api.invoke('settings:get').catch(() => ({}))
      ]);
      const activeInstance = Store.get('activeInstance');
      let rootDir = activeInstance ? activeInstance.rootDir : null;
      const defaultLabel = settings && settings.gameFolder ? `${settings.gameFolder}/saves` : '.minecraft/saves';

      root.innerHTML = `
        <div class="worlds-view" style="padding: 20px; display: flex; flex-direction: column; gap: 20px; color: var(--text);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 style="font-size: 20px; font-weight: 750; margin: 0;">Миры и Резервные копии</h2>
              <p style="color: var(--text-2); font-size: 13px; margin: 4px 0 0 0;">Управляйте сохранениями Minecraft, переносите карты из Проводника и создавайте бэкапы</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button class="btn outline compact-btn" id="btn-import-world-dialog">Импорт карты</button>
              <button class="btn outline compact-btn" id="btn-open-saves-folder">Папка миров</button>
              <button class="btn outline compact-btn" id="btn-open-backups-folder">Папка бэкапов</button>
              <button class="icon-button" id="btn-refresh-worlds" title="Обновить список миров" data-tip="Обновить список миров">
                <svg class="refresh-spin-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
            </div>
          </div>

          <!-- Active Profile & Saves Path Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-soft); border-radius: 4px;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <span style="font-size: 12px; font-weight: 600; color: var(--text-2); white-space: nowrap;">Профиль:</span>
              <select class="input" id="worlds-profile-select" style="height: 30px; font-size: 12.5px; padding: 2px 10px; max-width: 340px;">
                <option value="" ${!activeInstance ? 'selected' : ''}>Стандартный (.minecraft/saves)</option>
                ${(Array.isArray(instances) ? instances : []).map(inst => `
                  <option value="${esc(inst.id)}" ${activeInstance && activeInstance.id === inst.id ? 'selected' : ''}>${esc(inst.name)} (${esc(inst.mcVersion || '')})</option>
                `).join('')}
              </select>
            </div>
            <div id="worlds-target-path" style="font-size: 11.5px; color: var(--text-2); font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
              ${esc(rootDir ? `${rootDir}/saves` : defaultLabel)}
            </div>
          </div>

          <!-- Drag and Drop Zone -->
          <div id="world-dropzone" style="border: 2px dashed rgba(59,130,246,0.4); border-radius: 4px; padding: 24px; text-align: center; background: rgba(59,130,246,0.04); cursor: pointer; transition: all 200ms ease;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff;">Перетащите сюда папку с картой или Zip/Rar архив мира</div>
              <div style="font-size: 12px; color: var(--text-2);">Архив автоматически проверится на наличие сохранения (level.dat) и распакуется в папку saves выбранного профиля</div>
            </div>
          </div>

          <!-- Local Worlds Section -->
          <div>
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Установленные миры (saves)
            </h3>
            <div id="worlds-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
              <div style="color: var(--text-2); padding: 16px;"><span class="spinner"></span> Поиск миров...</div>
            </div>
          </div>

          <!-- Backups Section (hidden when no worlds and no backups) -->
          <div id="backups-section" style="display: none;">
            <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Резервные копии (backups)
            </h3>
            <div id="backups-list" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="color: var(--text-2); padding: 16px;"><span class="spinner"></span> Загрузка архивов...</div>
            </div>
          </div>
        </div>
      `;

      const profileSelect = document.getElementById('worlds-profile-select');
      if (profileSelect) {
        profileSelect.onchange = async (e) => {
          const val = e.target.value;
          const selected = val ? (instances || []).find(x => x.id === val) || null : null;
          Store.set('activeInstance', selected);
          rootDir = selected ? selected.rootDir : null;
          const pathEl = document.getElementById('worlds-target-path');
          if (pathEl) pathEl.textContent = rootDir ? `${rootDir}/saves` : defaultLabel;
          if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
          await this.loadData(rootDir);
        };
      }

      // Dropzone events
      const dropzone = document.getElementById('world-dropzone');
      if (dropzone) {
        dropzone.onclick = async () => {
          const res = await window.api.dialog.openFile({
            title: 'Выберите архив карты (.zip) или папку мира',
            properties: ['openFile', 'openDirectory'],
            filters: [{ name: 'Minecraft Worlds / Archives', extensions: ['zip', 'rar', '7z', 'mcworld', 'tar', 'gz', '*'] }]
          });
          if (res && res[0]) {
            this.handleImport(res[0], rootDir);
          }
        };

        dropzone.ondragover = (e) => {
          e.preventDefault();
          dropzone.style.borderColor = '#3b82f6';
          dropzone.style.background = 'rgba(59,130,246,0.12)';
        };

        dropzone.ondragleave = () => {
          dropzone.style.borderColor = 'rgba(59,130,246,0.4)';
          dropzone.style.background = 'rgba(59,130,246,0.04)';
        };

        dropzone.ondrop = (e) => {
          e.preventDefault();
          dropzone.style.borderColor = 'rgba(59,130,246,0.4)';
          dropzone.style.background = 'rgba(59,130,246,0.04)';
          const files = e.dataTransfer.files;
          if (files && files[0] && files[0].path) {
            this.handleImport(files[0].path, rootDir);
          }
        };
      }

      document.getElementById('btn-import-world-dialog').onclick = async () => {
        const res = await window.api.dialog.openFile({
          title: 'Выберите архив мира (.zip, .rar) или папку',
          properties: ['openFile', 'openDirectory'],
          filters: [{ name: 'World Files', extensions: ['zip', 'rar', '7z', 'mcworld', '*'] }]
        });
        if (res && res[0]) {
          this.handleImport(res[0], rootDir);
        }
      };

      document.getElementById('btn-open-saves-folder').onclick = async () => {
        const curSettings = await window.api.invoke('settings:get');
        const gameFolder = rootDir || curSettings.gameFolder;
        await window.api.shell.openPath(`${gameFolder}/saves`);
      };

      document.getElementById('btn-open-backups-folder').onclick = async () => {
        const curSettings = await window.api.invoke('settings:get');
        const gameFolder = rootDir || curSettings.gameFolder;
        await window.api.shell.openPath(`${gameFolder}/backups`);
      };

      const refreshBtn = document.getElementById('btn-refresh-worlds');
      if (refreshBtn) {
        refreshBtn.onclick = async () => {
          refreshBtn.classList.remove('spinning');
          void refreshBtn.offsetWidth;
          refreshBtn.classList.add('spinning');
          await this.loadData(rootDir);
        };
      }

      await this.loadData(rootDir);
    },

    async handleImport(filePath, rootDir, password = '') {
      Toast.info('Импорт мира…', 'Проверка содержимого сохранения…');
      try {
        const res = await window.api.invoke('worlds:import', { sourcePath: filePath, rootDir, password });
        Toast.success('Мир успешно импортирован!', `Сохранение: ${res.worldName}`);
        await this.loadWorlds(rootDir);
      } catch (err) {
        if (err.message && err.message.includes('парол')) {
          // Prompt for password modal
          this.showPasswordPromptModal(filePath, rootDir);
        } else {
          Toast.error('Ошибка импорта карты', err.message);
        }
      }
    },

    showPasswordPromptModal(filePath, rootDir) {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="font-size: 13px; color: var(--text-2); margin: 0;">Архив защищен паролем. Введите пароль для распаковки мира:</p>
          <input type="password" id="input-archive-pass" class="input" placeholder="Пароль от архива" style="width: 100%; height: 38px;">
        </div>
      `;
      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'flex-end';
      footer.style.gap = '8px';
      footer.innerHTML = `
        <button class="btn ghost btn-cancel">Отмена</button>
        <button class="btn primary btn-unlock">Распаковать</button>
      `;

      const inst = Modal.open({
        title: 'Архив защищен паролем',
        body,
        footer,
        size: 'small'
      });

      footer.querySelector('.btn-cancel').onclick = () => inst.close();
      footer.querySelector('.btn-unlock').onclick = () => {
        const pass = body.querySelector('#input-archive-pass').value.trim();
        inst.close();
        this.handleImport(filePath, rootDir, pass);
      };
    },

    updateBackupsVisibility() {
      const section = document.getElementById('backups-section');
      if (!section) return;
      section.style.display = (this._worldsCount > 0 || this._backupsCount > 0) ? '' : 'none';
    },

    async loadData(rootDir) {
      await Promise.all([this.loadWorlds(rootDir), this.loadBackups(rootDir)]);
      this.updateBackupsVisibility();
    },

    async loadWorlds(rootDir) {
      const listEl = document.getElementById('worlds-list');
      if (!listEl) return;

      try {
        const worlds = await window.api.invoke('worlds:list', rootDir);
        this._worldsCount = Array.isArray(worlds) ? worlds.length : 0;
        this.updateBackupsVisibility();
        if (!worlds || !worlds.length) {
          listEl.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); color: var(--text-2); border: 1px dashed var(--border-soft);">
              В папке saves ещё нет сохранённых миров
            </div>
          `;
          return;
        }

        listEl.innerHTML = worlds.map(w => `
          <div class="card world-card" style="display: flex; gap: 12px; align-items: center; padding: 12px; background: rgba(18,22,30,0.65); border: 1px solid var(--border-soft); border-radius: var(--radius-md); transition: all 180ms ease;">
            <div style="width: 52px; height: 52px; border-radius: 4px; background: #111; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-line);">
              ${w.icon ? `<img src="${w.icon}" style="width:100%;height:100%;object-fit:cover;" />` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text);" title="${esc(w.displayName)}">${esc(w.displayName)}</div>
              <div style="font-size: 11px; color: var(--text-2); margin-top: 2px;">Размер: ${w.sizeFormatted}</div>
              <div style="font-size: 11px; color: var(--text-3);">${new Date(w.lastModified).toLocaleDateString()}</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <button class="btn outline compact-btn btn-backup-world" data-world="${esc(w.name)}" style="padding: 4px 10px; font-size: 11px;" title="Создать Zip-бэкап">Бэкап</button>
              <button class="btn ghost compact-btn btn-folder-world" data-path="${esc(w.path)}" style="padding: 4px 10px; font-size: 11px;" title="Открыть папку мира">Папка</button>
            </div>
          </div>
        `).join('');

        listEl.querySelectorAll('.btn-backup-world').forEach(btn => {
          btn.onclick = async () => {
            const worldName = btn.dataset.world;
            btn.disabled = true;
            btn.textContent = '…';
            try {
              const res = await window.api.invoke('worlds:backup', worldName, rootDir);
              Toast.success('Резервная копия создана!', `${res.fileName} (${res.sizeFormatted})`);
              await this.loadBackups(rootDir);
            } catch (err) {
              Toast.error('Ошибка создания бэкапа', err.message);
            } finally {
              btn.disabled = false;
              btn.textContent = 'Бэкап';
            }
          };
        });

        listEl.querySelectorAll('.btn-folder-world').forEach(btn => {
          btn.onclick = () => {
            if (btn.dataset.path) window.api.shell.openPath(btn.dataset.path);
          };
        });
      } catch (err) {
        listEl.innerHTML = `<div style="color:var(--error);padding:16px;">Ошибка загрузки миров: ${esc(err.message)}</div>`;
      }
    },

    async loadBackups(rootDir) {
      const listEl = document.getElementById('backups-list');
      if (!listEl) return;

      try {
        const backups = await window.api.invoke('worlds:list-backups', rootDir);
        this._backupsCount = Array.isArray(backups) ? backups.length : 0;
        this.updateBackupsVisibility();
        if (!backups || !backups.length) {
          listEl.innerHTML = `
            <div style="padding: 20px; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); color: var(--text-2); border: 1px dashed var(--border-soft);">
              Резервных копий пока нет. Нажмите «Бэкап» у любого мира выше.
            </div>
          `;
          return;
        }

        listEl.innerHTML = backups.map(b => `
          <div class="backup-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(18,22,30,0.65); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 200px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <div>
                <div style="font-weight: 600; font-size: 13px; color: var(--text);">${esc(b.fileName)}</div>
                <div style="font-size: 11px; color: var(--text-2);">${new Date(b.lastModified).toLocaleString()} • ${b.sizeFormatted}</div>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn outline compact-btn btn-restore-backup" data-file="${esc(b.fileName)}" data-world="${esc(b.worldName)}">Восстановить</button>
              <button class="btn ghost compact-btn btn-delete-backup" data-file="${esc(b.fileName)}" style="color: var(--error);">✕</button>
            </div>
          </div>
        `).join('');

        listEl.querySelectorAll('.btn-restore-backup').forEach(btn => {
          btn.onclick = () => {
            const file = btn.dataset.file;
            const world = btn.dataset.world;
            Modal.confirm({
              title: 'Восстановление мира',
              message: `Вы уверены, что хотите восстановить мир из архива "${file}"? Существующие файлы мира "${world}" будут перезаписаны.`,
              okText: 'Восстановить',
              onOk: async () => {
                try {
                  await window.api.invoke('worlds:restore', file, rootDir, world);
                  Toast.success('Мир успешно восстановлен!', `Мир: ${world}`);
                  await this.loadWorlds(rootDir);
                } catch (err) {
                  Toast.error('Ошибка восстановления', err.message);
                }
              }
            });
          };
        });

        listEl.querySelectorAll('.btn-delete-backup').forEach(btn => {
          btn.onclick = () => {
            const file = btn.dataset.file;
            Modal.confirm({
              title: 'Удаление бэкапа',
              message: `Удалить резервную копию "${file}"? Это действие нельзя отменить.`,
              okText: 'Удалить',
              onOk: async () => {
                try {
                  await window.api.invoke('worlds:delete-backup', file, rootDir);
                  Toast.info('Бэкап удален');
                  await this.loadBackups(rootDir);
                } catch (err) {
                  Toast.error('Ошибка удаления', err.message);
                }
              }
            });
          };
        });
      } catch (err) {
        listEl.innerHTML = `<div style="color:var(--error);padding:16px;">Ошибка загрузки бэкапов: ${esc(err.message)}</div>`;
      }
    }
  };
})();
