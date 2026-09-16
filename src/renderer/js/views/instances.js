/* ═══ Isolated Instances & Profiles View ═══ */
window.Views = window.Views || {};

window.Views.instances = {
  async render(container) {
    const root = container || document.getElementById('library-view-content') || document.getElementById('view-container');
    if (!root) return;

    root.innerHTML = `
      <div class="instances-view" style="padding: 20px; display: flex; flex-direction: column; gap: 24px; color: var(--text);">
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

      // Card 0: Standard shared .minecraft instance
      let cardsHtml = `
        <div class="card instance-card ${!activeId ? 'active-instance' : ''}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid ${!activeId ? 'var(--accent)' : 'var(--border-soft)'}; border-radius: var(--radius-md); position: relative;">
          ${!activeId ? `<div style="position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700; color: var(--accent-hi); background: rgba(255,122,0,0.15); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,122,0,0.3);">АКТИВЕН</div>` : ''}
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 15px; color: var(--text);">Стандартный профиль</div>
                <div style="font-size: 11px; color: var(--text-2);">Общая папка .minecraft</div>
              </div>
            </div>
            <p style="font-size: 12px; color: var(--text-2); margin: 8px 0 16px 0;">Использует стандартные общие папки mods, saves и configs.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            ${!activeId
              ? `<button class="btn outline compact-btn" disabled style="flex:1; opacity:0.6;">Выбран</button>`
              : `<button class="btn primary compact-btn btn-select-default" style="flex:1;">Выбрать</button>`
            }
          </div>
        </div>
      `;

      for (const inst of instances) {
        const isCur = activeId === inst.id;
        const loaderBadge = (inst.loader || 'vanilla').toUpperCase();
        cardsHtml += `
          <div class="card instance-card ${isCur ? 'active-instance' : ''}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid ${isCur ? 'var(--accent)' : 'var(--border-soft)'}; border-radius: var(--radius-md); position: relative;">
            ${isCur ? `<div style="position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700; color: var(--accent-hi); background: rgba(255,122,0,0.15); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,122,0,0.3);">АКТИВЕН</div>` : ''}
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255,122,0,0.12); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,122,0,0.25);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 15px; color: var(--text);">${inst.name}</div>
                  <div style="font-size: 11px; color: var(--text-2); display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                    <span class="badge" style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;">MC ${inst.mcVersion}</span>
                    <span class="badge" style="background:rgba(255,122,0,0.12);color:var(--accent-hi);padding:1px 6px;border-radius:4px;">${loaderBadge}</span>
                  </div>
                </div>
              </div>
              <div style="font-size: 11px; color: var(--text-3); margin-top: 8px;">
                ${inst.lastPlayed ? `Последний запуск: ${new Date(inst.lastPlayed).toLocaleDateString()}` : `Создан: ${new Date(inst.createdAt).toLocaleDateString()}`}
              </div>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 16px;">
              ${isCur
                ? `<button class="btn outline compact-btn" disabled style="flex:1; opacity:0.6;">Выбран</button>`
                : `<button class="btn primary compact-btn btn-select-instance" data-id="${inst.id}" style="flex:1;">Выбрать</button>`
              }
              <button class="btn outline compact-btn btn-dup-instance" data-id="${inst.id}" title="Дублировать">Копия</button>
              <button class="btn outline compact-btn btn-folder-instance" data-id="${inst.id}" title="Открыть папку">Папка</button>
              <button class="btn ghost compact-btn btn-del-instance" data-id="${inst.id}" style="color:var(--error);" title="Удалить">✕</button>
            </div>
          </div>
        `;
      }

      grid.innerHTML = cardsHtml;

      const defBtn = grid.querySelector('.btn-select-default');
      if (defBtn) {
        defBtn.onclick = () => {
          Store.set('activeInstance', null);
          Toast.info('Выбран стандартный профиль');
          this.loadInstances();
          if (window.App && window.App.updateHomeProfile) window.App.updateHomeProfile();
        };
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

  showCreateModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; min-width: 320px;">
        <div class="form-group">
          <label style="font-size: 12px; color: var(--text-2); display: block; margin-bottom: 6px;">Название профиля</label>
          <input type="text" id="new-inst-name" class="input" placeholder="Например: Моя хардкор сборка" value="Новый профиль" style="width: 100%;" />
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
