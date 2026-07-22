/* ═══ Unified settings page: one main card, clear sections ═══ */
window.Views = window.Views || {};

window.Views.settings = {
  settings: null,

  render() {
    this.renderAsync().catch((e) => {
      console.error('[settings] render failed:', e);
      Toast.error('Не удалось открыть настройки', e.message || String(e));
    });
  },

  async renderAsync() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    const mainContent = document.querySelector('main.content');
    if (mainContent) mainContent.style.display = 'grid';
    if (home) home.style.display = 'none';
    if (c === document.getElementById('view-container')) {
      c.style.display = 'block';
    }

    await this.load();
    const s = this.settings || {};
    const accs = await window.api.invoke('accounts:list').catch(() => []);
    const active = (accs || []).find(a => a.active) || null;
    const downloads = await window.api.invoke('downloads:list').catch(() => ({ active: [], queue: [], completed: [], paused: [] }));
    const downloadActive = (downloads.active || []).length;
    const downloadQueue = (downloads.queue || []).length;
    const downloadCompleted = (downloads.completed || []).length;
    const heapMb = Number((s.java && s.java.maxHeap) || 4096);
    const heapGb = Math.round(heapMb / 1024);
    const accountLabel = active ? Shared.providerLabel(active) : 'Аккаунт не выбран';

    c.innerHTML = `
      <div class="view settings-view">
        <div class="settings-hero compact single">
          <div class="settings-hero-title" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="settings-hero-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
              <div>
                <div class="section-kicker">Nexus Launcher</div>
                <h1>Настройки</h1>
                <p>Все параметры и настройки лаунчера собраны на одной странице для вашего удобства.</p>
              </div>
            </div>
            <div>
              <input class="input" id="settings-search" placeholder="Поиск настроек…" style="width: 220px; font-size: 13px; padding: 8px 12px; border-radius: var(--radius-sm);">
            </div>
          </div>
        </div>

        <div class="card settings-single-card">
          <div class="settings-account-line">
            <div class="settings-account-main">
              <div class="avatar big">${Shared.escapeHtml((active && active.nickname ? active.nickname : 'M').charAt(0).toUpperCase())}</div>
              <div>
                <h3>${Shared.escapeHtml(active ? active.nickname : 'Нет активного аккаунта')}</h3>
                <p>${Shared.escapeHtml(accountLabel)}</p>
                <small class="secure-text">● Шифрование включено</small>
              </div>
            </div>
            <div class="settings-inline-actions">
              <button class="btn outline" id="settings-manage-accounts">Управление аккаунтами</button>
              <button class="btn ghost" id="settings-open-log">Открыть лог</button>
              <button class="btn ghost" id="settings-clear-cache">Очистить кэш</button>
            </div>
          </div>

          <div class="settings-sections-grid">
            <section class="settings-section">
              <div class="settings-section-head">
                <div>
                  <h2>Запуск игры</h2>
                  <p>Java, папки игры, память, скины и базовые параметры запуска.</p>
                </div>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Путь к Java</span>
                  <div class="input-action">
                    <input class="input" id="set-java-path" value="${Shared.escapeHtml((s.java && s.java.path) || '')}" placeholder="Автоопределение">
                    <button class="btn outline" id="pick-java">Выбрать</button>
                  </div>
                  <small>Изменения вступят в силу после перезапуска игры. Если оставить пустым, лаунчер сам подберёт совместимую версию Java.</small>
                </label>

                <label class="form-row">
                  <span>Папка игры</span>
                  <div class="input-action">
                    <input class="input" id="set-game-folder" value="${Shared.escapeHtml(s.gameFolder || '')}">
                    <button class="btn outline" id="pick-game-folder">Обзор</button>
                  </div>
                  <small>Место установки основных файлов игры, модов и настроек. Изменение требует перезапуска лаунчера.</small>
                </label>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Система скинов</span>
                  <select class="select" id="set-skin-system">
                    <option value="ely" ${s.skinSystem === 'ely' ? 'selected' : ''}>Ely.by</option>
                    <option value="tlskincape" ${s.skinSystem === 'tlskincape' ? 'selected' : ''}>TLSkinCape</option>
                    <option value="none" ${s.skinSystem === 'none' ? 'selected' : ''}>Ничего</option>
                  </select>
                  <small>Влияет на отображение скинов в игре. Применится при следующем запуске игры.</small>
                </label>

                <label class="form-row">
                  <span>Оптимизация Java (GC Пресет)</span>
                  <select class="select" id="set-jvm-preset">
                    <option value="default" ${(s.java && s.java.jvmPreset) === 'default' ? 'selected' : ''}>Стандартный (без GC флагов)</option>
                    <option value="g1gc" ${(s.java && s.java.jvmPreset || 'g1gc') === 'g1gc' ? 'selected' : ''}>Оптимальный G1GC (Для FPS)</option>
                    <option value="zgc" ${(s.java && s.java.jvmPreset) === 'zgc' ? 'selected' : ''}>Низкие задержки ZGC (Java 17+)</option>
                  </select>
                  <small>Автоматически настраивает сборщик мусора под вашу Java.</small>
                </label>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Ручные JVM аргументы</span>
                  <input class="input" id="set-jvm-args" value="${Shared.escapeHtml((s.java && s.java.jvmArgs) || '')}" placeholder="-XX:+UseG1GC ...">
                  <small>Свои параметры Java для оптимизации работы игры.</small>
                </label>
              </div>

              <div class="form-row settings-memory-wrap">
                <div class="settings-memory-head">
                  <span>Выделяемая оперативная память</span>
                  <b id="heap-value">${heapGb} GB</b>
                </div>
                <div class="range-wrap">
                  <span>2 GB</span>
                  <input type="range" min="2048" max="16384" step="512" value="${heapMb}" id="set-heap">
                  <span>16 GB</span>
                </div>
                <small style="margin-top: 4px; display: block; color: var(--text-2);">Объём памяти, доступный процессу игры. Будет применен при новом запуске Minecraft.</small>
              </div>

              <div class="toggle-list settings-toggle-list">
                <div class="toggle-row">
                  <div><b>Обновление игровых файлов</b><small>Проверять наличие и загружать обновлённые библиотеки игры при запуске.</small></div>
                  <button class="switch ${s.autoUpdates ? 'on' : ''}" id="sw-auto-updates" aria-label="Автообновление"></button>
                </div>
                <div class="toggle-row">
                  <div><b>Проверка файлов при запуске</b><small>Перед стартом восстанавливать отсутствующие или повреждённые файлы игры.</small></div>
                  <button class="switch ${s.verifyOnLaunch ? 'on' : ''}" id="sw-verify" aria-label="Проверка файлов"></button>
                </div>
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section-head">
                <div>
                  <h2>Сеть и загрузки</h2>
                  <p>Параметры сети, папка модпаков и краткая сводка по загрузкам.</p>
                </div>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Потоки загрузки</span>
                  <select class="select" id="set-threads">
                    ${[4, 8, 12, 16, 24, 32].map(n => `<option value="${n}" ${Number(s.downloadThreads) === n ? 'selected' : ''}>${n} потоков</option>`).join('')}
                  </select>
                  <small>Количество параллельных потоков скачивания файлов игры.</small>
                </label>

                <label class="form-row">
                  <span>Таймаут сети</span>
                  <select class="select" id="set-timeout">
                    ${[10, 20, 30, 45, 60, 90].map(n => `<option value="${n}" ${Number(s.networkTimeout) === n ? 'selected' : ''}>${n} секунд</option>`).join('')}
                  </select>
                  <small>Время ожидания ответа сервера перед повторной попыткой.</small>
                </label>
              </div>

              <label class="form-row">
                <span>Папка модпаков</span>
                <div class="input-action">
                  <input class="input" id="set-modpacks-folder" value="${Shared.escapeHtml(s.modpacksFolder || '')}">
                  <button class="btn outline" id="pick-modpacks-folder">Обзор</button>
                </div>
                <small>Куда будут загружаться и устанавливаться локальные сборки модпаков.</small>
              </label>

              <div class="settings-download-summary">
                <div class="settings-stat"><b>${downloadActive}</b><span>Активные</span></div>
                <div class="settings-stat"><b>${downloadQueue}</b><span>В очереди</span></div>
                <div class="settings-stat"><b>${downloadCompleted}</b><span>Завершено</span></div>
              </div>

              <div class="settings-inline-actions">
                <button class="btn outline" id="open-download-manager">Открыть менеджер загрузок</button>
                <button class="btn ghost" id="open-modpacks-folder">Открыть папку модпаков</button>
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section-head">
                <div>
                  <h2>Интерфейс</h2>
                  <p>Внешний вид и поведение окна.</p>
                </div>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Тема оформления</span>
                  <select class="select" id="set-theme">
                    <option value="amoled" ${s.theme === 'amoled' ? 'selected' : ''}>Тёмная Nexus</option>
                    <option value="glass-dark" ${s.theme === 'glass-dark' ? 'selected' : ''}>Тёмная: Жидкое стекло (Liquid Glass)</option>
                    <option value="acrylic" ${s.theme === 'acrylic' ? 'selected' : ''}>Тёмный акрил (Glassmorphism)</option>
                    <option value="emerald" ${s.theme === 'emerald' ? 'selected' : ''}>Изумрудный бор (Emerald)</option>
                    <option value="crimson" ${s.theme === 'crimson' ? 'selected' : ''}>Багровый Незер (Crimson)</option>
                  </select>
                  <small>Тема применяется моментально к окну лаунчера.</small>
                </label>
              </div>

              <div class="toggle-list settings-toggle-list">
                <div class="toggle-row">
                  <div><b>Анимации интерфейса</b><small>Включение/выключение плавных переходов и эффектов.</small></div>
                  <button class="switch ${s.animations !== false ? 'on' : ''}" id="sw-animations" aria-label="Анимации"></button>
                </div>
                <div class="toggle-row">
                  <div><b>Запускавать при старте системы</b><small>Автоматический запуск лаунчера при входе в операционную систему.</small></div>
                  <button class="switch ${s.startWithSystem ? 'on' : ''}" id="sw-start-system" aria-label="Автозапуск"></button>
                </div>
                <div class="toggle-row">
                  <div><b>Сворачивать в трей</b><small>Сворачивать лаунчер при закрытии вместо полного выхода.</small></div>
                  <button class="switch ${s.minimizeToTray ? 'on' : ''}" id="sw-minimize-tray" aria-label="Сворачивать в трей"></button>
                </div>
              </div>
            </section>
          </div>

          <div class="settings-footer-actions">
            <button class="btn primary" id="save-all-settings">Сохранить настройки</button>
            <button class="btn outline" id="open-game-folder">Открыть папку игры</button>
            <button class="btn ghost" id="reset-settings">Сбросить настройки</button>
          </div>
        </div>
      </div>
    `;

    this.bindStaticActions();
    this.bindSwitch('sw-auto-updates');
    this.bindSwitch('sw-verify');
    this.bindSwitch('sw-animations');
    this.bindSwitch('sw-start-system');
    this.bindSwitch('sw-minimize-tray');

    const heap = document.getElementById('set-heap');
    if (heap) heap.oninput = () => {
      const value = Math.round(Number(heap.value) / 1024);
      const el = document.getElementById('heap-value');
      if (el) el.textContent = `${value} GB`;
    };

    // Bind real-time search functionality
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        c.querySelectorAll('.settings-section').forEach(sec => {
          let sectionHasMatch = false;
          sec.querySelectorAll('.form-row, .toggle-row, .settings-memory-wrap').forEach(row => {
            const text = row.textContent.toLowerCase();
            const match = text.includes(query);
            row.style.display = match ? (row.classList.contains('toggle-row') ? 'flex' : 'block') : 'none';
            if (match) sectionHasMatch = true;
          });
          sec.style.display = sectionHasMatch ? 'block' : 'none';
        });
      };
    }
    this.bindAutoSave();
  },

  async load() {
    this.settings = await window.api.invoke('settings:get');
    return this.settings;
  },

  async save(key, value, silent = false) {
    await window.api.invoke('settings:set', key, value);
    this.settings = await window.api.invoke('settings:get');
    if (!silent) Toast.success('Сохранено');
  },

  bindSwitch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = () => el.classList.toggle('on');
  },

  isSwitchOn(id) {
    const el = document.getElementById(id);
    return Boolean(el && el.classList.contains('on'));
  },

  bindAutoSave() {
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const save = document.getElementById('save-all-settings');
        if (!save) return;
        this._autoSaving = true;
        save.click();
      }, 350);
    };
    document.querySelectorAll('.settings-view input:not(#settings-search), .settings-view select, .settings-view textarea').forEach(el => {
      el.addEventListener(el.matches('select') ? 'change' : 'input', schedule);
    });
    ['sw-auto-updates', 'sw-verify', 'sw-animations', 'sw-start-system', 'sw-minimize-tray'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', schedule);
    });
  },

  async bindStaticActions() {
    const pickJava = document.getElementById('pick-java');
    if (pickJava) pickJava.onclick = async () => {
      const paths = await window.api.dialog.openFile({ title: 'Выберите Java', properties: ['openFile'] });
      if (paths && paths[0]) document.getElementById('set-java-path').value = paths[0];
    };

    const pickGame = document.getElementById('pick-game-folder');
    if (pickGame) pickGame.onclick = async () => {
      const paths = await window.api.dialog.openFile({ title: 'Выберите папку игры', properties: ['openDirectory'] });
      if (paths && paths[0]) document.getElementById('set-game-folder').value = paths[0];
    };

    const pickModpacks = document.getElementById('pick-modpacks-folder');
    if (pickModpacks) pickModpacks.onclick = async () => {
      const paths = await window.api.dialog.openFile({ title: 'Выберите папку модпаков', properties: ['openDirectory'] });
      if (paths && paths[0]) document.getElementById('set-modpacks-folder').value = paths[0];
    };

    const manageAccounts = document.getElementById('settings-manage-accounts');
    if (manageAccounts) manageAccounts.onclick = () => window.App.navigate('accounts');

    const openLog = document.getElementById('settings-open-log');
    if (openLog) openLog.onclick = async () => {
      await window.api.invoke('settings:open-logs');
      Toast.success('Лог открыт');
    };

    const clearCache = document.getElementById('settings-clear-cache');
    if (clearCache) clearCache.onclick = async () => {
      const result = await window.api.invoke('settings:clear-cache');
      const count = result && Array.isArray(result.cleared) ? result.cleared.length : 0;
      Toast.success('Кэш очищен', count ? `Удалено папок: ${count}` : 'Нечего очищать');
    };

    const openGameFolder = document.getElementById('open-game-folder');
    if (openGameFolder) openGameFolder.onclick = async () => {
      const gameFolder = document.getElementById('set-game-folder').value.trim();
      await window.api.shell.openPath(gameFolder);
    };

    const openModpacksFolder = document.getElementById('open-modpacks-folder');
    if (openModpacksFolder) openModpacksFolder.onclick = async () => {
      const modpacksFolder = document.getElementById('set-modpacks-folder').value.trim();
      await window.api.shell.openPath(modpacksFolder);
    };

    const openDownloadManager = document.getElementById('open-download-manager');
    if (openDownloadManager) openDownloadManager.onclick = () => {
      // Toggle or show right-panel downloads panel
      const panel = document.getElementById('downloads-panel');
      if (panel) {
        Toast.info('Менеджер загрузок отображается на правой панели');
      }
    };

    const saveAll = document.getElementById('save-all-settings');
    if (saveAll) saveAll.onclick = async () => {
      try {
        const javaPath = document.getElementById('set-java-path').value.trim();
        const java = {
          ...(this.settings.java || {}),
          path: javaPath || null,
          maxHeap: Number(document.getElementById('set-heap').value),
          minHeap: Math.min(1024, Number(document.getElementById('set-heap').value)),
          jvmArgs: document.getElementById('set-jvm-args').value.trim(),
          jvmPreset: document.getElementById('set-jvm-preset').value
        };

        await this.save('java', java, true);
        await this.save('gameFolder', document.getElementById('set-game-folder').value.trim(), true);
        await this.save('skinSystem', document.getElementById('set-skin-system').value, true);
        await this.save('autoUpdates', this.isSwitchOn('sw-auto-updates'), true);
        await this.save('verifyOnLaunch', this.isSwitchOn('sw-verify'), true);

        await this.save('downloadThreads', Number(document.getElementById('set-threads').value), true);
        await this.save('networkTimeout', Number(document.getElementById('set-timeout').value), true);
        await this.save('modpacksFolder', document.getElementById('set-modpacks-folder').value.trim(), true);

        await this.save('theme', document.getElementById('set-theme').value, true);
        await this.save('animations', this.isSwitchOn('sw-animations'), true);
        await this.save('startWithSystem', this.isSwitchOn('sw-start-system'), true);
        await this.save('minimizeToTray', this.isSwitchOn('sw-minimize-tray'), true);

        await window.App.applyRuntimeSettings(this.settings);
        if (!this._autoSaving) Toast.success('Настройки сохранены');
        this._autoSaving = false;
      } catch (e) {
        this._autoSaving = false;
        Toast.error('Не удалось сохранить настройки', e.message || String(e));
      }
    };

    const reset = document.getElementById('reset-settings');
    if (reset) reset.onclick = async () => {
      const applyReset = async () => {
        await window.api.invoke('settings:reset');
        await this.renderAsync();
        await window.App.applyRuntimeSettings();
        Toast.success('Настройки сброшены');
      };

      if (window.Modal && Modal.confirm) {
        Modal.confirm({
          title: 'Сбросить настройки?',
          message: 'Все параметры будут возвращены к значениям по умолчанию.',
          okText: 'Сбросить',
          cancelText: 'Отмена',
          onOk: applyReset
        });
      } else if (window.confirm('Сбросить все настройки к значениям по умолчанию?')) {
        await applyReset();
      }
    };
  },

  destroy() {}
};
