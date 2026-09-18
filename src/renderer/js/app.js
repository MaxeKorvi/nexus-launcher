/* =========================================================================
 * App entry — router, init, UI event wiring
 * ========================================================================= */

window.App = {
  currentView: null,

  async init() {
    this.bindTitlebar();
    this.bindNav();
    this.bindBottomBar();
    this.bindBackButton();
    this.bindKeyboard();
    this.bindDownloadsEvents();
    this.bindDownloadDrawer();
    this.bindLauncherConsole();
    this.bindLiquidGlass();
    this.bindVersionProgress();
    this.bindAutoScaling();

    // Subscribe before the main process reveals the window.
    window.api.win.onReady(() => {});

    await this.applyRuntimeSettings();

    // Render immediately: network services must never leave the launcher blank.
    this.navigate('home');

    const results = await Promise.allSettled([
      this.refreshUserCard(),
      this.loadNews(),
      this.loadInstalledVersions()
    ]);
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) {
      Toast.info('Часть данных недоступна', 'Проверьте подключение к интернету');
    }
  },

  async applyRuntimeSettings(settings = null) {
    try {
      const s = settings || await window.api.invoke('settings:get');
      document.body.classList.toggle('light-theme', s.theme === 'light');
      document.body.classList.toggle('theme-glass-dark', s.theme === 'glass-dark');
      document.body.classList.toggle('theme-acrylic', s.theme === 'acrylic');
      document.body.classList.toggle('theme-emerald', s.theme === 'emerald');
      document.body.classList.toggle('theme-crimson', s.theme === 'crimson');
      document.body.classList.toggle('theme-sapphire', s.theme === 'sapphire');
      document.body.classList.toggle('theme-amber', s.theme === 'amber');
      document.body.classList.toggle('theme-amethyst', s.theme === 'amethyst');
      document.body.classList.toggle('theme-custom', s.theme === 'custom');
      document.body.classList.toggle('no-animations', s.animations === false);

      if (s.theme === 'custom' && s.customTheme) {
        const ct = s.customTheme;
        if (ct.accent) {
          document.documentElement.style.setProperty('--accent', ct.accent);
          document.documentElement.style.setProperty('--accent-hi', ct.accent);
          document.documentElement.style.setProperty('--accent-glow', ct.accent + '40');
          document.documentElement.style.setProperty('--glow', ct.accent + '25');
          document.documentElement.style.setProperty('--shadow-glow', `0 0 34px ${ct.accent}33`);
        }
        if (ct.bg) document.documentElement.style.setProperty('--bg', ct.bg);
        if (ct.card) document.documentElement.style.setProperty('--card', ct.card);
        if (ct.text) document.documentElement.style.setProperty('--text', ct.text);
      } else {
        document.documentElement.style.removeProperty('--accent');
        document.documentElement.style.removeProperty('--accent-hi');
        document.documentElement.style.removeProperty('--accent-glow');
        document.documentElement.style.removeProperty('--glow');
        document.documentElement.style.removeProperty('--shadow-glow');
        document.documentElement.style.removeProperty('--bg');
        document.documentElement.style.removeProperty('--card');
        document.documentElement.style.removeProperty('--text');
      }

      if (s.consoleFontSize) {
        document.documentElement.style.setProperty('--console-font-size', `${s.consoleFontSize}px`);
      } else {
        document.documentElement.style.removeProperty('--console-font-size');
      }

      if (s.consoleFontFamily) {
        document.documentElement.style.setProperty('--console-font-family', s.consoleFontFamily);
      } else {
        document.documentElement.style.removeProperty('--console-font-family');
      }

      await this.updateSkinsNavVisibility();
    } catch {}
  },

  async updateSkinsNavVisibility(activeAccount = null) {
    try {
      const settings = await window.api.invoke('settings:get');
      let active = activeAccount;
      if (!active) {
        const accounts = Store.get('accounts') || await window.api.invoke('accounts:list');
        active = accounts.find(a => a.active) || accounts[0];
      }
      const navSkins = document.getElementById('nav-skins');
      if (!navSkins) return;

      const isSkinAllowed = settings && settings.skinSystem !== 'none' && active && (active.type === 'ely' || active.type === 'microsoft');
      navSkins.style.display = isSkinAllowed ? 'flex' : 'none';

      if (!isSkinAllowed && this.currentView === 'skins') {
        this.navigate('home');
      }
    } catch {}
  },

  bindLiquidGlass() {
    const surface = document.createElement('div');
    surface.className = 'liquid-cursor-surface';
    document.body.appendChild(surface);
    let frame = 0;
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let lastRipple = 0;
    document.addEventListener('pointermove', (event) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        document.body.style.setProperty('--liquid-x', `${x}px`);
        document.body.style.setProperty('--liquid-y', `${y}px`);
      });
      const now = performance.now();
      if (now - lastRipple < 90 || (!document.body.classList.contains('light-theme') && !document.body.classList.contains('theme-glass-dark'))) return;
      lastRipple = now;
      const ripple = document.createElement('i');
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      surface.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }, { passive: true });
  },

  bindTitlebar() {
    document.getElementById('btn-min').onclick = () => window.api.win.minimize();
    document.getElementById('btn-max').onclick = () => window.api.win.maximize();
    document.getElementById('btn-close').onclick = () => window.api.win.close();
    const titlebar = document.querySelector('.titlebar');
    if (titlebar) titlebar.ondblclick = () => window.api.win.maximize();
  },

  bindNav() {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.onclick = (event) => {
        event.preventDefault();
        const target = el.dataset.view;
        if (target) this.navigate(target);
      };
    });
  },

  bindBackButton() {
    const back = document.getElementById('btn-back-home');
    if (back) back.onclick = () => this.navigate('home');
  },

  bindBottomBar() {
    const play = () => this.launch();
    const repair = () => this.repairSelectedVersion();
    const folder = () => this.openSelectedVersionFolder();

    document.getElementById('btn-play').onclick = play;
    const heroBtnPlay = document.getElementById('hero-btn-play');
    if (heroBtnPlay) heroBtnPlay.onclick = play;

    document.getElementById('btn-force-update').onclick = repair;
    const heroBtnCheck = document.getElementById('hero-btn-check');
    if (heroBtnCheck) heroBtnCheck.onclick = repair;

    document.getElementById('btn-open-version-folder').onclick = folder;
    const heroBtnFolder = document.getElementById('hero-btn-folder');
    if (heroBtnFolder) heroBtnFolder.onclick = folder;

    document.getElementById('account-select').onclick = () => this.navigate('accounts');
    document.getElementById('version-select').onclick = () => this.navigate('versions');
    document.getElementById('refresh-news').onclick = () => this.loadNews();

    const btnAllNews = document.getElementById('btn-all-news');
    if (btnAllNews) {
      btnAllNews.onclick = () => {
        window.api.shell.openExternal('https://www.minecraft.net/');
      };
    }
  },

  bindVersionProgress() {
    const el = document.getElementById('version-install-progress');
    const fileEl = document.getElementById('vip-filename');
    const percentEl = document.getElementById('vip-percent');
    const fillEl = document.getElementById('vip-fill');
    const cancelBtn = document.getElementById('vip-cancel-btn');

    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        const ver = Store.get('installingVersion');
        Store.set('queueLaunchAfterInstall', false);
        await window.api.invoke('versions:cancel', ver || null);
        Toast.info('Отмена', ver ? `Установка ${ver} отменяется...` : 'Отмена загрузки...');
      };
    }

    window.api.on('versions:progress', (data) => {
      if (!el) return;
      if (data.stage === 'done') {
        if (fileEl) fileEl.textContent = 'Установка завершена!';
        if (percentEl) percentEl.textContent = '100%';
        if (fillEl) fillEl.style.width = '100%';
        setTimeout(() => { el.classList.add('hidden'); }, 2000);
        Store.set('installingVersion', null);
        if (Store.get('queueLaunchAfterInstall')) {
          Store.set('queueLaunchAfterInstall', false);
          Toast.info('Автозапуск', 'Установка завершена, запускаем Minecraft…');
          this.launch();
        }
        return;
      }
      if (data.stage === 'cancelled') {
        if (fileEl) fileEl.textContent = 'Установка отменена';
        Store.set('installingVersion', null);
        Store.set('queueLaunchAfterInstall', false);
        setTimeout(() => { el.classList.add('hidden'); }, 1600);
        return;
      }

      el.classList.remove('hidden');
      if (data.versionId) Store.set('installingVersion', data.versionId);
      if (fileEl) fileEl.textContent = data.currentFile ? `${data.currentFile} (${data.completed}/${data.total})` : 'Подготовка файлов...';
      if (percentEl) percentEl.textContent = `${data.percent || 0}%`;
      if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(3, data.percent || 0))}%`;
    });
  },

  bindAutoScaling() {
    const updateScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      document.body.style.zoom = '';
      document.documentElement.style.setProperty('--window-w', `${w}px`);
      document.documentElement.style.setProperty('--window-h', `${h}px`);
    };

    window.addEventListener('resize', updateScale);
    updateScale();
  },

  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey) {
        if (e.key === 'n') { e.preventDefault(); this.navigate('library'); }
        else if (e.key === 's') { e.preventDefault(); this.navigate('settings'); }
        else if (e.key === 'q') { e.preventDefault(); window.api.win.close(); }
        else if (e.key === 'r') { e.preventDefault(); window.location.reload(); }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        if (window.api.win.toggleFullscreen) window.api.win.toggleFullscreen();
        else window.api.win.maximize();
      }
      if (e.key === 'Escape' && this.currentView !== 'home') {
        this.navigate('home');
      }
    });
  },

  bindDownloadsEvents() {
    Store.set('downloads', { active: [], queue: [], completed: [], paused: [] });
    let refreshTimer = null;
    let refreshInFlight = false;
    const refresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const r = await window.api.invoke('downloads:list');
        Store.set('downloads', r);
        this.renderDownloadDrawer();
      } catch {}
      refreshInFlight = false;
    };
    const refreshSoon = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refresh();
      }, 500);
    };
    ['downloads:progress', 'downloads:retry', 'downloads:cancelled', 'downloads:snapshot'].forEach(ch => {
      window.api.on(ch, refreshSoon);
    });
    window.api.on('downloads:done', () => {
      this._downloadJustFinished = true;
      refreshSoon();
    });
    window.api.on('downloads:error', () => {
      this._downloadJustFinished = false;
      refreshSoon();
    });
    setInterval(refresh, 2000);
    refresh();
  },

  bindDownloadDrawer() {
    const clear = document.getElementById('downloads-clear');
    if (clear) clear.onclick = async () => {
      await window.api.invoke('downloads:clear-completed');
      const r = await window.api.invoke('downloads:list');
      Store.set('downloads', r);
      this.renderDownloadDrawer();
    };

    const cancelAll = document.getElementById('downloads-cancel-all');
    if (cancelAll) cancelAll.onclick = async () => {
      await window.api.invoke('downloads:cancel-all');
      Toast.info('Все загрузки отменены');
      const r = await window.api.invoke('downloads:list');
      Store.set('downloads', r);
      this.renderDownloadDrawer();
    };
  },

  renderDownloadDrawer() {
    const body = document.getElementById('downloads-panel-body');
    if (!body) return;
    const d = Store.get('downloads') || { active: [], queue: [], completed: [], paused: [] };
    const active = d.active || [];
    const queue = d.queue || [];
    const completed = d.completed || [];
    const rows = active.length || queue.length ? [...active, ...queue.slice(0, 8)] : [];
    body.innerHTML = rows.length ? rows.map(item => {
      const received = item.received || 0;
      const total = item.total || item.size || 0;
      const pct = total ? Math.min(100, (received / total) * 100) : (item.status === 'done' || item.status === 'skipped' ? 100 : 0);
      const isActive = active.find(x => x.id === item.id);
      const status = isActive ? 'Идёт загрузка' : queue.find(x => x.id === item.id) ? 'В очереди' : (item.status === 'error' ? 'Ошибка' : 'Готово');
      return `<div class="drawer-row ${item.status === 'error' ? 'error' : ''} ${isActive ? 'active-download' : ''}">
        <div class="drawer-row-top">
          <b>${Shared.escapeHtml(item.label || item.id)}</b>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${status}${item.attempt ? ` · ${item.attempt}/${item.attempts}` : ''}</span>
            <button class="btn ghost compact-btn btn-cancel-dl" data-cancel-id="${Shared.escapeHtml(item.id)}" title="Отменить загрузку" style="padding: 1px 5px; font-size: 11px; height: 18px; line-height: 1; color: var(--error);">✕</button>
          </div>
        </div>
        <div class="progress"><div class="fill" style="width:${pct}%"></div></div>
        <small>${total ? `${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` : Shared.escapeHtml(item.path || '')}</small>
      </div>`;
    }).join('') : (this._downloadJustFinished && completed.length ? '<div class="empty-state">Установка завершена</div>' : '<div class="empty-state">Нет загрузок</div>');

    body.querySelectorAll('.btn-cancel-dl').forEach(b => {
      b.onclick = async (e) => {
        e.stopPropagation();
        const id = b.dataset.cancelId;
        b.disabled = true;
        try {
          await window.api.invoke('downloads:cancel', id);
          Toast.info('Загрузка отменена', id);
          const r = await window.api.invoke('downloads:list');
          Store.set('downloads', r);
          this.renderDownloadDrawer();
        } catch (err) {
          Toast.error('Ошибка отмены', err.message);
        }
      };
    });

    if (!active.length && !queue.length && this._downloadJustFinished && completed.length) {
      clearTimeout(this._downloadDoneTimer);
      this._downloadDoneTimer = setTimeout(async () => {
        this._downloadJustFinished = false;
        try { await window.api.invoke('downloads:clear-completed'); } catch {}
        try {
          const r = await window.api.invoke('downloads:list');
          Store.set('downloads', r);
        } catch {}
        this.renderDownloadDrawer();
      }, 2200);
    }
  },

  bindLauncherConsole() {
    window.api.on('launcher:console', (line) => {
      const lines = Store.get('consoleLines');
      let type = 'info';
      if (/error|exception|fail/i.test(line)) type = 'error';
      else if (/success|complete|done/i.test(line)) type = 'success';
      lines.push({ text: line, type });
      if (lines.length > 2000) lines.shift();
      Store.set('consoleLines', lines);
    });
    window.api.on('launcher:stopped', ({ code, error, diagnostic }) => {
      Store.set('isLaunching', false);
      this.updateHomeProfile();
      if (diagnostic && diagnostic.isCrash) {
        this.showCrashDiagnosticModal(diagnostic, code);
      } else if (Number(code) === 1) {
        Toast.error('Minecraft завершился с кодом 1', error || 'Откройте консоль лаунчера — туда выведена диагностика запуска.');
      } else {
        Toast.info('Minecraft закрыт', `Код выхода: ${code}`);
      }
    });
  },

  navigate(viewName) {
    if (this.currentView && window.Views[this.currentView] && window.Views[this.currentView].destroy) {
      window.Views[this.currentView].destroy();
    }
    this.currentView = viewName;
    Store.set('currentView', viewName);

    // Highlight nav item
    document.querySelectorAll('.nav-item[data-view]').forEach(x => {
      x.classList.toggle('active', x.dataset.view === viewName);
    });

    const back = document.getElementById('btn-back-home');
    if (back) back.classList.remove('visible');

    if (window.Views[viewName]) {
      window.Views[viewName].render();
    } else {
      Toast.error('Не найдено', `View "${viewName}" не существует`);
    }
    this.updateHomeProfile();
  },

  async refreshUserCard() {
    const accounts = await window.api.invoke('accounts:list');
    Store.set('accounts', accounts);
    const active = accounts.find(a => a.active) || accounts[0];
    const el = (id) => document.getElementById(id);
    if (active) {
      const avatarEl = el('user-avatar');
      avatarEl.textContent = (active.nickname || '?').charAt(0).toUpperCase();
      el('user-nick').textContent = active.nickname;
      el('user-provider').textContent = active.type === 'microsoft' ? 'Microsoft аккаунт' : active.type === 'ely' ? 'Ely.by аккаунт' : 'Локальный аккаунт';
      el('user-status').textContent = active.status === 'connected' ? '● В сети' : '● Оффлайн';
      el('user-status').style.color = active.status === 'connected' ? 'var(--success)' : 'var(--error)';
      el('bottom-account').textContent = active.nickname;

      if (active.skin) {
        this.loadAndDisplayAvatar(active.skin, avatarEl);
      } else if (active.type === 'ely' || active.type === 'microsoft') {
        window.api.invoke('accounts:get-profile', active.id).then(p => {
          if (p && p.skin) {
            active.skin = p.skin;
            this.loadAndDisplayAvatar(p.skin, avatarEl);
          }
        }).catch(() => {});
      }
    } else {
      el('user-avatar').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      el('user-nick').textContent = 'Гость';
      el('user-provider').textContent = 'Войдите в аккаунт';
      el('user-status').textContent = 'Оффлайн';
      el('bottom-account').textContent = '—';
    }
    await this.updateSkinsNavVisibility(active);
    this.updateHomeProfile();
  },

  async loadAndDisplayAvatar(skinUrl, container) {
    if (!skinUrl || !container) return;
    try {
      const dataUrl = await window.api.invoke('accounts:get-skin-base64', skinUrl);
      if (!dataUrl) return;
      const headUrl = await this.renderPlayerHead(dataUrl, 64);
      if (headUrl && container) {
        container.innerHTML = `<img src="${headUrl}" alt="Avatar">`;
      }
    } catch {}
  },

  renderPlayerHead(skinDataUrl, size = 64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          // Base head: (8, 8, 8, 8)
          ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
          // Outer head layer (hat/accessory): (40, 8, 8, 8)
          ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = skinDataUrl;
    });
  },

  async loadNews() {
    try {
      const r = await window.api.invoke('news:list');
      const items = r.items || [];
      Store.set('news', items);
      const el = document.getElementById('news-list');
      if (!items.length) {
        el.innerHTML = '<div class="empty-state">Новости недоступны</div>';
        return;
      }
      el.innerHTML = items.slice(0, 3).map((n, i) => `
        <div class="news-item" data-news-idx="${i}" style="animation-delay:${i * 40}ms; cursor: pointer;">
          <div class="thumb" style="${n.image ? `background-image:url('${Shared.escapeHtml(n.image)}')` : 'background:linear-gradient(135deg,var(--accent),var(--accent-hi));'}"></div>
          <div class="body">
            <h3>${Shared.escapeHtml(n.title)}</h3>
            <div class="date">${n.pubDate ? new Date(n.pubDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
            <p>${Shared.escapeHtml(n.description || '')}</p>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.news-item').forEach(it => {
        const idx = Number(it.dataset.newsIdx);
        it.onclick = () => this.openNewsPreview(items[idx]);
      });
    } catch (e) {
      const el = document.getElementById('news-list');
      const cached = Store.get('news') || [];
      if (cached.length) {
        el.innerHTML = cached.slice(0, 3).map((n, i) => `<div class="news-item" data-news-idx="${i}" style="cursor: pointer;"><div class="body"><h3>${Shared.escapeHtml(n.title)}</h3><p>${Shared.escapeHtml(n.description || '')}</p></div></div>`).join('');
        el.querySelectorAll('.news-item').forEach(it => {
          const idx = Number(it.dataset.newsIdx);
          it.onclick = () => this.openNewsPreview(cached[idx]);
        });
      } else {
        el.innerHTML = '<div class="empty-state">Новости временно недоступны. Открыть официальный сайт Minecraft можно кнопкой обновления.</div>';
      }
    }
  },

  openNewsPreview(n) {
    if (!n) return;
    const body = document.createElement('div');
    body.className = 'news-preview-modal';
    
    const dateFormatted = n.pubDate ? new Date(n.pubDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const paragraphs = (n.content || n.description || '')
      .split(/\r?\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        if (/^(новое|исправлено):/i.test(p)) {
          return `<div style="margin: 14px 0 6px 0; font-size: 15px; font-weight: 800; color: var(--accent-hi); text-transform: uppercase; letter-spacing: 0.5px;">${Shared.escapeHtml(p)}</div>`;
        }
        if (/^(\d+\.|\-)/.test(p)) {
          return `<div style="margin-bottom: 6px; line-height: 1.5; color: var(--text); font-size: 13.5px; padding-left: 8px;">${Shared.escapeHtml(p)}</div>`;
        }
        if (/^Приятной игры!/i.test(p)) {
          return `<div style="margin-top: 14px; font-size: 15px; font-weight: 700; color: var(--accent-hi);">${Shared.escapeHtml(p)}</div>`;
        }
        return `<p style="margin-bottom: 8px; line-height: 1.6; color: var(--text-1); font-size: 14px;">${Shared.escapeHtml(p)}</p>`;
      })
      .join('');

    body.innerHTML = `
      ${n.image ? `
        <div style="width: 100%; height: 220px; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background: #111; position: relative; border: 1px solid rgba(255,255,255,0.08);">
          <img src="${Shared.escapeHtml(n.image)}" style="width: 100%; height: 100%; object-fit: cover;" alt="">
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(10,10,12,0.85) 100%);"></div>
        </div>` : ''}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: var(--accent); text-transform: uppercase;">
          ${Shared.escapeHtml(n.category || 'Minecraft News')}
        </span>
        <span style="font-size: 12px; color: var(--text-2);">${dateFormatted}</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 800; line-height: 1.3; margin-bottom: 14px; color: #fff;">
        ${Shared.escapeHtml(n.title)}
      </h2>
      <div class="news-body-content" style="max-height: 320px; overflow-y: auto; padding-right: 6px;">
        ${paragraphs}
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.width = '100%';
    footer.innerHTML = `
      ${n.link ? `<button class="btn outline" id="btn-news-open-link" style="gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Открыть на сайте
      </button>` : '<div></div>'}
      <button class="btn primary" id="btn-news-close">Закрыть</button>
    `;

    const inst = Modal.open({ title: 'Просмотр новости', body, footer, size: 'large' });
    const linkBtn = footer.querySelector('#btn-news-open-link');
    if (linkBtn) linkBtn.onclick = () => window.api.shell.openExternal(n.link);
    footer.querySelector('#btn-news-close').onclick = () => inst.close();
  },

  async loadInstalledVersions() {
    try {
      const list = await window.api.invoke('versions:get-installed');
      Store.set('installedVersions', list);
      if (list.length && !Store.get('selectedVersion')) {
        document.getElementById('bottom-version').textContent = list[0].id;
        Store.set('selectedVersion', list[0].id);
        Store.set('selectedInstallPath', list[0].rootDir || list[0].path || null);
      }
      this.updateSelectedFolderHint();
    } catch {}
    this.updateHomeProfile();
  },

  async repairSelectedVersion() {
    const versionId = Store.get('selectedVersion');
    if (!versionId) {
      Toast.error('Версия не выбрана', 'Сначала выберите установленную версию');
      this.navigate('library');
      const tabs = document.querySelector('.library-tabs');
      if (tabs) {
        const verTab = tabs.querySelector('[data-tab="versions"]');
        if (verTab) verTab.click();
      }
      return;
    }
    const button = document.getElementById('btn-force-update');
    const heroBtnCheck = document.getElementById('hero-btn-check');
    if (button) { button.disabled = true; button.textContent = 'Проверка…'; }
    if (heroBtnCheck) { heroBtnCheck.disabled = true; heroBtnCheck.textContent = 'Проверка…'; }
    try {
      const selectedModpack = Store.get('selectedModpack');
      let gameDir = selectedModpack ? selectedModpack.path : (Store.get('selectedInstallPath') || null);
      if (!gameDir) {
        const installedList = Store.get('installedVersions') || [];
        const found = installedList.find(x => x.id === versionId || x.profileId === versionId || x.versionId === versionId || x.minecraft === versionId);
        if (found) gameDir = found.rootDir || found.path;
      }
      const result = await window.api.invoke('versions:repair', { versionId, gameDir });
      if (result && result.versionId && result.versionId !== versionId) {
        Store.set('selectedVersion', result.versionId);
        document.getElementById('bottom-version').textContent = result.versionId;
      }
      Toast.success('Файлы проверены', `Версия ${(result && result.versionId) || versionId} полностью восстановлена`);
    } catch (error) {
      Toast.error('Проверка не выполнена', error.message);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Проверить файлы'; }
      if (heroBtnCheck) { heroBtnCheck.disabled = false; heroBtnCheck.textContent = 'Проверить файлы'; }
      this.updateHomeProfile();
    }
  },

  async updateSelectedFolderHint() {
    const btn = document.getElementById('btn-open-version-folder');
    if (!btn) return;
    const selected = Store.get('selectedVersion');
    btn.title = selected ? 'Открыть папку выбранной версии' : 'Открыть папку со всеми версиями';
  },

  async openSelectedVersionFolder() {
    const selectedModpack = Store.get('selectedModpack');
    let targetPath = selectedModpack ? selectedModpack.path : (Store.get('selectedInstallPath') || null);
    const versionId = Store.get('selectedVersion');
    if (!targetPath && versionId && versionId !== '—') {
      const paths = await window.api.invoke('versions:get-storage-paths', versionId);
      targetPath = paths && paths.selected;
    }
    if (!targetPath) {
      const settings = Store.get('settings') || {};
      targetPath = settings.gameFolder;
    }
    if (targetPath) {
      window.api.send('shell:open-path', targetPath);
    }
  },

  async launch() {
    const installing = Store.get('installingVersion');
    if (installing) {
      Store.set('queueLaunchAfterInstall', true);
      Toast.info('Очередь запуска', `Игра ${installing} запустится автоматически сразу после завершения установки!`);
      return;
    }

    const activeInstance = Store.get('activeInstance');
    let versionId = (activeInstance && (activeInstance.versionId || activeInstance.profileId || activeInstance.mcVersion)) || Store.get('selectedVersion') || document.getElementById('bottom-version').textContent;
    const accounts = Store.get('accounts') || [];
    const active = accounts.find(a => a.active) || accounts[0];
    if (!active) {
      Toast.error('Нет аккаунта', 'Сначала добавьте аккаунт');
      this.navigate('accounts');
      return;
    }
    if (!versionId || versionId === '—') {
      Toast.error('Не выбрана версия', 'Установите версию Minecraft');
      this.navigate('library');
      return;
    }
    if (Store.get('isLaunching')) return;

    try {
      const selectedModpack = Store.get('selectedModpack');
      let modpackPath = selectedModpack ? selectedModpack.path : (activeInstance ? (activeInstance.rootDir || activeInstance.path) : (Store.get('selectedInstallPath') || null));
      const installedList = Store.get('installedVersions') || [];
      
      let found = installedList.find(x => x.id === versionId || x.profileId === versionId || x.versionId === versionId);
      if (!found && modpackPath) {
        found = installedList.find(x => (x.rootDir && x.rootDir === modpackPath) || (x.path && x.path === modpackPath));
      }
      if (!found) {
        found = installedList.find(x => x.loader && x.loader !== 'vanilla' && (x.minecraft === versionId || (x.id && x.id.includes(versionId))));
      }
      if (!found) {
        found = installedList.find(x => x.minecraft === versionId);
      }

      let targetVersionId = versionId;
      if (found) {
        if (!modpackPath) modpackPath = found.rootDir || found.path;
        if (found.loader && found.loader !== 'vanilla') {
          targetVersionId = found.profileId || found.versionId || found.id || targetVersionId;
        }
      }

      Toast.info('Запуск', `Minecraft ${targetVersionId}${activeInstance ? ` (${activeInstance.name})` : ''}…`);
      this.navigate('console');
      Store.set('isLaunching', true);
      this.updateHomeProfile();

      const result = await window.api.invoke('launch:start', {
        versionId: targetVersionId,
        accountId: active.id,
        instanceId: activeInstance ? activeInstance.id : null,
        modpackPath
      });
      if (!result || result.ok === false) throw new Error('Minecraft уже запущен');
      if (result.versionId && result.versionId !== targetVersionId) {
        Store.set('selectedVersion', result.versionId);
        document.getElementById('bottom-version').textContent = result.versionId;
      }
      Toast.success('Minecraft запущен', result.javaVersion ? `Java ${result.javaVersion}` : '');
    } catch (e) {
      Toast.error('Ошибка запуска', e.message);
      Store.set('isLaunching', false);
    } finally {
      this.updateHomeProfile();
    }
  },

  updateHomeProfile() {
    const activeInstance = Store.get('activeInstance');
    const selectedVersion = (activeInstance && (activeInstance.versionId || activeInstance.profileId || activeInstance.mcVersion)) || Store.get('selectedVersion') || '—';
    const selectedModpack = Store.get('selectedModpack');
    
    // Update bottom bar
    const bottomVersion = document.getElementById('bottom-version');
    if (bottomVersion) bottomVersion.textContent = selectedVersion;

    // Update hero fields
    const nameEl = document.getElementById('profile-name');
    const typeEl = document.getElementById('profile-type');
    const verBadge = document.getElementById('profile-version-badge');
    const statusBadge = document.getElementById('profile-status-badge');
    const iconEl = document.getElementById('profile-icon');
    const coverEl = document.getElementById('profile-cover');

    if (nameEl) {
      if (activeInstance) {
        nameEl.textContent = activeInstance.name;
        typeEl.textContent = `Инстанс [${(activeInstance.loader || 'vanilla').toUpperCase()}]`;
        verBadge.textContent = `MC ${activeInstance.mcVersion}`;
        iconEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
        if (coverEl) {
          coverEl.style.background = 'linear-gradient(135deg, rgba(255, 122, 0, 0.18), rgba(17, 17, 17, 0.85) 50%)';
        }
      } else if (selectedModpack) {
        nameEl.textContent = selectedModpack.name;
        typeEl.textContent = 'Сборка';
        verBadge.textContent = `Версия: ${selectedVersion}`;
        iconEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
        if (coverEl) {
          coverEl.style.background = 'linear-gradient(135deg, rgba(255, 122, 0, 0.12), rgba(17, 17, 17, 0.85) 50%)';
        }
      } else {
        nameEl.textContent = 'Стандартный профиль';
        typeEl.textContent = 'Minecraft';
        verBadge.textContent = selectedVersion;
        iconEl.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M12 12h.01"/><path d="M15 10h.01"/><path d="M18 12h.01"/><path d="M6 12h4"/><path d="M8 10v4"/></svg>`;
        if (coverEl) {
          coverEl.style.background = 'linear-gradient(135deg, rgba(0, 182, 212, 0.12), rgba(17, 17, 17, 0.85) 50%)';
        }
      }
    }

    const isLaunching = Store.get('isLaunching');
    const verifyOnLaunch = Store.get('verifyOnLaunch');
    if (statusBadge) {
      statusBadge.textContent = isLaunching ? '● Запущено' : (verifyOnLaunch !== false ? '● Готово к проверке' : '● Готово к запуску');
      statusBadge.style.color = isLaunching ? 'var(--success)' : 'var(--accent-hi)';
    }

    // Sync Play button states
    const btnPlay = document.getElementById('btn-play');
    const heroBtnPlay = document.getElementById('hero-btn-play');
    if (btnPlay) {
      if (isLaunching) {
        btnPlay.disabled = true;
        btnPlay.innerHTML = 'Игра запущена';
      } else {
        btnPlay.disabled = false;
        btnPlay.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Играть';
      }
    }
    if (heroBtnPlay) {
      if (isLaunching) {
        heroBtnPlay.disabled = true;
        heroBtnPlay.innerHTML = 'Запущено';
      } else {
        heroBtnPlay.disabled = false;
        heroBtnPlay.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Играть';
      }
    }
  },

  showCrashDiagnosticModal(diagnostic, code) {
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px; min-width: 420px; max-width: 600px; color: var(--text);">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-sm); background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 14px; color: #ef4444;">${diagnostic.title || `Сбой процесса (код ${code})`}</div>
            <div style="font-size: 11px; color: var(--text-2); margin-top: 2px;">Интеллектуальная диагностика Nexus Launcher</div>
          </div>
        </div>

        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-soft); border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px;">Причина сбоя:</div>
          <div style="font-size: 13px; color: var(--text); line-height: 1.5;">${diagnostic.reason || 'Причина не распознана автоматически.'}</div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #10b981; margin-bottom: 4px;">Решение:</div>
          <div style="font-size: 13px; color: var(--text); line-height: 1.5;">${diagnostic.solution || 'Ознакомьтесь с консолью лаунчера.'}</div>
        </div>

        ${diagnostic.logSnippet ? `
          <div>
            <div style="font-size: 11px; color: var(--text-3); margin-bottom: 6px;">Фрагмент лога ошибки:</div>
            <pre style="background: #08080a; border: 1px solid var(--border-line); border-radius: var(--radius-sm); padding: 10px; font-size: 11px; font-family: monospace; color: #f87171; max-height: 140px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">${diagnostic.logSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        ` : ''}
      </div>
    `;

    const footer = document.createElement('div');
    footer.innerHTML = `
      <div style="display: flex; gap: 8px; justify-content: flex-end; width: 100%;">
        ${diagnostic.action ? `<button class="btn primary btn-diag-action">${diagnostic.action.label || 'Применить'}</button>` : ''}
        ${diagnostic.reportFile ? `<button class="btn outline btn-diag-report">Краш-репорт</button>` : ''}
        <button class="btn ghost btn-diag-close">Закрыть</button>
      </div>
    `;

    const modalInst = Modal.open({
      title: 'Диагностика сбоя Minecraft',
      body,
      footer,
      size: 'large'
    });

    footer.querySelector('.btn-diag-close').onclick = () => modalInst.close();

    const actionBtn = footer.querySelector('.btn-diag-action');
    if (actionBtn && diagnostic.action) {
      actionBtn.onclick = async () => {
        modalInst.close();
        if (diagnostic.action.type === 'open_folder') {
          await window.api.shell.openPath(diagnostic.action.target);
        } else if (diagnostic.action.type === 'navigate') {
          this.navigate(diagnostic.action.target);
        }
      };
    }

    const reportBtn = footer.querySelector('.btn-diag-report');
    if (reportBtn && diagnostic.reportFile) {
      reportBtn.onclick = async () => {
        await window.api.shell.openPath(diagnostic.reportFile);
      };
    }
  }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
