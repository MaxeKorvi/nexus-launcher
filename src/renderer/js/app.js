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
      document.body.classList.remove('light-theme');
      document.body.classList.toggle('theme-glass-dark', s.theme === 'glass-dark');
      document.body.classList.toggle('theme-acrylic', s.theme === 'acrylic');
      document.body.classList.toggle('theme-emerald', s.theme === 'emerald');
      document.body.classList.toggle('theme-crimson', s.theme === 'crimson');
      document.body.classList.toggle('no-animations', s.animations === false);
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
        <div class="drawer-row-top"><b>${Shared.escapeHtml(item.label || item.id)}</b><span>${status}${item.attempt ? ` · ${item.attempt}/${item.attempts}` : ''}</span></div>
        <div class="progress"><div class="fill" style="width:${pct}%"></div></div>
        <small>${total ? `${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` : Shared.escapeHtml(item.path || '')}</small>
      </div>`;
    }).join('') : (this._downloadJustFinished && completed.length ? '<div class="empty-state">Установка завершена</div>' : '<div class="empty-state">Нет загрузок</div>');

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
    window.api.on('launcher:stopped', ({ code, error }) => {
      Store.set('isLaunching', false);
      this.updateHomeProfile();
      if (Number(code) === 1) Toast.error('Minecraft завершился с кодом 1', error || 'Откройте консоль лаунчера — туда выведена диагностика запуска.');
      else Toast.info('Minecraft закрыт', `Код выхода: ${code}`);
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
      el('user-avatar').textContent = (active.nickname || '?').charAt(0).toUpperCase();
      el('user-nick').textContent = active.nickname;
      el('user-provider').textContent = active.type === 'microsoft' ? 'Microsoft аккаунт' : active.type === 'ely' ? 'Ely.by аккаунт' : 'Локальный аккаунт';
      el('user-status').textContent = active.status === 'connected' ? '● В сети' : '● Оффлайн';
      el('user-status').style.color = active.status === 'connected' ? 'var(--success)' : 'var(--error)';
      el('bottom-account').textContent = active.nickname;
    } else {
      el('user-avatar').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      el('user-nick').textContent = 'Гость';
      el('user-provider').textContent = 'Войдите в аккаунт';
      el('user-status').textContent = 'Оффлайн';
      el('bottom-account').textContent = '—';
    }
    this.updateHomeProfile();
  },

  async loadNews() {
    try {
      const r = await window.api.invoke('news:list');
      Store.set('news', r.items);
      const el = document.getElementById('news-list');
      if (!r.items.length) {
        el.innerHTML = '<div class="empty-state">Новости недоступны</div>';
        return;
      }
      el.innerHTML = r.items.slice(0, 3).map((n, i) => `
        <div class="news-item" data-link="${Shared.escapeHtml(n.link)}" style="animation-delay:${i * 40}ms;">
          <div class="thumb" style="${n.image ? `background-image:url('${Shared.escapeHtml(n.image)}')` : 'background:linear-gradient(135deg,var(--accent),var(--accent-hi));'}"></div>
          <div class="body">
            <h3>${Shared.escapeHtml(n.title)}</h3>
            <div class="date">${n.pubDate ? new Date(n.pubDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
            <p>${Shared.escapeHtml(n.description || '')}</p>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.news-item').forEach(it => it.onclick = () => window.api.shell.openExternal(it.dataset.link));
    } catch (e) {
      const el = document.getElementById('news-list');
      const cached = Store.get('news') || [];
      if (cached.length) {
        el.innerHTML = cached.slice(0, 3).map(n => `<div class="news-item" data-link="${Shared.escapeHtml(n.link)}"><div class="body"><h3>${Shared.escapeHtml(n.title)}</h3><p>${Shared.escapeHtml(n.description || '')}</p></div></div>`).join('');
        el.querySelectorAll('.news-item').forEach(it => it.onclick = () => window.api.shell.openExternal(it.dataset.link));
      } else {
        el.innerHTML = '<div class="empty-state">Новости временно недоступны. Открыть официальный сайт Minecraft можно кнопкой обновления.</div>';
      }
    }
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
      const result = await window.api.invoke('versions:repair', selectedModpack
        ? { versionId, gameDir: selectedModpack.path }
        : { versionId, gameDir: Store.get('selectedInstallPath') || null });
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
    const selected = Store.get('selectedVersion');
    let folder = Store.get('selectedInstallPath');
    if (!folder) {
      try {
        const paths = await window.api.invoke('versions:get-storage-paths', selected || null);
        folder = selected ? (paths.selected || paths.all) : paths.all;
      } catch {}
    }
    if (!folder) return Toast.error('Папка не найдена', 'Сначала выберите установленную версию');
    try {
      const error = await window.api.shell.openPath(folder);
      if (error) throw new Error(error);
    } catch (error) {
      Toast.error('Не удалось открыть папку', error.message || String(error));
    }
  },

  async launch() {
    const versionId = Store.get('selectedVersion') || document.getElementById('bottom-version').textContent;
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
    Toast.info('Запуск', `Minecraft ${versionId}…`);
    this.navigate('console');
    Store.set('isLaunching', true);
    this.updateHomeProfile();
    try {
      const selectedModpack = Store.get('selectedModpack');
      const result = await window.api.invoke('launch:start', { versionId, accountId: active.id, modpackPath: selectedModpack ? selectedModpack.path : (Store.get('selectedInstallPath') || null) });
      if (!result || result.ok === false) throw new Error('Minecraft уже запущен');
      if (result.versionId && result.versionId !== versionId) {
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
    const selectedVersion = Store.get('selectedVersion') || '—';
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
      if (selectedModpack) {
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
  }
};

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
