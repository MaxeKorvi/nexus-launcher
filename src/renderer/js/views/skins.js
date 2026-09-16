/* ═══ Skins Management View ═══ */
window.Views = window.Views || {};

window.Views.skins = {
  selectedFile: null,
  selectedFileBuffer: null,

  render() {
    this.renderAsync().catch(err => {
      console.error('[skins] render error:', err);
      Toast.error('Ошибка открытия скинов', err.message);
    });
  },

  async renderAsync() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    const mainContent = document.querySelector('main.content');
    if (mainContent) mainContent.style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';

    const [settings, accounts] = await Promise.all([
      window.api.invoke('settings:get').catch(() => ({})),
      window.api.invoke('accounts:list').catch(() => [])
    ]);

    const active = (accounts || []).find(a => a.active) || accounts[0] || null;
    const skinSystem = settings.skinSystem || 'ely';

    if (skinSystem === 'none') {
      c.innerHTML = `
        <div class="view skins-view">
          <div class="view-hero">
            <div>
              <div class="eyebrow">Персонализация</div>
              <h1>Система скинов отключена</h1>
              <p>В настройках лаунчера выбрано «Система скинов: Отключено». В этом режиме отображение и загрузка скинов не активны.</p>
            </div>
          </div>
          <div class="card" style="padding: 24px; max-width: 500px;">
            <p style="color: var(--text-2); margin-bottom: 16px;">Чтобы включить отображение и смену скинов, выберите систему скинов в настройках.</p>
            <button class="btn primary" id="btn-goto-settings">Перейти в настройки</button>
          </div>
        </div>`;
      const btn = document.getElementById('btn-goto-settings');
      if (btn) btn.onclick = () => window.App.navigate('settings');
      return;
    }

    if (!active || (active.type !== 'microsoft' && active.type !== 'ely')) {
      c.innerHTML = `
        <div class="view skins-view">
          <div class="view-hero">
            <div>
              <div class="eyebrow">Персонализация</div>
              <h1>Смена скина недоступна</h1>
              <p>Для смены скина прямо в лаунчере выберите аккаунт <b>Ely.by</b> или лицензионный <b>Microsoft</b>.</p>
            </div>
          </div>
          <div class="card" style="padding: 24px; max-width: 500px;">
            <p style="color: var(--text-2); margin-bottom: 16px;">Локальные offline-профили не имеют облачного сервера скинов.</p>
            <button class="btn primary" id="btn-goto-accounts">Управление аккаунтами</button>
          </div>
        </div>`;
      const btn = document.getElementById('btn-goto-accounts');
      if (btn) btn.onclick = () => window.App.navigate('accounts');
      return;
    }

    const isMicrosoft = active.type === 'microsoft';
    const providerTitle = isMicrosoft ? 'Лицензия Microsoft' : 'Ely.by';
    let skinUrl = active.skin || (isMicrosoft ? `https://mc-heads.net/body/${encodeURIComponent(active.nickname)}/right` : `http://skinsystem.ely.by/skins/${encodeURIComponent(active.nickname)}.png`);

    c.innerHTML = `
      <div class="view skins-view">
        <div class="view-hero">
          <div>
            <div class="eyebrow">Персонализация · ${providerTitle}</div>
            <h1>Гардероб и Скины</h1>
            <p>Управляйте скином для аккаунта <b>${Shared.escapeHtml(active.nickname)}</b> прямо в лаунчере.</p>
          </div>
          <div class="hero-badge ${isMicrosoft ? 'ok' : 'accent'}">${providerTitle}</div>
        </div>

        <div style="display: grid; grid-template-columns: 340px 1fr; gap: 24px; align-items: start;">
          <!-- Текущий скин в 3D -->
          <div class="card" style="text-align: center; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 16px; margin: 0;">3D Предпросмотр</h3>
              <div style="display: flex; gap: 6px;">
                <button class="btn ghost compact-btn" id="btn-toggle-anim" title="Пауза / Продолжить анимацию" style="padding: 4px 8px; font-size: 11px;">⏸ Пауза</button>
                <button class="btn ghost compact-btn" id="btn-reset-view" title="Сбросить угол обзора" style="padding: 4px 8px; font-size: 11px;">⟲ Ракурс</button>
              </div>
            </div>

            <div style="width: 250px; height: 330px; margin: 0 auto 14px; background: radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06), rgba(0,0,0,0.45)); border: 1px solid var(--border-soft); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; box-shadow: inset 0 0 25px rgba(0,0,0,0.6);">
              <canvas id="skin-viewer-canvas" style="width: 100%; height: 100%; cursor: grab;"></canvas>
              <div style="position: absolute; bottom: 8px; left: 8px; right: 8px; font-size: 11px; color: var(--text-2); background: rgba(0,0,0,0.65); padding: 4px 8px; border-radius: 4px; pointer-events: none; backdrop-filter: blur(4px);">
                ⟳ Вращайте персонажа мышью
              </div>
            </div>

            <div style="font-weight: 700; font-size: 16px; color: var(--text);">${Shared.escapeHtml(active.nickname)}</div>
            <div style="font-size: 12px; color: var(--text-2); margin-top: 4px;">Провайдер: ${providerTitle}</div>
            <div style="margin-top: 14px;">
              <button class="btn ghost compact-btn" id="btn-refresh-skin">Обновить профиль</button>
            </div>
          </div>

          <!-- Загрузка нового скина -->
          <div class="card" style="padding: 24px;">
            <h3 style="font-size: 18px; margin-bottom: 8px;">Загрузить новый скин</h3>
            <p style="color: var(--text-2); font-size: 13px; margin-bottom: 20px;">
              Выберите файл скина в формате <b>PNG</b> (64x64 или 64x32). Новый скин сразу отобразится на 3D модели слева перед сохранением.
            </p>

            <div id="drop-zone" style="border: 2px dashed var(--border-soft); border-radius: var(--radius-md); padding: 32px 20px; text-align: center; cursor: pointer; transition: var(--trans); margin-bottom: 20px; background: rgba(255,255,255,0.01);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 10px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style="font-weight: 600; color: var(--text); margin-bottom: 4px;">Нажмите или перетащите PNG-файл скина</div>
              <small style="color: var(--text-2);">Поддерживаются размеры 64×64 и 64×32</small>
              <input type="file" id="skin-file-input" accept=".png,image/png" style="display: none;">
            </div>

            <div id="preview-section" style="display: none; margin-bottom: 20px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border: 1px solid var(--border-soft);">
              <div style="display: flex; align-items: center; gap: 16px;">
                <img id="new-skin-preview" style="width: 48px; height: 48px; object-fit: contain; image-rendering: pixelated; border: 1px solid var(--border-soft); border-radius: 4px; background: rgba(255,255,255,0.05);">
                <div style="flex: 1; min-width: 0;">
                  <b id="new-skin-filename" style="display: block; font-size: 13px; color: var(--text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">skin.png</b>
                  <span id="new-skin-size" style="font-size: 11px; color: var(--text-2);">64×64 px</span>
                </div>
                <button class="btn outline compact-btn" id="btn-clear-preview">Убрать</button>
              </div>
            </div>

            <div class="form-row" style="margin-bottom: 20px;">
              <span>Модель персонажа</span>
              <div style="display: flex; gap: 12px; margin-top: 6px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                  <input type="radio" name="skin-variant" value="classic" checked> <b>Классическая (Стив · 4px рука)</b>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                  <input type="radio" name="skin-variant" value="slim"> <b>Тонкая (Алекс · 3px рука)</b>
                </label>
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; margin-top: 24px;">
              <button class="btn primary" id="btn-apply-skin" disabled style="min-width: 160px;">
                Применить скин
              </button>
              ${isMicrosoft ? `
                <button class="btn outline" id="btn-web-profile">Открыть профиль Minecraft.net</button>
              ` : `
                <button class="btn outline" id="btn-web-profile">Открыть профиль Ely.by</button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    await this.init3DViewer(active, skinUrl);
    this.bindEvents(active, isMicrosoft, skinUrl);
  },

  async init3DViewer(active, skinUrl) {
    if (this.skinViewer) {
      try { this.skinViewer.dispose(); } catch {}
      this.skinViewer = null;
    }

    const canvas = document.getElementById('skin-viewer-canvas');
    if (!canvas || !window.skinview3d) return;

    try {
      let resolvedSkin = skinUrl;
      if (resolvedSkin && resolvedSkin.startsWith('http')) {
        const b64 = await window.api.invoke('accounts:get-skin-base64', resolvedSkin).catch(() => null);
        if (b64) resolvedSkin = b64;
      }

      this.skinViewer = new skinview3d.SkinViewer({
        canvas,
        width: 250,
        height: 330,
        skin: resolvedSkin || null
      });

      this.skinViewer.camera.position.set(0, 0, 65);
      this.skinViewer.fov = 70;
      this.skinViewer.zoom = 0.88;

      // Subtle breathing idle animation
      this.idleAnim = new skinview3d.IdleAnimation();
      this.idleAnim.speed = 0.8;
      this.skinViewer.animation = this.idleAnim;

      this.skinViewer.controls.enableRotate = true;
      this.skinViewer.controls.enableZoom = true;
      this.skinViewer.controls.enablePan = false;

      // Load cape if available
      if (active.cape) {
        let capeData = active.cape;
        if (capeData.startsWith('http')) {
          const capeB64 = await window.api.invoke('accounts:get-skin-base64', capeData).catch(() => null);
          if (capeB64) capeData = capeB64;
        }
        this.skinViewer.loadCape(capeData).catch(() => {});
      }

      this.activeSkinUrl = resolvedSkin;
    } catch (e) {
      console.warn('[skins] 3D viewer initialization error:', e);
    }
  },

  bindEvents(active, isMicrosoft, skinUrl) {
    const fileInput = document.getElementById('skin-file-input');
    const dropZone = document.getElementById('drop-zone');
    const previewSection = document.getElementById('preview-section');
    const previewImg = document.getElementById('new-skin-preview');
    const filenameEl = document.getElementById('new-skin-filename');
    const sizeEl = document.getElementById('new-skin-size');
    const btnApply = document.getElementById('btn-apply-skin');
    const btnClear = document.getElementById('btn-clear-preview');
    const btnRefresh = document.getElementById('btn-refresh-skin');
    const btnWeb = document.getElementById('btn-web-profile');
    const btnToggleAnim = document.getElementById('btn-toggle-anim');
    const btnResetView = document.getElementById('btn-reset-view');

    if (btnToggleAnim && this.skinViewer) {
      btnToggleAnim.onclick = () => {
        if (!this.skinViewer) return;
        if (this.skinViewer.animation) {
          this.skinViewer.animation.paused = !this.skinViewer.animation.paused;
          btnToggleAnim.textContent = this.skinViewer.animation.paused ? '▶ Старт' : '⏸ Пауза';
        }
      };
    }

    if (btnResetView && this.skinViewer) {
      btnResetView.onclick = () => {
        if (!this.skinViewer) return;
        this.skinViewer.camera.position.set(0, 0, 65);
        this.skinViewer.controls.reset();
      };
    }

    document.querySelectorAll('input[name="skin-variant"]').forEach(radio => {
      radio.onchange = () => {
        if (this.skinViewer && this.skinViewer.playerObject && this.skinViewer.playerObject.skin) {
          this.skinViewer.playerObject.skin.modelType = (radio.value === 'slim' ? 'slim' : 'default');
        }
      };
    });

    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();
      dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-hi)'; };
      dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--border-soft)'; };
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-soft)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileSelect(e.dataTransfer.files[0]);
        }
      };
      fileInput.onchange = () => {
        if (fileInput.files && fileInput.files[0]) {
          this.handleFileSelect(fileInput.files[0]);
        }
      };
    }

    if (btnClear) {
      btnClear.onclick = () => {
        this.selectedFile = null;
        this.selectedFileBuffer = null;
        if (fileInput) fileInput.value = '';
        if (previewSection) previewSection.style.display = 'none';
        if (btnApply) btnApply.disabled = true;
        if (this.skinViewer && this.activeSkinUrl) {
          this.skinViewer.loadSkin(this.activeSkinUrl).catch(() => {});
        }
      };
    }

    if (btnRefresh) {
      btnRefresh.onclick = async () => {
        btnRefresh.disabled = true;
        try {
          await window.api.invoke('accounts:get-profile', active.id);
          Toast.success('Профиль обновлён');
          this.render();
          window.App.refreshUserCard();
        } catch (e) {
          Toast.error('Не удалось обновить', e.message);
        } finally {
          btnRefresh.disabled = false;
        }
      };
    }

    if (btnWeb) {
      btnWeb.onclick = () => {
        const link = isMicrosoft ? 'https://www.minecraft.net/msaprofile/mygames/editskin' : 'https://ely.by/skin';
        window.api.shell.openExternal(link);
      };
    }

    if (btnApply) {
      btnApply.onclick = async () => {
        if (!this.selectedFileBuffer) return;
        btnApply.disabled = true;
        btnApply.innerHTML = '<span class="spinner"></span> Применение…';

        const variantEl = document.querySelector('input[name="skin-variant"]:checked');
        const variant = variantEl ? variantEl.value : 'classic';

        try {
          const res = await window.api.invoke('accounts:change-skin', {
            accountId: active.id,
            imageBuffer: Array.from(new Uint8Array(this.selectedFileBuffer)),
            variant
          });
          Toast.success('Успешно', (res && res.message) || 'Скин обновлён!');
          this.selectedFile = null;
          this.selectedFileBuffer = null;
          await this.renderAsync();
          window.App.refreshUserCard();
        } catch (err) {
          Toast.error('Ошибка смены скина', err.message);
        } finally {
          if (btnApply) {
            btnApply.disabled = false;
            btnApply.textContent = 'Применить скин';
          }
        }
      };
    }
  },

  handleFileSelect(file) {
    if (!file || !file.name.toLowerCase().endsWith('.png')) {
      Toast.error('Неверный формат', 'Выберите файл изображения в формате .PNG');
      return;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.selectedFileBuffer = e.target.result;
      const previewSection = document.getElementById('preview-section');
      const previewImg = document.getElementById('new-skin-preview');
      const filenameEl = document.getElementById('new-skin-filename');
      const sizeEl = document.getElementById('new-skin-size');
      const btnApply = document.getElementById('btn-apply-skin');

      const blob = new Blob([this.selectedFileBuffer], { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);
      if (previewImg) previewImg.src = blobUrl;
      if (filenameEl) filenameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${Math.round(file.size / 1024)} KB · PNG`;
      if (previewSection) previewSection.style.display = 'block';
      if (btnApply) btnApply.disabled = false;

      // Update 3D skin model in real-time
      if (this.skinViewer) {
        this.skinViewer.loadSkin(blobUrl).catch(() => {});
        const variantEl = document.querySelector('input[name="skin-variant"]:checked');
        if (variantEl && this.skinViewer.playerObject && this.skinViewer.playerObject.skin) {
          this.skinViewer.playerObject.skin.modelType = (variantEl.value === 'slim' ? 'slim' : 'default');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  },

  destroy() {
    if (this.skinViewer) {
      try { this.skinViewer.dispose(); } catch {}
      this.skinViewer = null;
    }
    this.selectedFile = null;
    this.selectedFileBuffer = null;
  }
};
