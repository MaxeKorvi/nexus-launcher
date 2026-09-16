/* ═══ Worlds & Save Backups View ═══ */
window.Views = window.Views || {};

window.Views.worlds = {
  async render(container) {
    const root = container || document.getElementById('library-view-content') || document.getElementById('view-container');
    if (!root) return;

    root.innerHTML = `
      <div class="worlds-view" style="padding: 20px; display: flex; flex-direction: column; gap: 24px; color: var(--text);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; margin: 0;">Миры и Резервные копии</h2>
            <p style="color: var(--text-2); font-size: 13px; margin: 4px 0 0 0;">Управляйте сохранениями Minecraft и создавайте защищённые Zip-архивы в 1 клик</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn outline compact-btn" id="btn-open-saves-folder">Папка миров</button>
            <button class="btn outline compact-btn" id="btn-open-backups-folder">Папка бэкапов</button>
            <button class="icon-button" id="btn-refresh-worlds" title="Обновить">↻</button>
          </div>
        </div>

        <!-- Local Worlds Section -->
        <div>
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Установленные миры (saves)
          </h3>
          <div id="worlds-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
            <div style="color: var(--text-2); padding: 16px;"><span class="spinner"></span> Поиск миров...</div>
          </div>
        </div>

        <!-- Backups Section -->
        <div>
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Резервные копии (backups)
          </h3>
          <div id="backups-list" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="color: var(--text-2); padding: 16px;"><span class="spinner"></span> Загрузка архивов...</div>
          </div>
        </div>
      </div>
    `;

    const activeInstance = Store.get('activeInstance');
    const rootDir = activeInstance ? activeInstance.rootDir : null;

    document.getElementById('btn-open-saves-folder').onclick = async () => {
      const settings = await window.api.invoke('settings:get');
      const gameFolder = rootDir || settings.gameFolder;
      await window.api.shell.openPath(`${gameFolder}/saves`);
    };

    document.getElementById('btn-open-backups-folder').onclick = async () => {
      const settings = await window.api.invoke('settings:get');
      const gameFolder = rootDir || settings.gameFolder;
      await window.api.shell.openPath(`${gameFolder}/backups`);
    };

    document.getElementById('btn-refresh-worlds').onclick = () => this.loadData(rootDir);

    await this.loadData(rootDir);
  },

  async loadData(rootDir) {
    await Promise.all([this.loadWorlds(rootDir), this.loadBackups(rootDir)]);
  },

  async loadWorlds(rootDir) {
    const listEl = document.getElementById('worlds-list');
    if (!listEl) return;

    try {
      const worlds = await window.api.invoke('worlds:list', rootDir);
      if (!worlds || !worlds.length) {
        listEl.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 24px; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); color: var(--text-2); border: 1px dashed var(--border-soft);">
            В папке saves ещё нет сохранённых миров
          </div>
        `;
        return;
      }

      listEl.innerHTML = worlds.map(w => `
        <div class="card world-card" style="display: flex; gap: 12px; align-items: center; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-soft); border-radius: var(--radius-md); transition: all 180ms ease;">
          <div style="width: 52px; height: 52px; border-radius: 8px; background: #111; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-line);">
            ${w.icon ? `<img src="${w.icon}" style="width:100%;height:100%;object-fit:cover;" />` : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text);">${w.displayName}</div>
            <div style="font-size: 11px; color: var(--text-2); margin-top: 2px;">Размер: ${w.sizeFormatted}</div>
            <div style="font-size: 11px; color: var(--text-3);">${new Date(w.lastModified).toLocaleDateString()}</div>
          </div>
          <button class="btn outline compact-btn btn-backup-world" data-world="${w.name}" style="flex-shrink: 0;" title="Создать Zip-бэкап">Бэкап</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-backup-world').forEach(btn => {
        btn.onclick = async () => {
          const worldName = btn.dataset.world;
          btn.disabled = true;
          btn.textContent = 'Архивация…';
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
    } catch (err) {
      listEl.innerHTML = `<div style="color:var(--error);padding:16px;">Ошибка загрузки миров: ${err.message}</div>`;
    }
  },

  async loadBackups(rootDir) {
    const listEl = document.getElementById('backups-list');
    if (!listEl) return;

    try {
      const backups = await window.api.invoke('worlds:list-backups', rootDir);
      if (!backups || !backups.length) {
        listEl.innerHTML = `
          <div style="padding: 20px; text-align: center; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); color: var(--text-2); border: 1px dashed var(--border-soft);">
            Резервных копий пока нет. Нажмите «Бэкап» у любого мира выше.
          </div>
        `;
        return;
      }

      listEl.innerHTML = backups.map(b => `
        <div class="backup-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 200px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <div>
              <div style="font-weight: 600; font-size: 13px; color: var(--text);">${b.fileName}</div>
              <div style="font-size: 11px; color: var(--text-2);">${new Date(b.createdAt).toLocaleString()} • ${b.sizeFormatted}</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn outline compact-btn btn-restore-backup" data-file="${b.fileName}" data-world="${b.worldName}">Восстановить</button>
            <button class="btn ghost compact-btn btn-delete-backup" data-file="${b.fileName}" style="color: var(--error);">✕</button>
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
      listEl.innerHTML = `<div style="color:var(--error);padding:16px;">Ошибка загрузки бэкапов: ${err.message}</div>`;
    }
  }
};
