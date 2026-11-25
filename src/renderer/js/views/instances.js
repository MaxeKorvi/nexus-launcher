/* ═══ Isolated Instances & Profiles View ═══ */
window.Views = window.Views || {};

window.Views.instances = {
  async render(container) {
    const root = container || document.getElementById('library-view-content') || document.getElementById('view-container');
    if (!root) return;

    root.innerHTML = `
      <div class="instances-view" style="padding: 20px; display: flex; flex-direction: column; gap: 20px; color: var(--text);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; margin: 0;">Изолированные профили</h2>
            <p style="color: var(--text-2); font-size: 13px; margin: 4px 0 0 0;">Отдельные папки для модов, конфигов и сохранений. Никаких конфликтов версий.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn primary compact-btn" id="btn-create-instance">+ Новый профиль</button>
            <button class="btn outline compact-btn" id="btn-open-instances-root">Папка профилей</button>
            <button class="icon-button" id="btn-refresh-instances" title="Обновить">↻</button>
          </div>
        </div>

        <div id="instances-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
          <div style="color: var(--text-2); padding: 16px;"><span class="spinner"></span> Загрузка профилей...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-create-instance').onclick = () => this.showCreateModal();
    document.getElementById('btn-open-instances-root').onclick = async () => {
      await window.api.invoke('instances:open-folder');
    };
    document.getElementById('btn-refresh-instances').onclick = () => this.loadInstances();

    await this.loadInstances();
  },

  async loadInstances() {
    const grid = document.getElementById('instances-grid');
    if (!grid) return;

    try {
      const instances = await window.api.invoke('instances:list');
      const activeInst = Store.get('activeInstance');
      const activeId = activeInst ? activeInst.id : null;
      const esc = Shared.escapeHtml;

      const iconFolder = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      const iconSettings = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      const iconCopy = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

      // Card 0: Standard shared .minecraft instance
      let cardsHtml = `
        <div class="card instance-card ${!activeId ? 'active-instance' : ''}">
          ${!activeId ? `<div class="instance-active-badge">АКТИВЕН</div>` : ''}
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding-right: ${!activeId ? '72px' : '0'};">
              <div style="width: 36px; height: 36px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
              </div>
              <div style="min-width: 0;">
                <div style="font-weight: 700; font-size: 15px; color: var(--text);">Стандартный профиль</div>
                <div style="font-size: 11px; color: var(--text-2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px;">
                  <span style="background: rgba(255,255,255,0.07); color: var(--text); padding: 1px 7px; border-radius: 3px; font-weight: 600; border: 1px solid var(--border-soft);">Базовый (общий)</span>
                  <span>.minecraft</span>
                </div>
              </div>
            </div>
            <p style="font-size: 12px; color: var(--text-2); margin: 8px 0 0 0; line-height: 1.4;">Использует общие папки mods, saves и configs по умолчанию.</p>
          </div>
          <div class="instance-actions-bar">
            ${activeId ? `<button class="btn primary compact-btn btn-select-default" style="height: 30px; padding: 0 12px; font-size: 12px;">Выбрать</button>` : ''}
            <button class="instance-action-btn btn-folder-default" title="Открыть папку .minecraft">${iconFolder}<span>Папка</span></button>
            <button class="instance-action-btn btn-settings-default" title="Настроить профиль (версия, ОЗУ, JVM)">${iconSettings}<span>Настроить</span></button>
            <button class="instance-action-btn btn-dup-default" title="Создать изолированную копию">${iconCopy}<span>Дублировать</span></button>
          </div>
        </div>
      `;

      for (const inst of instances) {
        const isCur = activeId === inst.id;
        const loaderBadge = (inst.loader || 'vanilla').toUpperCase();
        cardsHtml += `
          <div class="card instance-card ${isCur ? 'active-instance' : ''}">
            ${isCur ? `<div class="instance-active-badge">АКТИВЕН</div>` : ''}
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding-right: ${isCur ? '72px' : '0'};">
                <div style="width: 36px; height: 36px; border-radius: 4px; background: var(--glow); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-soft); flex-shrink: 0;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
                <div style="min-width: 0;">
                  <div style="font-weight: 700; font-size: 15px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(inst.name)}</div>
                  <div style="font-size: 11px; color: var(--text-2); display: flex; gap: 6px; align-items: center; margin-top: 3px;">
                    <span style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:3px;">MC ${esc(inst.mcVersion)}</span>
                    <span style="background:var(--glow);color:var(--accent-hi);padding:1px 6px;border-radius:3px;font-weight:600;">${esc(loaderBadge)}</span>
                    ${inst.maxHeap ? `<span style="background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:3px;">${Math.round(inst.maxHeap / 1024 * 10) / 10} ГБ</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="font-size: 11.5px; color: var(--text-2); margin-top: 8px;">
                ${inst.lastPlayed ? `Последний запуск: ${new Date(inst.lastPlayed).toLocaleDateString('ru-RU')}` : `Создан: ${new Date(inst.createdAt).toLocaleDateString('ru-RU')}`}
              </div>
            </div>
            <div class="instance-actions-bar">
              ${!isCur ? `<button class="btn primary compact-btn btn-select-instance" data-id="${esc(inst.id)}" style="height: 30px; padding: 0 12px; font-size: 12px;">Выбрать</button>` : ''}
              <button class="instance-action-btn btn-folder-instance" data-id="${esc(inst.id)}" title="Открыть папку профиля">${iconFolder}<span>Папка</span></button>
              <button class="instance-action-btn btn-settings-instance" data-id="${esc(inst.id)}" title="Настроить профиль (версия, ОЗУ, JVM)">${iconSettings}<span>Настроить</span></button>
              <button class="instance-action-btn btn-dup-instance" data-id="${esc(inst.id)}" title="Дублировать профиль">${iconCopy}</button>
              <button class="instance-action-btn danger btn-del-instance" data-id="${esc(inst.id)}" title="Удалить профиль" style="margin-left: auto;">✕</button>
            </div>
          </div>
        `;
      }

      // Dashed creation slot card
      cardsHtml += `
        <div class="instance-create-slot" id="slot-create-instance" role="button" tabindex="0">
          <div class="slot-plus">+</div>
          <div style="font-size: 14px; font-weight: 700;">+ Новый изолированный профиль</div>
          <div style="font-size: 12px; color: var(--text-2); max-width: 240px;">Отдельная папка для модов, миров и настроек без конфликтов</div>
        </div>
      `;

      grid.innerHTML = cardsHtml;

      const createSlot = document.getElementById('slot-create-instance');
      if (createSlot) {
        createSlot.onclick = () => this.showCreateModal();
        createSlot.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.showCreateModal(); } };
      }

      const defBtn = grid.querySelector('.btn-select-default');
      if (defBtn) {
        defBtn.onclick = () => {
          Store.set('activeInstance', null);
          Toast.info('Выбран стандартный профиль');
          this.loadInstances();
          if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
        };
      }

      const defFolderBtn = grid.querySelector('.btn-folder-default');
      if (defFolderBtn) {
        defFolderBtn.onclick = () => window.api.invoke('instances:open-folder', 'default');
      }

      const defSettingsBtn = grid.querySelector('.btn-settings-default');
      if (defSettingsBtn) {
        defSettingsBtn.onclick = () => this.showSettingsModal(null);
      }

      const defDupBtn = grid.querySelector('.btn-dup-default');
      if (defDupBtn) {
        defDupBtn.onclick = () => this.showCreateModal({ name: 'Стандартный профиль (Копия)' });
      }

      grid.querySelectorAll('.btn-select-instance').forEach(btn => {
        btn.onclick = () => {
          const inst = instances.find(x => x.id === btn.dataset.id);
          if (inst) {
            Store.set('activeInstance', inst);
            Toast.success('Активный профиль изменён', inst.name);
            this.loadInstances();
            if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
          }
        };
      });

      grid.querySelectorAll('.btn-folder-instance').forEach(btn => {
        btn.onclick = () => window.api.invoke('instances:open-folder', btn.dataset.id);
      });

      grid.querySelectorAll('.btn-settings-instance').forEach(btn => {
        btn.onclick = () => {
          const inst = instances.find(x => x.id === btn.dataset.id);
          if (inst) this.showSettingsModal(inst);
        };
      });

      grid.querySelectorAll('.btn-dup-instance').forEach(btn => {
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            const copy = await window.api.invoke('instances:duplicate', btn.dataset.id);
            Toast.success('Профиль скопирован', copy.name);
            await this.loadInstances();
          } catch (err) {
            Toast.error('Ошибка копирования', err.message);
          } finally {
            btn.disabled = false;
          }
        };
      });

      grid.querySelectorAll('.btn-del-instance').forEach(btn => {
        btn.onclick = () => {
          const inst = instances.find(x => x.id === btn.dataset.id);
          Modal.confirm({
            title: 'Удаление профиля',
            message: `Удалить профиль «${inst ? inst.name : ''}» вместе со всеми его модами и сохранениями?`,
            okText: 'Удалить',
            onOk: async () => {
              try {
                await window.api.invoke('instances:remove', btn.dataset.id);
                if (activeId === btn.dataset.id) Store.set('activeInstance', null);
                Toast.info('Профиль удалён');
                await this.loadInstances();
                if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
              } catch (err) {
                Toast.error('Ошибка удаления', err.message);
              }
            }
          });
        };
      });
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--error);padding:16px;">Ошибка загрузки инстансов: ${err.message}</div>`;
    }
  },

  async showSettingsModal(inst) {
    const isDefault = !inst;
    const settings = await window.api.invoke('settings:get').catch(() => ({}));
    const installed = Store.get('installedVersions') || await window.api.invoke('versions:get-installed').catch(() => []);
    const globalRam = (settings.java && settings.java.maxHeap) || 4096;
    const globalJvm = (settings.java && settings.java.jvmArgs) || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200';

    const currentVersion = isDefault
      ? (Store.get('selectedVersion') || settings.lastSelectedVersion || '')
      : (inst.mcVersion || '1.20.4');
    const currentRam = isDefault ? globalRam : (inst.maxHeap || globalRam);
    const currentJvm = isDefault ? globalJvm : (inst.jvmArgs !== undefined && inst.jvmArgs !== null ? inst.jvmArgs : globalJvm);

    const commonVersions = ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'];
    const installedIds = (Array.isArray(installed) ? installed : []).map(v => v.id).filter(Boolean);
    const versionOptions = Array.from(new Set([
      ...(currentVersion && currentVersion !== '—' && currentVersion !== 'нет версии' ? [currentVersion] : []),
      ...installedIds,
      ...(isDefault ? [] : commonVersions)
    ]));

    const esc = Shared.escapeHtml;
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; min-width: 360px;">
        ${!isDefault ? `
          <div class="form-group">
            <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Название профиля</label>
            <input type="text" id="cfg-inst-name" class="input" value="${esc(inst.name)}" style="width: 100%;" />
          </div>
        ` : ''}
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Версия игры</label>
          <select id="cfg-inst-version" class="input" style="width: 100%;">
            ${versionOptions.length
              ? versionOptions.map(v => `<option value="${esc(v)}" ${v === currentVersion ? 'selected' : ''}>${esc(v)}</option>`).join('')
              : `<option value="">Нет установленных версий</option>`
            }
          </select>
        </div>
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="font-size: 12px; color: var(--text-2);">Выделенная память (ОЗУ)</label>
            <span id="cfg-ram-label" style="font-size: 12px; font-weight: 700; color: var(--accent-hi);">${currentRam} MB (${(currentRam / 1024).toFixed(1)} ГБ)</span>
          </div>
          <input type="range" id="cfg-inst-ram" min="1024" max="16384" step="512" value="${currentRam}" style="width: 100%; accent-color: var(--accent);" />
        </div>
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">JVM-аргументы</label>
          <textarea id="cfg-inst-jvm" class="input" rows="3" placeholder="-XX:+UseG1GC ..." style="width: 100%; resize: vertical; font-family: monospace; font-size: 12px;">${esc(currentJvm)}</textarea>
        </div>
      </div>
    `;

    const ramSlider = body.querySelector('#cfg-inst-ram');
    const ramLabel = body.querySelector('#cfg-ram-label');
    ramSlider.oninput = () => {
      const val = Number(ramSlider.value);
      ramLabel.textContent = `${val} MB (${(val / 1024).toFixed(1)} ГБ)`;
    };

    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="btn ghost btn-cancel">Отмена</button>
      <button class="btn primary btn-save">Сохранить</button>
    `;

    const modal = Modal.open({
      title: isDefault ? 'Настройка: Стандартный профиль' : `Настройка: ${inst.name}`,
      body,
      footer
    });

    footer.querySelector('.btn-cancel').onclick = () => modal.close();
    footer.querySelector('.btn-save').onclick = async () => {
      const versionVal = body.querySelector('#cfg-inst-version').value;
      const ramVal = Number(ramSlider.value) || 4096;
      const jvmVal = body.querySelector('#cfg-inst-jvm').value.trim();
      const saveBtn = footer.querySelector('.btn-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Сохранение…';

      try {
        if (isDefault) {
          const nextJava = { ...(settings.java || {}), maxHeap: ramVal, jvmArgs: jvmVal };
          await window.api.invoke('settings:set', {
            java: nextJava,
            ...(versionVal ? { lastSelectedVersion: versionVal } : {})
          });
          if (versionVal) {
            Store.set('selectedVersion', versionVal);
            const bVer = document.getElementById('bottom-version');
            if (bVer) bVer.textContent = versionVal;
          }
          Toast.success('Настройки сохранены', 'Стандартный профиль обновлён');
        } else {
          const nameVal = body.querySelector('#cfg-inst-name').value.trim() || inst.name;
          const updated = await window.api.invoke('instances:update', inst.id, {
            name: nameVal,
            mcVersion: versionVal || inst.mcVersion,
            maxHeap: ramVal,
            jvmArgs: jvmVal
          });
          const active = Store.get('activeInstance');
          if (active && active.id === inst.id) {
            Store.set('activeInstance', updated);
          }
          Toast.success('Профиль обновлён', updated.name);
        }
        modal.close();
        await this.loadInstances();
        if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
      } catch (err) {
        Toast.error('Ошибка сохранения', err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить';
      }
    };
  },

  showCreateModal(prefill = {}) {
    const body = document.createElement('div');
    const esc = Shared.escapeHtml;
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; min-width: 320px;">
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Название профиля</label>
          <input type="text" id="new-inst-name" class="input" placeholder="Например: Моя хардкор сборка" value="${esc(prefill.name || 'Новый профиль')}" style="width: 100%;" />
        </div>
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Версия Minecraft</label>
          <select id="new-inst-version" class="input" style="width: 100%;">
            <option value="1.21.1">1.21.1 (Последний релиз)</option>
            <option value="1.20.4" selected>1.20.4</option>
            <option value="1.20.1">1.20.1 (Рекомендуемая для модов)</option>
            <option value="1.19.4">1.19.4</option>
            <option value="1.18.2">1.18.2</option>
            <option value="1.16.5">1.16.5 (Классическая)</option>
            <option value="1.12.2">1.12.2</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Загрузчик модификаций</label>
          <select id="new-inst-loader" class="input" style="width: 100%;">
            <option value="vanilla">Vanilla (Чистый Minecraft)</option>
            <option value="fabric" selected>Fabric (Быстрый и лёгкий)</option>
            <option value="fabriciris">Fabric + Iris Shaders (Шейдеры в 1 клик)</option>
            <option value="forge">Forge</option>
            <option value="neoforge">NeoForge</option>
            <option value="quilt">Quilt</option>
          </select>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="btn ghost btn-cancel">Отмена</button>
      <button class="btn primary btn-create">Создать профиль</button>
    `;

    const inst = Modal.open({
      title: 'Создать изолированный профиль',
      body,
      footer
    });

    footer.querySelector('.btn-cancel').onclick = () => inst.close();
    footer.querySelector('.btn-create').onclick = async () => {
      const name = body.querySelector('#new-inst-name').value.trim();
      const mcVersion = body.querySelector('#new-inst-version').value;
      const loader = body.querySelector('#new-inst-loader').value;

      if (!name) {
        Toast.error('Ошибка', 'Введите название профиля');
        return;
      }

      const createBtn = footer.querySelector('.btn-create');
      createBtn.disabled = true;
      createBtn.textContent = 'Создание…';

      try {
        const created = await window.api.invoke('instances:create', {
          name,
          mcVersion,
          loader
        });
        inst.close();
        Toast.success('Профиль создан!', `«${created.name}» готов к использованию.`);
        Store.set('activeInstance', created);
        await this.loadInstances();
        if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
      } catch (err) {
        Toast.error('Не удалось создать профиль', err.message);
        createBtn.disabled = false;
        createBtn.textContent = 'Создать профиль';
      }
    };
  }
};
