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

    const sysInfo = await window.api.invoke('system:get-info').catch(() => null);
    const totalRamMb = (sysInfo && sysInfo.totalRamMb) || 8192;
    const installedRamGb = (sysInfo && sysInfo.installedRamGb) || Math.round(totalRamMb / 1024);
    const totalRamGb = installedRamGb;
    const freeRamGb = sysInfo ? (sysInfo.freeRamMb / 1024).toFixed(1) : '?';
    const cpuModel = (sysInfo && sysInfo.cpuModel) || '';
    const cpuThreads = (sysInfo && sysInfo.cpuThreads) || 4;
    const recommendedRamMb = (sysInfo && sysInfo.recommendedRamMb) || (installedRamGb <= 4 ? 2048 : installedRamGb <= 8 ? 4096 : 6144);
    const recommendedThreads = (sysInfo && sysInfo.recommendedThreads) || cpuThreads;

    const defaultThreadList = [2, 4, 6, 8, 12, 16, 24, 32];
    if (!defaultThreadList.includes(cpuThreads)) defaultThreadList.push(cpuThreads);
    defaultThreadList.sort((a, b) => a - b);

    const heapMb = Math.min(totalRamMb, Number((s.java && s.java.maxHeap) || recommendedRamMb));
    const heapGb = (heapMb / 1024).toFixed(1).replace(/\.0$/, '');
    const accountLabel = active ? Shared.providerLabel(active) : 'Аккаунт не выбран';

    this._totalRamMb = totalRamMb;
    this._totalRamGb = totalRamGb;
    this._recommendedRamMb = recommendedRamMb;
    this._recommendedThreads = recommendedThreads;

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
                    <option value="ely" ${s.skinSystem === 'ely' ? 'selected' : ''}>Ely.by (Скины и плащи)</option>
                    <option value="tlauncher" ${s.skinSystem === 'tlauncher' ? 'selected' : ''}>TLauncher (Скины и плащи)</option>
                    <option value="both" ${s.skinSystem === 'both' ? 'selected' : ''}>Оба (Ely.by + TLauncher)</option>
                    <option value="none" ${s.skinSystem === 'none' ? 'selected' : ''}>Отключено (Не устанавливать моды)</option>
                  </select>
                  <small>Влияет на загрузку мода скинов при установке и запуске версий.</small>
                </label>

                <label class="form-row">
                  <span>Графический процессор (GPU / CPU)</span>
                  <select class="select" id="set-gpu-preference">
                    <option value="dedicated" ${(s.gpuPreference || 'dedicated') === 'dedicated' ? 'selected' : ''}>Дискретная видеокарта (GPU, максимальная производительность)</option>
                    <option value="integrated" ${s.gpuPreference === 'integrated' ? 'selected' : ''}>Интегрированная графика / Процессор (CPU)</option>
                    <option value="auto" ${s.gpuPreference === 'auto' ? 'selected' : ''}>Автовыбор системы</option>
                  </select>
                  <small>Выбор графического адаптера для запуска Minecraft (NVIDIA, AMD, Intel).</small>
                </label>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Оптимизация Java (GC Пресет)</span>
                  <select class="select" id="set-jvm-preset">
                    <option value="default" ${(s.java && s.java.jvmPreset) === 'default' ? 'selected' : ''}>Стандартный (без GC флагов)</option>
                    <option value="g1gc" ${(s.java && s.java.jvmPreset || 'g1gc') === 'g1gc' ? 'selected' : ''}>Оптимальный G1GC (Для FPS)</option>
                    <option value="zgc" ${(s.java && s.java.jvmPreset) === 'zgc' ? 'selected' : ''}>Низкие задержки ZGC (Java 17+)</option>
                  </select>
                  <small>Автоматически настраивает сборщик мусора под вашу Java.</small>
                </label>

                <label class="form-row">
                  <span>Ручные JVM аргументы</span>
                  <input class="input" id="set-jvm-args" value="${Shared.escapeHtml((s.java && s.java.jvmArgs) || '')}" placeholder="-XX:+UseG1GC ...">
                  <small>Свои параметры Java для оптимизации работы игры.</small>
                </label>
              </div>

              <div class="form-row settings-memory-wrap">
                <div class="settings-memory-head">
                  <span>Выделяемая оперативная память <small style="color: var(--text-2); font-weight: 400;">(В ПК: ${installedRamGb} ГБ ОЗУ, свободно: ${freeRamGb} ГБ${cpuModel ? `, ${Shared.escapeHtml(cpuModel)}` : ''})</small></span>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn ghost compact-btn" id="btn-recommend-ram" title="Поставить рекомендуемый объём памяти" style="font-size: 11px; padding: 2px 8px;">Рекомендуемое (${(recommendedRamMb / 1024).toFixed(1)} ГБ)</button>
                    <b id="heap-value">${heapGb} GB</b>
                  </div>
                </div>
                <div class="range-wrap">
                  <span>1 GB</span>
                  <input type="range" min="1024" max="${totalRamMb}" step="512" value="${heapMb}" id="set-heap">
                  <span>${installedRamGb} GB</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-2); margin-top: 2px; padding: 0 4px;">
                  <span>1 ГБ</span>
                  <span>2 ГБ</span>
                  <span>4 ГБ</span>
                  ${installedRamGb >= 8 ? '<span>8 ГБ</span>' : ''}
                  ${installedRamGb >= 16 ? '<span>16 ГБ</span>' : ''}
                  ${installedRamGb >= 32 ? '<span>32 ГБ</span>' : ''}
                  <span>${installedRamGb} ГБ (Макс)</span>
                </div>
                <div id="ram-warning" style="display: none; margin-top: 8px; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500;"></div>
                <small style="margin-top: 4px; display: block; color: var(--text-2);">Объём памяти, выделяемый процессу игры. Рекомендуется ${(recommendedRamMb / 1024).toFixed(1)} ГБ для комфортной игры с модами.</small>
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
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span>Потоки загрузки <small style="color: var(--text-2); font-weight: normal;">(В ПК: ${cpuThreads} потоков CPU)</small></span>
                    <button class="btn ghost compact-btn" id="btn-recommend-threads" style="padding: 2px 8px; font-size: 11px;">Рекомендуемое (${recommendedThreads} пот.)</button>
                  </div>
                  <select class="select" id="set-threads">
                    ${defaultThreadList.map(n => `<option value="${n}" ${Number(s.downloadThreads || recommendedThreads) === n ? 'selected' : ''}>${n} потоков${n === recommendedThreads ? ` (Рекомендуется для вашего ПК · ${cpuThreads} потоков)` : ''}</option>`).join('')}
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
                  <h2>Интерфейс и анимации</h2>
                  <p>Настройки плавностей переходов, работы с треем и поведения окна лаунчера. Выбор и настройка тем перенесены во вкладку «Темы».</p>
                </div>
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
                <div class="toggle-row">
                  <div><b>Спрашивать имя папки при установке версии</b><small>Запрашивать индивидуальное имя каталога перед скачиванием новой версии.</small></div>
                  <button class="switch ${s.askVersionFolderName ? 'on' : ''}" id="sw-ask-folder-name" aria-label="Спрашивать имя папки"></button>
                </div>
              </div>
            </section>

            <section class="settings-section">
              <div class="settings-section-head">
                <div>
                  <h2>Консоль и логи</h2>
                  <p>Кастомизация консоли игры, шрифты и поведение журнала событий.</p>
                </div>
              </div>

              <div class="settings-two-col">
                <label class="form-row">
                  <span>Размер шрифта консоли</span>
                  <select class="select" id="set-console-font-size">
                    <option value="11" ${Number(s.consoleFontSize) === 11 ? 'selected' : ''}>11 px (Компактный)</option>
                    <option value="12" ${!s.consoleFontSize || Number(s.consoleFontSize) === 12 ? 'selected' : ''}>12 px (Стандартный)</option>
                    <option value="13" ${Number(s.consoleFontSize) === 13 ? 'selected' : ''}>13 px</option>
                    <option value="14" ${Number(s.consoleFontSize) === 14 ? 'selected' : ''}>14 px (Крупный)</option>
                    <option value="16" ${Number(s.consoleFontSize) === 16 ? 'selected' : ''}>16 px (Очень крупный)</option>
                  </select>
                  <small>Размер текста в консоли вывода процесса игры.</small>
                </label>

                <label class="form-row">
                  <span>Семейство шрифтов</span>
                  <select class="select" id="set-console-font-family">
                    <option value="monospace" ${!s.consoleFontFamily || s.consoleFontFamily === 'monospace' ? 'selected' : ''}>Системный моноширинный (Monospace)</option>
                    <option value="'JetBrains Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('JetBrains') ? 'selected' : ''}>JetBrains Mono</option>
                    <option value="'Fira Code', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Fira') ? 'selected' : ''}>Fira Code</option>
                    <option value="'Cascadia Code', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Cascadia') ? 'selected' : ''}>Cascadia Code</option>
                    <option value="'Consolas', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Consolas') ? 'selected' : ''}>Consolas</option>
                    <option value="'Source Code Pro', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Source Code') ? 'selected' : ''}>Source Code Pro</option>
                    <option value="'Roboto Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Roboto Mono') ? 'selected' : ''}>Roboto Mono</option>
                    <option value="'Ubuntu Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Ubuntu Mono') ? 'selected' : ''}>Ubuntu Mono</option>
                    <option value="'Hack', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Hack') ? 'selected' : ''}>Hack</option>
                    <option value="'Inconsolata', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Inconsolata') ? 'selected' : ''}>Inconsolata</option>
                    <option value="'Victor Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Victor Mono') ? 'selected' : ''}>Victor Mono</option>
                    <option value="'DejaVu Sans Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('DejaVu') ? 'selected' : ''}>DejaVu Sans Mono</option>
                    <option value="'Anonymous Pro', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Anonymous') ? 'selected' : ''}>Anonymous Pro</option>
                    <option value="'Liberation Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Liberation') ? 'selected' : ''}>Liberation Mono</option>
                    <option value="'Monaco', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Monaco') ? 'selected' : ''}>Monaco</option>
                    <option value="'Menlo', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Menlo') ? 'selected' : ''}>Menlo</option>
                    <option value="'Courier New', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('Courier') ? 'selected' : ''}>Courier New</option>
                    <option value="'SF Mono', monospace" ${s.consoleFontFamily && s.consoleFontFamily.includes('SF Mono') ? 'selected' : ''}>SF Mono</option>
                  </select>
                  <small>Шрифт отображения логов в окне консоли.</small>
                </label>
              </div>

              <!-- Живой предпросмотр шрифта консоли -->
              <div style="margin-top: 14px; border: 1px solid var(--border-soft); border-radius: var(--radius-sm); background: #07080a; padding: 14px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-2);">Живой предпросмотр шрифта консоли</span>
                  <span id="console-preview-badge" style="font-size: 11px; font-family: monospace; color: var(--accent);">${s.consoleFontSize || 12}px · ${(s.consoleFontFamily || 'Consolas').replace(/['"]/g, '').split(',')[0]}</span>
                </div>
                <div id="console-font-preview" style="font-family: ${s.consoleFontFamily || "'Consolas', monospace"}; font-size: ${s.consoleFontSize || 12}px; line-height: 1.5; color: #cdd6f4; user-select: text; white-space: pre-wrap; word-break: break-all;">
<span style="color: #6c7086;">[17:42:01] [Client thread/INFO] [Minecraft/Minecraft]:</span> Starting Nexus Launcher client
<span style="color: #a6e3a1;">[17:42:02] [Client thread/INFO] [Minecraft/Minecraft]:</span> Setting user: <span style="color: #89b4fa;">${Shared.escapeHtml(active ? active.nickname : 'Player')}</span>
<span style="color: #f9e2af;">[17:42:03] [Client thread/WARN] [OptiFine]:</span> Custom textures and shaders initialized
<span style="color: #94e2d5;">[17:42:04] [Render thread/INFO] [Minecraft/Minecraft]:</span> OpenGL 4.6 (${cpuModel ? Shared.escapeHtml(cpuModel.split(' ')[0]) : 'GPU'}) initialized</div>
              </div>

              <div class="toggle-list settings-toggle-list">
                <div class="toggle-row">
                  <div><b>Автопрокрутка консоли</b><small>Автоматически скроллить вниз при появлении новых строк в логе Minecraft.</small></div>
                  <button class="switch ${s.consoleAutoScroll !== false ? 'on' : ''}" id="sw-console-autoscroll" aria-label="Автопрокрутка"></button>
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
    this.bindSwitch('sw-console-autoscroll');

    const updateRamWarning = (valMb) => {
      const warningEl = document.getElementById('ram-warning');
      if (!warningEl) return;
      const pct = (valMb / totalRamMb) * 100;
      if (pct > 85) {
        warningEl.style.display = 'block';
        warningEl.style.background = 'rgba(255, 68, 68, 0.15)';
        warningEl.style.border = '1px solid rgba(255, 68, 68, 0.4)';
        warningEl.style.color = '#ff6b6b';
        warningEl.textContent = `Критическое выделение: выбрано ${Math.round(pct)}% всей RAM ПК (${(valMb / 1024).toFixed(1)} из ${totalRamGb} ГБ). Это может вызвать сильные зависания Windows и аварийное закрытие игры!`;
      } else if (pct > 70) {
        warningEl.style.display = 'block';
        warningEl.style.background = 'rgba(255, 170, 0, 0.15)';
        warningEl.style.border = '1px solid rgba(255, 170, 0, 0.4)';
        warningEl.style.color = '#ffb84d';
        warningEl.textContent = `Внимание: выделено ${Math.round(pct)}% всей RAM ПК (${(valMb / 1024).toFixed(1)} из ${totalRamGb} ГБ). Рекомендуется оставить запас для операционной системы.`;
      } else {
        warningEl.style.display = 'none';
      }
    };

    const heap = document.getElementById('set-heap');
    if (heap) {
      heap.oninput = () => {
        const valMb = Number(heap.value);
        const value = (valMb / 1024).toFixed(1).replace(/\.0$/, '');
        const el = document.getElementById('heap-value');
        if (el) el.textContent = `${value} GB`;
        updateRamWarning(valMb);
      };
      updateRamWarning(heapMb);
    }

    const btnRecommendRam = document.getElementById('btn-recommend-ram');
    if (btnRecommendRam && heap) {
      btnRecommendRam.onclick = () => {
        heap.value = this._recommendedRamMb || 4096;
        const valMb = Number(heap.value);
        const value = (valMb / 1024).toFixed(1).replace(/\.0$/, '');
        const el = document.getElementById('heap-value');
        if (el) el.textContent = `${value} GB`;
        updateRamWarning(valMb);
        Toast.info(`Установлено рекомендуемое ОЗУ: ${value} ГБ`);
      };
    }

    const btnRecommendThreads = document.getElementById('btn-recommend-threads');
    const threadsSel = document.getElementById('set-threads');
    if (btnRecommendThreads && threadsSel) {
      btnRecommendThreads.onclick = () => {
        threadsSel.value = this._recommendedThreads || 4;
        Toast.info(`Установлены рекомендуемые потоки: ${this._recommendedThreads || 4}`);
      };
    }

    const fontSizeSel = document.getElementById('set-console-font-size');
    const fontFamilySel = document.getElementById('set-console-font-family');
    const fontPreviewEl = document.getElementById('console-font-preview');
    const fontBadgeEl = document.getElementById('console-preview-badge');

    const updateFontPreview = () => {
      if (!fontPreviewEl) return;
      const sz = fontSizeSel ? fontSizeSel.value : '12';
      const fam = fontFamilySel ? fontFamilySel.value : 'monospace';
      fontPreviewEl.style.fontSize = sz + 'px';
      fontPreviewEl.style.fontFamily = fam;
      if (fontBadgeEl) {
        const cleanFam = fam.replace(/['"]/g, '').split(',')[0].trim();
        fontBadgeEl.textContent = `${sz}px · ${cleanFam}`;
      }
    };

    if (fontSizeSel) {
      fontSizeSel.addEventListener('change', updateFontPreview);
      fontSizeSel.addEventListener('input', updateFontPreview);
    }
    if (fontFamilySel) {
      fontFamilySel.addEventListener('change', updateFontPreview);
      fontFamilySel.addEventListener('input', updateFontPreview);
    }

    const themeSelect = document.getElementById('set-theme');
    const customAccentRow = document.getElementById('custom-accent-row');
    const accentColorInput = document.getElementById('set-accent-color');
    const accentHexLabel = document.getElementById('accent-hex-label');

    if (themeSelect) {
      themeSelect.onchange = () => {
        if (customAccentRow) {
          customAccentRow.style.display = themeSelect.value === 'custom' ? 'block' : 'none';
        }
        window.App.applyRuntimeSettings({
          ...this.settings,
          theme: themeSelect.value,
          customAccentColor: accentColorInput ? accentColorInput.value : null
        });
      };
    }

    if (accentColorInput) {
      accentColorInput.oninput = () => {
        if (accentHexLabel) accentHexLabel.textContent = accentColorInput.value;
        if (themeSelect && themeSelect.value === 'custom') {
          window.App.applyRuntimeSettings({
            ...this.settings,
            theme: 'custom',
            customAccentColor: accentColorInput.value
          });
        }
      };
    }

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
    ['sw-auto-updates', 'sw-verify', 'sw-animations', 'sw-start-system', 'sw-minimize-tray', 'sw-ask-folder-name', 'sw-console-autoscroll'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.onclick = () => {
          el.classList.toggle('on');
          schedule();
        };
      }
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

    const openModDir = document.getElementById('open-modpacks-folder');
    if (openModDir) openModDir.onclick = async () => {
      const f = document.getElementById('set-modpacks-folder').value.trim();
      if (f) window.api.shell.openPath(f);
    };

    const openManager = document.getElementById('open-download-manager');
    if (openManager) openManager.onclick = () => window.App.openDownloadManager();

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
        await this.save('gpuPreference', document.getElementById('set-gpu-preference').value, true);
        await this.save('autoUpdates', this.isSwitchOn('sw-auto-updates'), true);
        await this.save('verifyOnLaunch', this.isSwitchOn('sw-verify'), true);

        await this.save('downloadThreads', Number(document.getElementById('set-threads').value), true);
        await this.save('networkTimeout', Number(document.getElementById('set-timeout').value), true);
        await this.save('modpacksFolder', document.getElementById('set-modpacks-folder').value.trim(), true);

        await this.save('animations', this.isSwitchOn('sw-animations'), true);
        await this.save('startWithSystem', this.isSwitchOn('sw-start-system'), true);
        await this.save('minimizeToTray', this.isSwitchOn('sw-minimize-tray'), true);
        await this.save('askVersionFolderName', this.isSwitchOn('sw-ask-folder-name'), true);

        const consoleFontSize = document.getElementById('set-console-font-size');
        if (consoleFontSize) await this.save('consoleFontSize', Number(consoleFontSize.value), true);
        const consoleFontFamily = document.getElementById('set-console-font-family');
        if (consoleFontFamily) await this.save('consoleFontFamily', consoleFontFamily.value, true);
        await this.save('consoleAutoScroll', this.isSwitchOn('sw-console-autoscroll'), true);

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
