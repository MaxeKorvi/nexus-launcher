/* ═══ Settings View (Matching Reference Design 1-in-1) ═══ */
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

  window.Views.settings = {
    settings: null,
    activeTab: 'basic',

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

      const sysInfo = await window.api.invoke('system:get-info').catch(() => null);
      const totalRamMb = (sysInfo && sysInfo.totalRamMb) || 8192;
      const installedRamGb = (sysInfo && sysInfo.installedRamGb) || Math.round(totalRamMb / 1024);
      const cpuThreads = (sysInfo && sysInfo.cpuThreads) || 4;
      const heapMb = Math.min(totalRamMb, Number((s.java && s.java.maxHeap) || 4096));
      const heapGb = Math.round(heapMb / 1024) || 4;

      const accs = await window.api.invoke('accounts:list').catch(() => []);
      const activeAccount = (accs || []).find(a => a.active) || null;

      // Available RAM options
      const ramOptions = [2, 4, 6, 8, 12, 16, 24, 32].filter(r => r <= Math.max(8, installedRamGb));
      if (!ramOptions.includes(heapGb)) ramOptions.push(heapGb);
      ramOptions.sort((a, b) => a - b);

      c.innerHTML = `
        <style>
          .st-switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: rgba(255,255,255,0.14);
            border-radius: 12px;
            cursor: pointer;
            transition: background 200ms ease;
            flex-shrink: 0;
            user-select: none;
          }
          .st-switch.on {
            background: #3b82f6;
          }
          .st-switch::after {
            content: '';
            position: absolute;
            left: 3px;
            top: 3px;
            width: 18px;
            height: 18px;
            background: #ffffff;
            border-radius: 50%;
            transition: transform 200ms ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.35);
          }
          .st-switch.on::after {
            transform: translateX(20px);
          }
          .st-tab-btn {
            background: none;
            border: none;
            padding: 7px 18px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 600;
            color: #8c9ba5;
            cursor: pointer;
            transition: all 180ms ease;
          }
          .st-tab-btn:hover {
            color: #ffffff;
            background: rgba(255,255,255,0.04);
          }
          .st-tab-btn.active {
            background: #3b82f6;
            color: #ffffff;
            font-weight: 700;
            box-shadow: 0 4px 14px rgba(59,130,246,0.35);
          }
          .st-input-row {
            display: flex;
            align-items: center;
            background: rgba(14,18,25,0.7);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 0 12px;
            height: 42px;
            gap: 10px;
            transition: border-color 180ms ease;
          }
          .st-input-row:focus-within {
            border-color: #3b82f6;
          }
          .st-input-row input, .st-input-row select {
            background: none;
            border: none;
            color: #ffffff;
            font-size: 13px;
            width: 100%;
            height: 100%;
            outline: none;
          }
          .st-input-row select option {
            background: #181d26;
            color: #ffffff;
          }
          .st-label {
            font-size: 12px;
            font-weight: 600;
            color: #8c9ba5;
            margin-bottom: 6px;
            display: block;
          }
          .st-card {
            background: rgba(18,22,30,0.65);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 14px;
            padding: 18px 20px;
          }
          .st-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 9px 0;
            border-bottom: 1px solid rgba(255,255,255,0.04);
          }
          .st-toggle-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          .st-toggle-row:first-child {
            padding-top: 0;
          }
        </style>

        <div class="view settings-view" style="padding: 24px 30px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
          <!-- Header & Sub-tabs -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.01em;">Настройки</h1>

            <!-- Sub-tabs: [Основные] [Minecraft] -->
            <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
              <button class="st-tab-btn ${this.activeTab === 'basic' ? 'active' : ''}" data-tab="basic">Основные</button>
              <button class="st-tab-btn ${this.activeTab === 'minecraft' ? 'active' : ''}" data-tab="minecraft">Minecraft</button>
            </div>
          </div>

          <!-- Dynamic Sub-Tab Content -->
          <div id="settings-tab-content" style="display: flex; flex-direction: column; gap: 20px;">
            ${this.renderTabContent(s, installedRamGb, cpuThreads, heapGb, ramOptions, activeAccount)}
          </div>

          <!-- Bottom Action Bar (Fixed across all tabs matching Reference) -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 6px;">
            <button class="btn outline" id="btn-reset-settings" style="display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 10px; font-size: 13px; font-weight: 600; background: rgba(0,0,0,0.25);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Сбросить настройки
            </button>

            <button class="btn primary" id="btn-save-settings" style="display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 24px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #3b82f6; box-shadow: 0 4px 16px rgba(59,130,246,0.4);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Сохранить
            </button>
          </div>
        </div>
      `;

      // Subtab click handling
      c.querySelectorAll('.st-tab-btn').forEach(btn => {
        btn.onclick = () => {
          this.activeTab = btn.dataset.tab;
          this.renderAsync();
        };
      });

      this.bindTabEvents(s);
    },

    renderTabContent(s, installedRamGb, cpuThreads, heapGb, ramOptions, activeAccount) {
      if (this.activeTab === 'minecraft') {
        const javaPathVal = (s.java && s.java.path) ? s.java.path : 'C:\\Program Files\\Java\\jdk-21';
        const defaultJvmArgs = '-Xmx4G -XX:+UseG1GC -XX:+ParallelRefProcEnabled';
        const jvmArgsVal = (s.java && s.java.jvmArgs) ? s.java.jvmArgs : defaultJvmArgs;

        return `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Left Column: Paths & Runtime -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label class="st-label">Папка игры (.minecraft)</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <input id="set-game-folder" value="${esc(s.gameFolder || '')}" placeholder="По умолчанию (C:\\NexusLauncher\\.minecraft)">
                  <button class="btn ghost" id="pick-game-folder" style="padding: 4px 10px; font-size: 12px;">📁</button>
                </div>
              </div>

              <div>
                <label class="st-label">Разрешение экрана в игре</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  <select id="set-resolution">
                    <option value="auto">Авто (Полноэкранный)</option>
                    <option value="1920x1080" ${s.resolution === '1920x1080' ? 'selected' : ''}>1920 x 1080 (Full HD)</option>
                    <option value="1600x900" ${s.resolution === '1600x900' ? 'selected' : ''}>1600 x 900</option>
                    <option value="1280x720" ${s.resolution === '1280x720' ? 'selected' : ''}>1280 x 720 (HD)</option>
                    <option value="854x480" ${s.resolution === '854x480' ? 'selected' : ''}>854 x 480</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="st-label">Система скинов</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                  <select id="set-skin-system">
                    <option value="elyby" ${s.skinSystem === 'elyby' || !s.skinSystem ? 'selected' : ''}>Ely.by (Рекомендуется)</option>
                    <option value="mojang" ${s.skinSystem === 'mojang' ? 'selected' : ''}>Официальная Mojang</option>
                    <option value="custom" ${s.skinSystem === 'custom' ? 'selected' : ''}>Пользовательская</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="st-label">Путь к Java</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                  <input id="set-java-path" value="${esc(javaPathVal)}" placeholder="Автоопределение Java">
                  <button class="btn ghost" id="pick-java-btn" title="Обзор" style="padding: 4px 8px; border-radius: 6px; color: #8c9ba5;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
              </div>

              <div>
                <label class="st-label">Параметры запуска (JVM)</label>
                <div class="st-input-row">
                  <input id="set-jvm-args" value="${esc(jvmArgsVal)}" style="font-family: monospace; font-size: 12px;">
                  <button class="btn ghost" id="btn-reset-jvm" style="padding: 4px 10px; font-size: 11px; font-weight: 700; color: #8c9ba5; white-space: nowrap;">
                    Сбросить
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Column: Resources & Behavior -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="st-card">
                <div style="font-size: 13px; font-weight: 750; color: #ffffff; margin-bottom: 12px;">Выделение ресурсов</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <label class="st-label" style="font-size: 11px;">Выделять памяти (RAM)</label>
                    <div class="st-input-row" style="height: 38px;">
                      <select id="set-ram">
                        ${ramOptions.map(gb => `
                          <option value="${gb}" ${gb === heapGb ? 'selected' : ''}>${gb} ГБ</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label class="st-label" style="font-size: 11px;">Количество ядер CPU</label>
                    <div class="st-input-row" style="height: 38px;">
                      <select id="set-cores">
                        <option value="auto" ${!s.cpuCores || s.cpuCores === 'auto' ? 'selected' : ''}>Авто (${cpuThreads})</option>
                        <option value="2" ${s.cpuCores === '2' ? 'selected' : ''}>2</option>
                        <option value="4" ${s.cpuCores === '4' ? 'selected' : ''}>4</option>
                        <option value="6" ${s.cpuCores === '6' ? 'selected' : ''}>6</option>
                        <option value="8" ${s.cpuCores === '8' ? 'selected' : ''}>8</option>
                        <option value="12" ${s.cpuCores === '12' ? 'selected' : ''}>12</option>
                        <option value="16" ${s.cpuCores === '16' ? 'selected' : ''}>16</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div class="st-card">
                <div style="font-size: 14px; font-weight: 750; color: #ffffff; margin-bottom: 14px;">Поведение при запуске</div>
                <div class="st-toggle-row">
                  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    Полноэкранный режим
                  </div>
                  <div class="st-switch ${s.fullscreen ? 'on' : ''}" id="sw-fullscreen"></div>
                </div>

                <div class="st-toggle-row">
                  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                    Открывать консоль логов
                  </div>
                  <div class="st-switch ${s.openConsoleOnLaunch ? 'on' : ''}" id="sw-console"></div>
                </div>

                <div class="st-toggle-row">
                  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Сворачивать в трей при запуске игры
                  </div>
                  <div class="st-switch ${s.minimizeToTray !== false ? 'on' : ''}" id="sw-tray"></div>
                </div>

                <div class="st-toggle-row">
                  <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Автоматически запускать игру при старте
                  </div>
                  <div class="st-switch ${s.autoLaunchGame ? 'on' : ''}" id="sw-auto-launch"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // Default: "Основные"
      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <!-- Left Column: Interface & Rendering -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label class="st-label">Язык лаунчера</label>
              <div class="st-input-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <select id="set-lang">
                  <option value="ru" ${!s.language || s.language === 'ru' ? 'selected' : ''}>Русский</option>
                  <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
                  <option value="ua" ${s.language === 'ua' ? 'selected' : ''}>Українська</option>
                </select>
              </div>
            </div>

            <div class="st-card">
              <div style="font-size: 14px; font-weight: 750; color: #ffffff; margin-bottom: 14px;">Интерфейс и эффекты</div>
              
              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Плавные анимации UI
                </div>
                <div class="st-switch ${s.animations !== false ? 'on' : ''}" id="sw-animations"></div>
              </div>

              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
                  Эффект матового стекла (Acrylic)
                </div>
                <div class="st-switch ${s.acrylic !== false ? 'on' : ''}" id="sw-acrylic"></div>
              </div>

              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  Прозрачный фон панелей
                </div>
                <div class="st-switch ${s.panelGlass !== false ? 'on' : ''}" id="sw-glass"></div>
              </div>
            </div>

            <!-- Рендеринг и GPU (перенесено из вкладки Графика) -->
            <div class="st-card">
              <div style="font-size: 14px; font-weight: 750; color: #ffffff; margin-bottom: 14px;">Рендеринг и видеокарта</div>
              <div>
                <label class="st-label" style="font-size: 12px;">Выбор видеокарты (GPU Preference)</label>
                <div class="st-input-row">
                  <select id="set-gpu">
                    <option value="auto">Автовыбор (Рекомендуется)</option>
                    <option value="discrete" ${s.gpuPreference === 'discrete' ? 'selected' : ''}>Дискретная (Высокая производительность)</option>
                    <option value="integrated" ${s.gpuPreference === 'integrated' ? 'selected' : ''}>Встроенная (Энергосбережение)</option>
                  </select>
                </div>
              </div>
              <div class="st-toggle-row" style="margin-top: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  Аппаратное ускорение видеочипом
                </div>
                <div class="st-switch ${s.hardwareAcceleration !== false ? 'on' : ''}" id="sw-hw-accel"></div>
              </div>
            </div>
          </div>

          <!-- Right Column: Network, Dependencies, System -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Сеть и скачивание -->
            <div class="st-card">
              <div style="font-size: 14px; font-weight: 750; color: #ffffff; margin-bottom: 14px;">Сеть и зависимости</div>
              
              <div>
                <label class="st-label" style="font-size: 12px;">Максимум потоков скачивания</label>
                <div class="st-input-row">
                  <select id="set-threads">
                    <option value="4" ${s.downloadThreads == 4 ? 'selected' : ''}>4 потока</option>
                    <option value="8" ${s.downloadThreads == 8 ? 'selected' : ''}>8 потоков</option>
                    <option value="16" ${s.downloadThreads == 16 || !s.downloadThreads ? 'selected' : ''}>16 потоков (Рекомендуется)</option>
                    <option value="32" ${s.downloadThreads == 32 ? 'selected' : ''}>32 потока (Максимум)</option>
                    <option value="2" ${s.downloadThreads == 2 ? 'selected' : ''}>2 потока (Ограниченный интернет)</option>
                  </select>
                </div>
              </div>

              <div class="st-toggle-row" style="margin-top: 14px;">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Проверять зависимости и целостность файлов
                </div>
                <div class="st-switch ${s.verifyMods !== false ? 'on' : ''}" id="sw-verify-mods"></div>
              </div>

              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  Проверять обновления при запуске
                </div>
                <div class="st-switch ${s.autoUpdates !== false ? 'on' : ''}" id="sw-auto-updates"></div>
              </div>

              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Показывать системные уведомления
                </div>
                <div class="st-switch ${s.notifications !== false ? 'on' : ''}" id="sw-notifications"></div>
              </div>

              <div class="st-toggle-row">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #cfd8dc;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c9ba5" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  Включить оверлей лаунчера
                </div>
                <div class="st-switch ${s.overlay ? 'on' : ''}" id="sw-overlay"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    bindTabEvents(s) {
      const c = document.getElementById('view-container');

      // Switches click with real-time feedback
      c.querySelectorAll('.st-switch').forEach(sw => {
        sw.onclick = () => {
          sw.classList.toggle('on');
          const isOn = sw.classList.contains('on');

          if (sw.id === 'sw-animations') {
            document.body.classList.toggle('no-animations', !isOn);
            this.save('animations', isOn, true);
          } else if (sw.id === 'sw-acrylic') {
            document.body.classList.toggle('theme-acrylic', isOn);
            this.save('acrylic', isOn, true);
          } else if (sw.id === 'sw-glass') {
            document.body.classList.toggle('glass-style', isOn);
            this.save('panelGlass', isOn, true);
          } else if (sw.id === 'sw-tray') {
            this.save('minimizeToTray', isOn, true);
          }
        };
      });

      // Java browser button
      const pickJava = document.getElementById('pick-java-btn');
      if (pickJava) {
        pickJava.onclick = async () => {
          const res = await window.api.dialog.openFile({
            title: 'Выберите java.exe',
            properties: ['openFile'],
            filters: [{ name: 'Java Executable', extensions: ['exe'] }, { name: 'All Files', extensions: ['*'] }]
          });
          if (res && res[0]) {
            document.getElementById('set-java-path').value = res[0];
          }
        };
      }

      // Reset JVM button
      const resetJvm = document.getElementById('btn-reset-jvm');
      if (resetJvm) {
        resetJvm.onclick = () => {
          document.getElementById('set-jvm-args').value = '-Xmx4G -XX:+UseG1GC -XX:+ParallelRefProcEnabled';
          Toast.info('JVM аргументы сброшены к рекомендованным');
        };
      }

      // Game folder picker
      const pickGame = document.getElementById('pick-game-folder');
      if (pickGame) {
        pickGame.onclick = async () => {
          const res = await window.api.dialog.openFile({
            title: 'Выберите папку игры',
            properties: ['openDirectory']
          });
          if (res && res[0]) {
            document.getElementById('set-game-folder').value = res[0];
          }
        };
      }

      // Save button
      const saveBtn = document.getElementById('btn-save-settings');
      if (saveBtn) {
        saveBtn.onclick = async () => {
          await this.saveCurrentSettings();
        };
      }

      // Reset all settings button
      const resetBtn = document.getElementById('btn-reset-settings');
      if (resetBtn) {
        resetBtn.onclick = async () => {
          if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
            await window.api.invoke('settings:reset');
            await this.renderAsync();
            await window.App.applyRuntimeSettings();
            Toast.success('Настройки сброшены к исходным');
          }
        };
      }
    },

    async saveCurrentSettings() {
      try {
        const s = this.settings || {};

        // Minecraft settings
        const javaInput = document.getElementById('set-java-path');
        const jvmArgsInput = document.getElementById('set-jvm-args');
        const ramSelect = document.getElementById('set-ram');
        const coresSelect = document.getElementById('set-cores');
        const gameFolder = document.getElementById('set-game-folder');
        const resSelect = document.getElementById('set-resolution');
        const skinSys = document.getElementById('set-skin-system');

        if (javaInput || ramSelect || jvmArgsInput) {
          const ramGb = Number(ramSelect?.value) || 4;
          const java = {
            ...(s.java || {}),
            path: javaInput ? javaInput.value.trim() || null : s.java?.path || null,
            maxHeap: ramGb * 1024,
            minHeap: Math.min(1024, ramGb * 1024),
            jvmArgs: jvmArgsInput ? jvmArgsInput.value.trim() : (s.java?.jvmArgs || '')
          };
          await this.save('java', java, true);
        }

        if (coresSelect) await this.save('cpuCores', coresSelect.value, true);
        if (gameFolder) await this.save('gameFolder', gameFolder.value.trim(), true);
        if (resSelect) await this.save('resolution', resSelect.value, true);
        if (skinSys) await this.save('skinSystem', skinSys.value, true);

        const swFull = document.getElementById('sw-fullscreen');
        if (swFull) await this.save('fullscreen', swFull.classList.contains('on'), true);

        const swConsole = document.getElementById('sw-console');
        if (swConsole) await this.save('openConsoleOnLaunch', swConsole.classList.contains('on'), true);

        const swTray = document.getElementById('sw-tray');
        if (swTray) await this.save('minimizeToTray', swTray.classList.contains('on'), true);

        const swAutoLaunch = document.getElementById('sw-auto-launch');
        if (swAutoLaunch) await this.save('autoLaunchGame', swAutoLaunch.classList.contains('on'), true);

        // Basic settings
        const langSelect = document.getElementById('set-lang');
        if (langSelect) await this.save('language', langSelect.value, true);

        const swAnim = document.getElementById('sw-animations');
        if (swAnim) {
          const isOn = swAnim.classList.contains('on');
          await this.save('animations', isOn, true);
          document.body.classList.toggle('no-animations', !isOn);
        }

        const swAcrylic = document.getElementById('sw-acrylic');
        if (swAcrylic) await this.save('acrylic', swAcrylic.classList.contains('on'), true);

        const swGlass = document.getElementById('sw-glass');
        if (swGlass) await this.save('panelGlass', swGlass.classList.contains('on'), true);

        const gpuSel = document.getElementById('set-gpu');
        if (gpuSel) await this.save('gpuPreference', gpuSel.value, true);

        const swHw = document.getElementById('sw-hw-accel');
        if (swHw) await this.save('hardwareAcceleration', swHw.classList.contains('on'), true);

        const threadsSel = document.getElementById('set-threads');
        if (threadsSel) await this.save('downloadThreads', Number(threadsSel.value), true);

        const swVerifyMods = document.getElementById('sw-verify-mods');
        if (swVerifyMods) await this.save('verifyMods', swVerifyMods.classList.contains('on'), true);

        const swAutoUpdates = document.getElementById('sw-auto-updates');
        if (swAutoUpdates) await this.save('autoUpdates', swAutoUpdates.classList.contains('on'), true);

        const swNotifs = document.getElementById('sw-notifications');
        if (swNotifs) await this.save('notifications', swNotifs.classList.contains('on'), true);

        const swOverlay = document.getElementById('sw-overlay');
        if (swOverlay) await this.save('overlay', swOverlay.classList.contains('on'), true);

        await window.App.applyRuntimeSettings(this.settings);
        Toast.success('Настройки успешно сохранены');
      } catch (err) {
        Toast.error('Не удалось сохранить настройки', err.message || String(err));
      }
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

    destroy() {}
  };
})();
