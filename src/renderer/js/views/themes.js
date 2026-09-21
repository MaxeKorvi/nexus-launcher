/* ═══ Themes view (Темы и Оформление — Concept 2026.1.2) ═══ */
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

  const PRESETS = [
    {
      id: 'valley',
      name: 'Солнечная долина',
      description: 'Солнечные холмы, луговые цветы и чистые реки Minecraft.',
      accent: '#10b981',
      accentHi: '#34d399',
      bg: '#050d09',
      card: 'rgba(10, 26, 17, 0.85)',
      text: '#f0fdf4',
      image: 'assets/backgrounds/bg-valley.png'
    },
    {
      id: 'sakura',
      name: 'Цветущая сакура',
      description: 'Розовые лепестки сакуры, нежный рассвет и горное озеро.',
      accent: '#f472b6',
      accentHi: '#fb7185',
      bg: '#0d050a',
      card: 'rgba(28, 12, 22, 0.85)',
      text: '#fdf2f8',
      image: 'assets/backgrounds/bg-sakura.png'
    },
    {
      id: 'forge',
      name: 'Лавовая кузня',
      description: 'Подземные механизмы, рельсы, шестерни и потоки раскалённой лавы.',
      accent: '#f43f5e',
      accentHi: '#fb7185',
      bg: '#0d0407',
      card: 'rgba(28, 8, 16, 0.85)',
      text: '#fff1f2',
      image: 'assets/backgrounds/bg-forge.png'
    },
    {
      id: 'aurora',
      name: 'Северное сияние',
      description: 'Магическое полярное сияние над заснеженной тайгой и ледяным озером.',
      accent: '#06b6d4',
      accentHi: '#22d3ee',
      bg: '#030a12',
      card: 'rgba(8, 22, 36, 0.85)',
      text: '#ecfeff',
      image: 'assets/backgrounds/bg-aurora.png'
    },
    {
      id: 'end',
      name: 'Владыка Края',
      description: 'Таинственные обсидиановые башни, эндермены и парящий Дракон Края.',
      accent: '#a855f7',
      accentHi: '#c084fc',
      bg: '#080312',
      card: 'rgba(18, 8, 36, 0.85)',
      text: '#faf5ff',
      image: 'assets/backgrounds/bg-end.png'
    },
    {
      id: 'desert',
      name: 'Песчаный храм',
      description: 'Золотые барханы, древняя пирамида в лучах заходящего солнца.',
      accent: '#f59e0b',
      accentHi: '#fbbf24',
      bg: '#0f0a03',
      card: 'rgba(32, 20, 6, 0.85)',
      text: '#fffbeb',
      image: 'assets/backgrounds/bg-desert.png'
    },
    {
      id: 'bastion',
      name: 'Бастион Незера',
      description: 'Огненная цитадель Нижнего мира, мосты над лавовым океаном и гасты.',
      accent: '#f97316',
      accentHi: '#fb923c',
      bg: '#0f0502',
      card: 'rgba(34, 12, 6, 0.85)',
      text: '#fff7ed',
      image: 'assets/backgrounds/bg-bastion.png'
    },
    {
      id: 'skylands',
      name: 'Парящие острова',
      description: 'Небесные острова в облаках, водопады, замки и тёплое солнце.',
      accent: '#38bdf8',
      accentHi: '#60a5fa',
      bg: '#040b14',
      card: 'rgba(10, 24, 42, 0.85)',
      text: '#f0f9ff',
      image: 'assets/backgrounds/bg-skylands.png'
    }
  ];

  const BACKGROUND_PRESETS = [
    { name: 'Солнечная долина', image: 'assets/backgrounds/bg-valley.png' },
    { name: 'Цветущая сакура', image: 'assets/backgrounds/bg-sakura.png' },
    { name: 'Лавовая кузня', image: 'assets/backgrounds/bg-forge.png' },
    { name: 'Северное сияние', image: 'assets/backgrounds/bg-aurora.png' },
    { name: 'Владыка Края', image: 'assets/backgrounds/bg-end.png' },
    { name: 'Песчаный храм', image: 'assets/backgrounds/bg-desert.png' },
    { name: 'Бастион Незера', image: 'assets/backgrounds/bg-bastion.png' },
    { name: 'Парящие острова', image: 'assets/backgrounds/bg-skylands.png' }
  ];

  const ACCENT_SWATCHES = [
    { hex: '#00e676', name: 'Изумруд Nexus' },
    { hex: '#10b981', name: 'Мятный бор' },
    { hex: '#06b6d4', name: 'Неоновый циан' },
    { hex: '#38bdf8', name: 'Ледяной синий' },
    { hex: '#3b82f6', name: 'Лазурит' },
    { hex: '#6366f1', name: 'Космический индиго' },
    { hex: '#a855f7', name: 'Сумеречный аметист' },
    { hex: '#d946ef', name: 'Маджента' },
    { hex: '#ec4899', name: 'Розовый кварц' },
    { hex: '#ef4444', name: 'Красный редстоун' },
    { hex: '#f97316', name: 'Огненный рассвет' },
    { hex: '#f59e0b', name: 'Янтарь' },
    { hex: '#eab308', name: 'Золото' },
    { hex: '#84cc16', name: 'Лайм' }
  ];

  window.Views.themes = {
    currentTab: 'ready',
    selectedPreset: 'emerald',
    currentAccent: '#00e676',
    currentBg: '#040906',
    currentCard: 'rgba(8, 20, 14, 0.85)',
    currentText: '#f0fdf4',
    customThemeName: 'Мой авторский стиль',
    interfaceStyle: 'standard', // standard | glass | matte
    libraryViewMode: 'cards',   // cards | list
    animationsEnabled: true,
    glowEnabled: true,

    async render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      const mainContent = document.querySelector('main.content');
      if (mainContent) {
        mainContent.style.display = 'grid';
        mainContent.classList.add('view-mode');
      }
      if (home) home.style.display = 'none';
      c.style.display = 'block';

      const s = await window.api.invoke('settings:get').catch(() => ({}));
      this.selectedPreset = s.theme || 'emerald';
      if (!PRESETS.some(p => p.id === this.selectedPreset) && this.selectedPreset !== 'custom') {
        this.selectedPreset = 'emerald';
      }

      const curPreset = PRESETS.find(p => p.id === this.selectedPreset) || PRESETS[0];
      const ct = s.customTheme || {};
      this.currentAccent = (s.customAccentColor) || ct.accent || curPreset.accent;
      this.currentBg = ct.bg || curPreset.bg || '#040906';
      this.currentCard = ct.card || curPreset.card || 'rgba(8, 20, 14, 0.85)';
      this.currentText = ct.text || curPreset.text || '#f0fdf4';
      this.customThemeName = ct.name || 'Мой авторский стиль';

      this.animationsEnabled = s.animations !== false;
      this.glowEnabled = s.glowEffects !== false;
      this.interfaceStyle = s.interfaceStyle || 'standard';
      this.libraryViewMode = s.libraryDisplayMode || 'cards';

      c.innerHTML = `
        <div class="view tm-container">
          <!-- ═══ 1. Hero Banner matching concept ═══ -->
          <div class="tm-hero">
            <div class="tm-hero-left">
              <span class="tm-hero-eyebrow">NEXUS LAUNCHER</span>
              <h1>Темы и Оформление</h1>
              <p>Сделай лаунчер своим. Выбирай, настраивай, сочетай.</p>
            </div>
            <div class="tm-hero-right">
              <button class="tm-btn-reset-default" id="tm-reset-default">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Восстановить стандартную тему
              </button>
            </div>
          </div>

          <!-- ═══ 2. Sub-nav Tabs ═══ -->
          <div class="tm-tabs">
            <button class="tm-tab ${this.currentTab === 'ready' ? 'active' : ''}" data-tab="ready">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Готовые темы
            </button>
            <button class="tm-tab ${this.currentTab === 'personal' ? 'active' : ''}" data-tab="personal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              Персонализация (Своя тема)
            </button>
            <button class="tm-tab ${this.currentTab === 'bg' ? 'active' : ''}" data-tab="bg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              Фон и атмосфера
            </button>
          </div>

          <!-- ═══ 3. Active Tab Content ═══ -->
          <div id="tm-tab-content"></div>
        </div>
      `;

      this.renderTabContent();
      this.bindTabHeaders();
    },

    bindTabHeaders() {
      const resetBtn = document.getElementById('tm-reset-default');
      if (resetBtn) {
        resetBtn.onclick = () => this.applyPreset('emerald');
      }

      document.querySelectorAll('.tm-tab[data-tab]').forEach(tab => {
        tab.onclick = () => {
          this.currentTab = tab.dataset.tab;
          document.querySelectorAll('.tm-tab').forEach(x => x.classList.remove('active'));
          tab.classList.add('active');
          this.renderTabContent();
        };
      });
    },

    renderTabContent() {
      const container = document.getElementById('tm-tab-content');
      if (!container) return;

      const current = PRESETS.find(p => p.id === this.selectedPreset) || PRESETS[0];

      if (this.currentTab === 'personal') {
        container.innerHTML = `
          <div class="tm-split-grid">
            <!-- Left: Custom Theme Palette Builder -->
            <section class="tm-collection-card">
              <div class="tm-collection-head">
                <div>
                  <h2>Конструктор своей темы</h2>
                  <p>Настраивай цвета палитры. Все изменения отображаются в лаунчере в реальном времени.</p>
                </div>
              </div>

              <div class="tm-custom-builder">
                <div>
                  <label style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 6px; display: block;">Название темы</label>
                  <input type="text" class="tm-custom-name-input" id="tm-custom-name" value="${esc(this.customThemeName)}" placeholder="Моя авторская тема">
                </div>

                <!-- 1. Accent color -->
                <div class="tm-color-row">
                  <label>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--accent);"></span>
                    Цвет акцента (кнопки, бейджи, свечение)
                  </label>
                  <div class="tm-color-picker-wrap">
                    <input type="text" class="tm-color-hex-input" id="tm-hex-accent" value="${this.currentAccent}" style="width: 80px; padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-family: monospace; text-transform: uppercase;">
                    <input type="color" id="tm-picker-accent" value="${this.ensureHex(this.currentAccent, '#00e676')}">
                  </div>
                </div>

                <!-- 2. Background color -->
                <div class="tm-color-row">
                  <label>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--bg);border:1px solid rgba(255,255,255,0.2);"></span>
                    Цвет фона лаунчера
                  </label>
                  <div class="tm-color-picker-wrap">
                    <input type="text" class="tm-color-hex-input" id="tm-hex-bg" value="${this.currentBg}" style="width: 80px; padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-family: monospace; text-transform: uppercase;">
                    <input type="color" id="tm-picker-bg" value="${this.ensureHex(this.currentBg, '#040906')}">
                  </div>
                </div>

                <!-- 3. Card color -->
                <div class="tm-color-row">
                  <label>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--card);border:1px solid rgba(255,255,255,0.2);"></span>
                    Цвет карточек и списков
                  </label>
                  <div class="tm-color-picker-wrap">
                    <input type="text" class="tm-color-hex-input" id="tm-hex-card" value="${this.currentCard}" style="width: 80px; padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-family: monospace; text-transform: uppercase;">
                    <input type="color" id="tm-picker-card" value="${this.ensureHex(this.currentCard, '#08140e')}">
                  </div>
                </div>

                <!-- 4. Text color -->
                <div class="tm-color-row">
                  <label>
                    <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--text);border:1px solid rgba(0,0,0,0.5);"></span>
                    Цвет основного текста
                  </label>
                  <div class="tm-color-picker-wrap">
                    <input type="text" class="tm-color-hex-input" id="tm-hex-text" value="${this.currentText}" style="width: 80px; padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-family: monospace; text-transform: uppercase;">
                    <input type="color" id="tm-picker-text" value="${this.ensureHex(this.currentText, '#f0fdf4')}">
                  </div>
                </div>

                <div class="tm-custom-actions">
                  <button class="btn primary" id="tm-btn-save-custom" style="flex:1; padding: 10px 16px; font-weight:800;">
                    ✓ Сохранить и применить тему
                  </button>
                  <button class="btn outline" id="tm-btn-reset-custom" style="padding: 10px 16px;">
                    Сбросить
                  </button>
                </div>
              </div>
            </section>

            <!-- Right: Interactive Live Preview & Options -->
            <section class="tm-settings-card">
              ${this.renderPreviewCardHtml(current)}
            </section>
          </div>
        `;

        this.bindPersonalEvents();
        this.bindRightCardEvents();
        return;
      }

      if (this.currentTab === 'bg') {
        container.innerHTML = `
          <div class="tm-split-grid">
            <section class="tm-collection-card">
              <div class="tm-collection-head">
                <div>
                  <h2>Фон и атмосфера</h2>
                  <p>Выберите фоновые пейзажи Minecraft для лаунчера.</p>
                </div>
              </div>
              <div class="tm-cards-grid">
                ${BACKGROUND_PRESETS.map(p => `
                  <div class="tm-preset-card" data-bg-img="${p.image}">
                    <div class="tm-card-preview-art" style="background-image: url('${p.image}');"></div>
                    <div class="tm-preset-title">${esc(p.name)}</div>
                  </div>
                `).join('')}
              </div>
            </section>
            <section class="tm-settings-card">
              ${this.renderPreviewCardHtml(current)}
            </section>
          </div>
        `;
        document.querySelectorAll('[data-bg-img]').forEach(card => {
          card.onclick = async () => {
            const url = card.dataset.bgImg;
            const mock = document.getElementById('tm-mockup');
            if (mock) {
              const b = mock.querySelector('.tm-mock-banner');
              if (b) b.style.backgroundImage = `url('${url}')`;
            }
            await this.applyBackground(url);
            Toast.success('Фон обновлён!', 'Пейзаж применён в лаунчере');
          };
        });
        this.bindRightCardEvents();
        return;
      }

      // Default: "ready"
      container.innerHTML = `
        <div class="tm-split-grid">
          <!-- Left: Collection of themes -->
          <section class="tm-collection-card">
            <div class="tm-collection-head">
              <div>
                <h2>Коллекция тем</h2>
                <p>Готовые стили, вдохновленные Minecraft и не только. Выбери атмосферу под своё настроение.</p>
              </div>
              <span class="tm-link-all">Всего тем: ${PRESETS.length}</span>
            </div>

            <div class="tm-cards-grid">
              ${PRESETS.map(p => {
                const isActive = this.selectedPreset === p.id;
                return `
                  <div class="tm-preset-card ${isActive ? 'active' : ''}" data-preset-id="${p.id}">
                    <div class="tm-card-preview-art" style="background-image: url('${p.image}');">
                      <div class="tm-check-indicator">
                        ${isActive ? '✓' : ''}
                      </div>
                    </div>
                    <div class="tm-preset-title">${esc(p.name)}</div>
                    <div class="tm-preset-desc">${esc(p.description)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <!-- Right: Preview & Settings -->
          <section class="tm-settings-card">
            ${this.renderPreviewCardHtml(current)}
          </section>
        </div>
      `;

      this.bindReadyEvents();
      this.bindRightCardEvents();
    },

    renderPreviewCardHtml(current) {
      return `
        <!-- Live Miniature Mockup -->
        <div class="tm-preview-section">
          <h3>Предпросмотр</h3>
          <p>Так выглядит лаунчер в реальном времени</p>
          <div class="tm-mini-mockup" id="tm-mockup" style="border-color: ${this.currentAccent}; box-shadow: 0 0 24px ${this.currentAccent}44;">
            <div class="tm-mock-side">
              <div class="tm-mock-icon active" style="background: ${this.currentAccent}; box-shadow: 0 0 8px ${this.currentAccent};"></div>
              <div class="tm-mock-icon"></div>
              <div class="tm-mock-icon"></div>
              <div class="tm-mock-icon"></div>
            </div>
            <div class="tm-mock-body">
              <div class="tm-mock-header">
                <div class="tm-mock-logo" style="background: ${this.currentAccent};"></div>
                <span class="tm-mock-title">Nexus Launcher</span>
              </div>
              <div class="tm-mock-banner" style="background-image: url('${current.image}');">
                <span style="color: ${this.currentAccent}; text-shadow: 0 0 10px ${this.currentAccent};">Больше чем игра</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Options -->
        <div class="tm-options-section">
          <h3>Настройки темы</h3>
          
          <label style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 10px; display: block;">Быстрый выбор цвета (1 клик)</label>
          <div class="tm-swatch-group" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${ACCENT_SWATCHES.map(sw => `
              <div class="tm-swatch-circle ${this.currentAccent.toLowerCase() === sw.hex.toLowerCase() ? 'active' : ''}" data-color="${sw.hex}" title="${sw.name}" style="background: ${sw.hex};"></div>
            `).join('')}
          </div>

          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <span style="font-size: 11.5px; color: var(--text-2);">Свой HEX:</span>
            <input type="text" id="tm-quick-hex" value="${this.currentAccent}" style="width: 85px; padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-family: monospace; text-transform: uppercase;">
            <input type="color" id="tm-quick-picker" value="${this.ensureHex(this.currentAccent, '#00e676')}" style="width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; cursor: pointer;">
          </div>

          <label style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 14px; display: block;">Стиль интерфейса</label>
          <div class="tm-style-pills">
            <button class="tm-style-pill ${this.interfaceStyle === 'standard' ? 'active' : ''}" data-style="standard">Стандартный</button>
            <button class="tm-style-pill ${this.interfaceStyle === 'glass' ? 'active' : ''}" data-style="glass">Стеклянный</button>
            <button class="tm-style-pill ${this.interfaceStyle === 'matte' ? 'active' : ''}" data-style="matte">Матовый</button>
          </div>

          <label style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 14px; display: block;">Вид списков в библиотеке</label>
          <div class="tm-style-pills">
            <button class="tm-style-pill ${this.libraryViewMode === 'cards' ? 'active' : ''}" data-lib-view="cards">Карточки (концепт)</button>
            <button class="tm-style-pill ${this.libraryViewMode === 'list' ? 'active' : ''}" data-lib-view="list">Компактный список</button>
          </div>

          <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 4px;">
            <div class="tm-toggle-row">
              <span class="tm-toggle-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Анимации интерфейса
              </span>
              <button class="switch ${this.animationsEnabled ? 'on' : ''}" id="tm-sw-anim"></button>
            </div>
            <div class="tm-toggle-row">
              <span class="tm-toggle-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                Эффекты свечения
              </span>
              <button class="switch ${this.glowEnabled ? 'on' : ''}" id="tm-sw-glow"></button>
            </div>
          </div>
        </div>
      `;
    },

    bindReadyEvents() {
      // Presets click
      document.querySelectorAll('[data-preset-id]').forEach(card => {
        card.onclick = () => {
          const pid = card.dataset.presetId;
          this.applyPreset(pid);
        };
      });

      // Swatches click
      document.querySelectorAll('[data-color]').forEach(swatch => {
        swatch.onclick = () => {
          const hex = swatch.dataset.color;
          this.applyCustomAccent(hex);
        };
      });
    },

    bindPersonalEvents() {
      const pAccent = document.getElementById('tm-picker-accent');
      const pBg = document.getElementById('tm-picker-bg');
      const pCard = document.getElementById('tm-picker-card');
      const pText = document.getElementById('tm-picker-text');

      const hexAccent = document.getElementById('tm-hex-accent');
      const hexBg = document.getElementById('tm-hex-bg');
      const hexCard = document.getElementById('tm-hex-card');
      const hexText = document.getElementById('tm-hex-text');

      const updateRealtime = () => {
        if (pAccent) {
          this.currentAccent = pAccent.value;
          if (hexAccent) hexAccent.textContent = pAccent.value;
        }
        if (pBg) {
          this.currentBg = pBg.value;
          if (hexBg) hexBg.textContent = pBg.value;
        }
        if (pCard) {
          this.currentCard = pCard.value;
          if (hexCard) hexCard.textContent = pCard.value;
        }
        if (pText) {
          this.currentText = pText.value;
          if (hexText) hexText.textContent = pText.value;
        }

        this.previewFullTheme({
          accent: this.currentAccent,
          bg: this.currentBg,
          card: this.currentCard,
          text: this.currentText
        });
      };

      if (pAccent) pAccent.oninput = updateRealtime;
      if (pBg) pBg.oninput = updateRealtime;
      if (pCard) pCard.oninput = updateRealtime;
      if (pText) pText.oninput = updateRealtime;

      const bindHexInput = (hexInput, picker) => {
        if (!hexInput) return;
        hexInput.oninput = (e) => {
          const val = e.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            if (picker) picker.value = val;
            updateRealtime();
          }
        };
      };
      bindHexInput(hexAccent, pAccent);
      bindHexInput(hexBg, pBg);
      bindHexInput(hexCard, pCard);
      bindHexInput(hexText, pText);

      const saveBtn = document.getElementById('tm-btn-save-custom');
      if (saveBtn) {
        saveBtn.onclick = async () => {
          const nameInput = document.getElementById('tm-custom-name');
          const name = (nameInput && nameInput.value.trim()) || 'Моя авторская тема';
          this.customThemeName = name;

          await window.api.invoke('settings:set', {
            theme: 'custom',
            customAccentColor: this.currentAccent,
            customTheme: {
              name,
              accent: this.currentAccent,
              accentHi: this.currentAccent,
              bg: this.currentBg,
              card: this.currentCard,
              text: this.currentText
            }
          });

          if (window.App && typeof window.App.applyRuntimeSettings === 'function') {
            await window.App.applyRuntimeSettings();
          }

          Toast.success('Пользовательская тема сохранена', `Тема «${name}» активна`);
        };
      }

      const resetBtn = document.getElementById('tm-btn-reset-custom');
      if (resetBtn) {
        resetBtn.onclick = () => {
          this.applyPreset('emerald');
          this.renderTabContent();
        };
      }
    },

    bindRightCardEvents() {
      // Interface styles (standard | glass | matte)
      document.querySelectorAll('[data-style]').forEach(pill => {
        pill.onclick = async () => {
          const st = pill.dataset.style;
          this.interfaceStyle = st;
          document.querySelectorAll('[data-style]').forEach(x => x.classList.toggle('active', x.dataset.style === st));
          await window.api.invoke('settings:set', { interfaceStyle: st });
          document.body.classList.toggle('glass-style', st === 'glass');
          document.body.classList.toggle('matte-style', st === 'matte');
          
          const label = st === 'glass' ? 'Стеклянный акрил' : (st === 'matte' ? 'Матовый бархат' : 'Стандартный');
          Toast.success('Стиль интерфейса', label);
        };
      });

      // Library display mode (cards | list)
      document.querySelectorAll('[data-lib-view]').forEach(pill => {
        pill.onclick = async () => {
          const v = pill.dataset.libView;
          this.libraryViewMode = v;
          document.querySelectorAll('[data-lib-view]').forEach(x => x.classList.toggle('active', x.dataset.libView === v));
          Store.set('settings.libraryDisplayMode', v);
          await window.api.invoke('settings:set', { libraryDisplayMode: v });
          Toast.success('Библиотека', v === 'cards' ? 'Режим карточек (концепт)' : 'Компактный список');
        };
      });

      // Quick manual hex input & picker
      const qHex = document.getElementById('tm-quick-hex');
      const qPick = document.getElementById('tm-quick-picker');
      if (qHex) {
        qHex.oninput = (e) => {
          const val = e.target.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            this.applyCustomAccent(val);
            if (qPick) qPick.value = val;
          }
        };
      }
      if (qPick) {
        qPick.oninput = (e) => {
          if (qHex) qHex.value = e.target.value.toUpperCase();
          this.previewAccent(e.target.value);
        };
        qPick.onchange = (e) => {
          this.applyCustomAccent(e.target.value);
        };
      }

      // Toggle animations
      const swAnim = document.getElementById('tm-sw-anim');
      if (swAnim) {
        swAnim.onclick = async () => {
          this.animationsEnabled = !this.animationsEnabled;
          swAnim.classList.toggle('on', this.animationsEnabled);
          Store.set('settings.animations', this.animationsEnabled);
          await window.api.invoke('settings:set', { animations: this.animationsEnabled });
          document.body.classList.toggle('no-animations', !this.animationsEnabled);
          Toast.info('Анимации', this.animationsEnabled ? 'Включены' : 'Отключены');
        };
      }

      // Toggle glow
      const swGlow = document.getElementById('tm-sw-glow');
      if (swGlow) {
        swGlow.onclick = async () => {
          this.glowEnabled = !this.glowEnabled;
          swGlow.classList.toggle('on', this.glowEnabled);
          Store.set('settings.glowEffects', this.glowEnabled);
          await window.api.invoke('settings:set', { glowEffects: this.glowEnabled });
          document.body.classList.toggle('no-glow', !this.glowEnabled);
          Toast.info('Эффекты свечения', this.glowEnabled ? 'Включены' : 'Отключены');
        };
      }
    },

    previewAccent(hex) {
      this.currentAccent = hex;
      document.documentElement.style.setProperty('--accent', hex);
      document.documentElement.style.setProperty('--accent-hi', hex);
      document.documentElement.style.setProperty('--accent-glow', hex + '40');
      document.documentElement.style.setProperty('--glow', hex + '28');
      document.documentElement.style.setProperty('--shadow-glow', `0 0 34px ${hex}44`);
      this.updateMockup(hex);
    },

    previewFullTheme({ accent, bg, card, text }) {
      if (accent) {
        this.currentAccent = accent;
        document.documentElement.style.setProperty('--accent', accent);
        document.documentElement.style.setProperty('--accent-hi', accent);
        document.documentElement.style.setProperty('--accent-glow', accent + '40');
        document.documentElement.style.setProperty('--glow', accent + '28');
        document.documentElement.style.setProperty('--shadow-glow', `0 0 34px ${accent}44`);
      }
      if (bg) {
        this.currentBg = bg;
        document.documentElement.style.setProperty('--bg', bg);
      }
      if (card) {
        this.currentCard = card;
        document.documentElement.style.setProperty('--card', card);
      }
      if (text) {
        this.currentText = text;
        document.documentElement.style.setProperty('--text', text);
      }
      this.updateMockup(accent || this.currentAccent);
    },

    updateMockup(accent) {
      const mock = document.getElementById('tm-mockup');
      if (mock) {
        mock.style.borderColor = accent;
        mock.style.boxShadow = `0 0 24px ${accent}44`;
        const activeIcon = mock.querySelector('.tm-mock-icon.active');
        if (activeIcon) {
          activeIcon.style.background = accent;
          activeIcon.style.boxShadow = `0 0 8px ${accent}`;
        }
        const logo = mock.querySelector('.tm-mock-logo');
        if (logo) logo.style.background = accent;
        const banner = mock.querySelector('.tm-mock-banner');
        if (banner) {
          const span = banner.querySelector('span');
          if (span) {
            span.style.color = accent;
            span.style.textShadow = `0 0 10px ${accent}`;
          }
        }
      }
    },

    async applyPreset(presetId) {
      const p = PRESETS.find(x => x.id === presetId) || PRESETS[0];
      this.selectedPreset = p.id;
      this.currentAccent = p.accent;
      this.currentBg = p.bg;
      this.currentCard = p.card;
      this.currentText = p.text;

      this.previewFullTheme(p);

      if (p.image) {
        await this.applyBackground(p.image);
      }

      // Update selection UI
      document.querySelectorAll('.tm-preset-card').forEach(card => {
        const isThis = card.dataset.presetId === p.id;
        card.classList.toggle('active', isThis);
        const check = card.querySelector('.tm-check-indicator');
        if (check) check.textContent = isThis ? '✓' : '';
      });

      document.querySelectorAll('[data-color]').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color.toLowerCase() === p.accent.toLowerCase());
      });

      // Save in settings
      await window.api.invoke('settings:set', {
        theme: p.id,
        customAccentColor: p.accent,
        customBackground: p.image || '',
        customTheme: {
          name: p.name,
          accent: p.accent,
          accentHi: p.accentHi,
          bg: p.bg,
          card: p.card,
          text: p.text
        }
      });

      if (window.App && typeof window.App.applyRuntimeSettings === 'function') {
        await window.App.applyRuntimeSettings();
      }

      Toast.success('Тема применена', p.name);
    },

    async applyCustomAccent(hex) {
      this.previewAccent(hex);

      document.querySelectorAll('[data-color]').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color.toLowerCase() === hex.toLowerCase());
      });

      const s = await window.api.invoke('settings:get').catch(() => ({}));
      const ct = s.customTheme || {};
      ct.accent = hex;
      await window.api.invoke('settings:set', { customTheme: ct, customAccentColor: hex });
      if (window.App && typeof window.App.applyRuntimeSettings === 'function') {
        await window.App.applyRuntimeSettings();
      }
      Toast.success('Акцентный цвет', hex);
    },

    async applyBackground(url) {
      Store.set('settings.customBackground', url);
      await window.api.invoke('settings:set', 'customBackground', url);
      const centerContent = document.querySelector('.center-content');
      if (centerContent) {
        centerContent.style.backgroundImage = `linear-gradient(135deg, var(--glow), rgba(11,11,12,.76) 34%, rgba(4,4,5,.88)), url('${url}')`;
      }
      const profileCover = document.getElementById('profile-cover');
      if (profileCover) {
        profileCover.style.backgroundImage = `linear-gradient(to right, rgba(14,17,23,0.92) 20%, rgba(14,17,23,0.6) 60%, rgba(14,17,23,0.2) 100%), url('${url}')`;
      }
    },

    ensureHex(val, fallback) {
      if (!val) return fallback;
      const s = String(val).trim();
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
      if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      }
      return fallback;
    },

    destroy() {}
  };
})();
