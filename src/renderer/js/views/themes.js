/* ═══ Themes view ═══ */
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
      id: 'amoled',
      name: 'Nexus AMOLED',
      description: 'Глубокий чёрный цвет с неоновым оранжевым акцентом Nexus.',
      accent: '#ff7a00',
      bg: '#000000',
      card: 'rgba(18, 18, 19, 0.74)',
      text: '#f7f7f5'
    },
    {
      id: 'emerald',
      name: 'Изумрудный бор (Emerald)',
      description: 'Тёмно-хвойный фон и люминесцентный изумрудный неон.',
      accent: '#00ff88',
      bg: '#030d07',
      card: 'rgba(8, 24, 16, 0.75)',
      text: '#ecfdf5'
    },
    {
      id: 'sapphire',
      name: 'Сапфир Кибер (Sapphire)',
      description: 'Глубокий кобальт и синий киберпанк для любителей высоких технологий.',
      accent: '#3b82f6',
      bg: '#030814',
      card: 'rgba(10, 22, 48, 0.75)',
      text: '#f0f9ff'
    },
    {
      id: 'crimson',
      name: 'Багровый Незер (Crimson)',
      description: 'Атмосфера нижнего мира с пылающим рубиновым акцентом.',
      accent: '#ef4444',
      bg: '#090202',
      card: 'rgba(24, 10, 10, 0.75)',
      text: '#fef2f2'
    },
    {
      id: 'amber',
      name: 'Cyberpunk Amber',
      description: 'Золотой янтарь и тёмный металлик ночного мегаполиса.',
      accent: '#f59e0b',
      bg: '#0d0a04',
      card: 'rgba(30, 24, 12, 0.75)',
      text: '#fffbeb'
    },
    {
      id: 'amethyst',
      name: 'Аметистовый Неон',
      description: 'Магический фиолетовый неон и тёмные кристаллы аметиста.',
      accent: '#c084fc',
      bg: '#090412',
      card: 'rgba(26, 14, 46, 0.75)',
      text: '#faf5ff'
    },
    {
      id: 'glass-dark',
      name: 'Жидкое стекло (Liquid Glass)',
      description: 'Полупрозрачный акрил с интерактивными бликами и фиолетово-розовым акцентом.',
      accent: '#5856d6',
      bg: '#030408',
      card: 'rgba(12, 16, 28, 0.4)',
      text: '#f5f5fa'
    },
    {
      id: 'acrylic',
      name: 'Премиум Акрил (Glassmorphism)',
      description: 'Элегантный матовый акрил с тёмными стеклянными поверхностями.',
      accent: '#ff7a00',
      bg: '#0b0c10',
      card: 'rgba(15, 15, 18, 0.45)',
      text: '#f5f5f5'
    },
    {
      id: 'light',
      name: 'Светлая тема (Light Mode)',
      description: 'Чистый минималистичный светлый дизайн с синим акцентом.',
      accent: '#007aff',
      bg: '#eceff4',
      card: 'rgba(255, 255, 255, 0.28)',
      text: '#2e3440'
    }
  ];

  window.Views.themes = {
    async render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      c.style.display = 'block';

      const prevView = c.querySelector('.themes-view');
      const savedScroll = prevView ? prevView.scrollTop : 0;

      const settings = await window.api.invoke('settings:get');
      const currentTheme = settings.theme || 'amoled';
      const customTheme = settings.customTheme || {
        name: 'Моя тема',
        accent: settings.customAccentColor || '#ff7a00',
        bg: '#000000',
        card: '#121213',
        text: '#f7f7f5'
      };

      c.innerHTML = `
        <div class="view themes-view">
          <div class="settings-hero compact single">
            <div class="settings-hero-title" style="display: flex; align-items: center; gap: 14px;">
              <div class="settings-hero-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="16" cy="10" r="1.5"/><circle cx="14" cy="15" r="1.5"/></svg></div>
              <div>
                <div class="section-kicker">Nexus Launcher</div>
                <h1 style="font-size: 26px; margin: 0;">Темы и Оформление</h1>
                <p style="margin: 3px 0 0; color: var(--text-2); font-size: 13px;">Выберите цветовую гамму или создайте свой уникальный дизайн лаунчера.</p>
              </div>
            </div>
          </div>

          <div class="card themes-single-card">
            <section class="themes-section">
              <div class="settings-section-head">
                <h2 style="font-size: 18px; margin: 0 0 4px 0;">Коллекция стилей</h2>
                <p style="margin: 0; color: var(--text-2); font-size: 13px;">Нажмите на любую карточку, чтобы моментально сменить тему лаунчера.</p>
              </div>
              <div class="themes-grid">
                ${PRESETS.map(p => {
                  const isActive = currentTheme === p.id;
                  return `
                    <div class="theme-card ${isActive ? 'active-theme' : ''}" data-theme-id="${esc(p.id)}">
                      <div class="theme-preview-palette" style="background: ${esc(p.bg)};">
                        <div class="theme-preview-circle" style="background: ${esc(p.accent)}; box-shadow: 0 0 16px ${esc(p.accent)};"></div>
                      </div>
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <b style="font-size: 14px; color: var(--text);">${esc(p.name)}</b>
                          ${isActive ? '<span class="pill-mini ok">Активна</span>' : ''}
                        </div>
                        <p style="font-size: 12px; color: var(--text-2); margin-top: 4px; line-height: 1.4;">${esc(p.description)}</p>
                      </div>
                      <button class="btn ${isActive ? 'ghost' : 'primary'} compact-btn" style="margin-top: auto;" data-apply="${esc(p.id)}">
                        ${isActive ? 'Применена' : 'Выбрать тему'}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="themes-section">
              <div class="settings-section-head" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <h2 style="font-size: 18px; margin: 0 0 4px 0;">Конструктор своей темы</h2>
                  <p style="margin: 0; color: var(--text-2); font-size: 13px;">Свободная настройка всех цветов интерфейса, акцентов и поверхностей.</p>
                </div>
                <span class="pill-mini ${currentTheme === 'custom' ? 'ok' : 'muted'}">${currentTheme === 'custom' ? 'Кастомная тема активна' : 'Свой дизайн'}</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
                <div style="display: flex; flex-direction: column; gap: 14px;">
                  <label class="form-row">
                    <span>Название темы</span>
                    <input class="input" id="ct-name" value="${esc(customTheme.name || 'Моя тема')}" placeholder="Например: Неоновый Шторм">
                  </label>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <label class="form-row">
                      <span>Акцентный цвет</span>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="color" id="ct-accent" value="${esc(customTheme.accent || '#ff7a00')}" style="width: 44px; height: 36px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); cursor: pointer; background: transparent;">
                        <span id="ct-accent-val" style="font-family: monospace; font-size: 12px;">${esc(customTheme.accent || '#ff7a00')}</span>
                      </div>
                    </label>

                    <label class="form-row">
                      <span>Цвет фона (Background)</span>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="color" id="ct-bg" value="${esc(customTheme.bg || '#000000')}" style="width: 44px; height: 36px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); cursor: pointer; background: transparent;">
                        <span id="ct-bg-val" style="font-family: monospace; font-size: 12px;">${esc(customTheme.bg || '#000000')}</span>
                      </div>
                    </label>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <label class="form-row">
                      <span>Поверхность карточек (Card)</span>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="color" id="ct-card" value="${esc(customTheme.card || '#121213')}" style="width: 44px; height: 36px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); cursor: pointer; background: transparent;">
                        <span id="ct-card-val" style="font-family: monospace; font-size: 12px;">${esc(customTheme.card || '#121213')}</span>
                      </div>
                    </label>

                    <label class="form-row">
                      <span>Цвет текста</span>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="color" id="ct-text" value="${esc(customTheme.text || '#f7f7f5')}" style="width: 44px; height: 36px; border-radius: var(--radius-sm); border: 1px solid var(--border-soft); cursor: pointer; background: transparent;">
                        <span id="ct-text-val" style="font-family: monospace; font-size: 12px;">${esc(customTheme.text || '#f7f7f5')}</span>
                      </div>
                    </label>
                  </div>

                  <button class="btn primary" id="btn-save-custom-theme" style="margin-top: 6px;">⚡ Сохранить и применить мою тему</button>
                </div>

                <!-- Живой предпросмотр темы -->
                <div id="ct-preview-box" style="border: 1px solid var(--border-line); border-radius: var(--radius-md); padding: 20px; background: ${esc(customTheme.bg || '#000000')}; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
                  <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${esc(customTheme.accent || '#ff7a00')}; font-weight: 700;">Живой предпросмотр</div>
                  <div style="background: ${esc(customTheme.card || '#121213')}; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); padding: 14px;">
                    <h4 style="margin: 0 0 6px 0; color: ${esc(customTheme.text || '#f7f7f5')};">Пример карточки лаунчера</h4>
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.65);">Так будут выглядеть блоки контента, новости и списки с вашими цветами.</p>
                  </div>
                  <div style="display: flex; gap: 10px;">
                    <button style="background: ${esc(customTheme.accent || '#ff7a00')}; color: #000; font-weight: 700; border-radius: var(--radius-sm); padding: 8px 16px; box-shadow: 0 0 14px ${esc(customTheme.accent || '#ff7a00')}; cursor: default;">Кнопка</button>
                    <button style="border: 1px solid ${esc(customTheme.accent || '#ff7a00')}; color: ${esc(customTheme.accent || '#ff7a00')}; border-radius: var(--radius-sm); padding: 8px 16px; cursor: default;">Контурная</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      `;

      const newView = c.querySelector('.themes-view');
      if (newView && savedScroll > 0) {
        newView.scrollTop = savedScroll;
      }

      // Preset click handlers (card or button)
      c.querySelectorAll('.theme-card').forEach(card => {
        card.onclick = async (e) => {
          e.preventDefault();
          const themeId = card.dataset.themeId;
          const preset = PRESETS.find(p => p.id === themeId);
          if (!preset) return;
          try {
            await window.api.invoke('settings:update', {
              theme: themeId,
              customAccentColor: preset.accent
            });
            if (window.App && typeof window.App.applyRuntimeSettings === 'function') {
              await window.App.applyRuntimeSettings();
            }
            Toast.success('Тема применена', preset.name);

            // Update UI in-place without resetting scroll
            c.querySelectorAll('.theme-card').forEach(tc => {
              const isAct = tc.dataset.themeId === themeId;
              tc.classList.toggle('active-theme', isAct);
              const pill = tc.querySelector('.pill-mini');
              if (pill) pill.remove();
              if (isAct) {
                const titleRow = tc.querySelector('div > div:first-child');
                if (titleRow) titleRow.insertAdjacentHTML('beforeend', '<span class="pill-mini ok">Активна</span>');
              }
              const btn = tc.querySelector('button[data-apply]');
              if (btn) {
                btn.className = `btn ${isAct ? 'ghost' : 'primary'} compact-btn`;
                btn.textContent = isAct ? 'Применена' : 'Выбрать тему';
              }
            });

            const customBadge = c.querySelector('.pill-mini.ok, .pill-mini.muted');
            if (customBadge) {
              customBadge.className = 'pill-mini muted';
              customBadge.textContent = 'Свой дизайн';
            }
          } catch (err) {
            console.error('[themes] apply failed:', err);
            Toast.error('Ошибка применения темы', err.message);
          }
        };
      });

      // Live Color Picker inputs
      const accentIn = document.getElementById('ct-accent');
      const bgIn = document.getElementById('ct-bg');
      const cardIn = document.getElementById('ct-card');
      const textIn = document.getElementById('ct-text');
      const previewBox = document.getElementById('ct-preview-box');

      const updateLivePreview = () => {
        const a = accentIn.value;
        const b = bgIn.value;
        const cd = cardIn.value;
        const t = textIn.value;

        document.getElementById('ct-accent-val').textContent = a;
        document.getElementById('ct-bg-val').textContent = b;
        document.getElementById('ct-card-val').textContent = cd;
        document.getElementById('ct-text-val').textContent = t;

        previewBox.style.background = b;
        const cardEl = previewBox.querySelector('div:nth-child(2)');
        if (cardEl) {
          cardEl.style.background = cd;
          cardEl.querySelector('h4').style.color = t;
        }
        const primaryBtn = previewBox.querySelector('button:nth-child(1)');
        if (primaryBtn) {
          primaryBtn.style.background = a;
          primaryBtn.style.boxShadow = `0 0 14px ${a}`;
        }
        const outlineBtn = previewBox.querySelector('button:nth-child(2)');
        if (outlineBtn) {
          outlineBtn.style.borderColor = a;
          outlineBtn.style.color = a;
        }
      };

      accentIn.oninput = updateLivePreview;
      bgIn.oninput = updateLivePreview;
      cardIn.oninput = updateLivePreview;
      textIn.oninput = updateLivePreview;

      // Save custom theme
      document.getElementById('btn-save-custom-theme').onclick = async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('ct-name').value.trim() || 'Моя тема';
          const customObj = {
            name,
            accent: accentIn.value,
            bg: bgIn.value,
            card: cardIn.value,
            text: textIn.value
          };

          await window.api.invoke('settings:update', {
            theme: 'custom',
            customAccentColor: customObj.accent,
            customTheme: customObj
          });

          if (window.App && typeof window.App.applyRuntimeSettings === 'function') {
            await window.App.applyRuntimeSettings();
          }

          Toast.success('Кастомная тема сохранена', name);
          await this.render();
        } catch (err) {
          console.error('[themes] save custom theme failed:', err);
          Toast.error('Ошибка сохранения темы', err.message);
        }
      };
    },

    destroy() {}
  };
})();
