/* ═══ Servers view (Dedicated Server Monitoring - Reference Design) ═══ */
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

  const KNOWN_SERVERS = {
    hypixel: {
      tags: 'Мини-игры, BedWars, SkyWars и многое другое!',
      version: '1.8 - 1.21.5',
      website: 'https://hypixel.net',
      defaultOnline: '5823 / 30000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-hyp" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2a1f0a" />
              <stop offset="100%" stop-color="#140e04" />
            </linearGradient>
            <linearGradient id="gold-hyp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffd700" />
              <stop offset="100%" stop-color="#e67e22" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-hyp)" stroke="#f39c12" stroke-width="1.2" />
          <path d="M14 11v22h5v-9h6v9h5V11h-5v8h-6v-8h-5z" fill="url(#gold-hyp)" />
        </svg>
      `
    },
    mineblaze: {
      tags: 'Выживание, Мини-игры, Анархия',
      version: '1.12.2 - 1.21.5',
      website: 'https://mineblaze.ru',
      defaultOnline: '3421 / 10000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-mb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0f2b48" />
              <stop offset="100%" stop-color="#061220" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-mb)" stroke="#3498db" stroke-width="1.2" />
          <path d="M12 28l2-14 6 5 4-7 4 7 6-5 2 14H12z" fill="#f1c40f" />
          <circle cx="22" cy="24" r="2.5" fill="#3498db" />
        </svg>
      `
    },
    funtime: {
      tags: 'Анархия, Гриф, PvP',
      version: '1.16.5 - 1.21.5',
      website: 'https://funtime.su',
      defaultOnline: '2719 / 10000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-ft" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#4a0f1a" />
              <stop offset="100%" stop-color="#1f0409" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-ft)" stroke="#e74c3c" stroke-width="1.2" />
          <circle cx="22" cy="22" r="14" fill="#c0392b" opacity="0.4" />
          <text x="22" y="27" font-family="Arial, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">FT</text>
        </svg>
      `
    },
    reallyworld: {
      tags: 'Выживание, Анархия, Гриф',
      version: '1.12.2 - 1.21.5',
      website: 'https://reallyworld.ru',
      defaultOnline: '1954 / 7000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-rw" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#3d1e06" />
              <stop offset="100%" stop-color="#1a0c02" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-rw)" stroke="#e67e22" stroke-width="1.2" />
          <path d="M22 10c-3 5-7 8-7 13a7 7 0 0 0 14 0c0-5-4-8-7-13z" fill="#f39c12" />
          <text x="22" y="32" font-family="Arial, sans-serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle">RW</text>
        </svg>
      `
    },
    cubecraft: {
      tags: 'Мини-игры, EggWars, Lucky Islands',
      version: '1.9 - 1.21.5',
      website: 'https://cubecraft.net',
      defaultOnline: '890 / 5000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-cc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0d3536" />
              <stop offset="100%" stop-color="#041819" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-cc)" stroke="#1abc9c" stroke-width="1.2" />
          <rect x="14" y="14" width="16" height="16" rx="4" fill="none" stroke="#1abc9c" stroke-width="3" />
          <text x="22" y="27" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle">C</text>
        </svg>
      `
    },
    workshop47: {
      tags: 'RolePlay, Сталкер, Оружие, Выживание',
      version: '1.12.2 - 1.20.4',
      website: 'https://workshop47.pro',
      defaultOnline: '1150 / 3000',
      iconHtml: `
        <svg viewBox="0 0 44 44" width="44" height="44">
          <defs>
            <linearGradient id="grad-m47" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2a2215" />
              <stop offset="100%" stop-color="#120e06" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="10" fill="url(#grad-m47)" stroke="#d97706" stroke-width="1.2" />
          <!-- Gear outline -->
          <circle cx="22" cy="22" r="13" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 2" />
          <circle cx="22" cy="22" r="7" fill="#1e180e" />
          <text x="22" y="26" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#fbbf24" text-anchor="middle">47</text>
        </svg>
      `
    }
  };

  function defaultGenericIcon(name) {
    const char = (name || 'S').charAt(0).toUpperCase();
    return `
      <svg viewBox="0 0 44 44" width="44" height="44">
        <rect width="44" height="44" rx="10" fill="#1b2432" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
        <text x="22" y="28" font-family="Arial, sans-serif" font-weight="800" font-size="16" fill="#3b82f6" text-anchor="middle">${esc(char)}</text>
      </svg>
    `;
  }

  window.Views.servers = {
    _servers: [],
    _pingCache: {},
    _searchTerm: '',
    _versionFilter: 'all',

    async render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      c.style.display = 'block';

      c.innerHTML = `
        <div class="view servers-view" style="padding: 24px 30px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;">
          <!-- Top Header Row matching Reference Photo (Left Window) -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 14px; height: 14px; border: 2px solid #5b8cff; border-radius: 50%; box-shadow: 0 0 10px rgba(91,140,255,0.5);"></div>
              <h1 style="font-size: 21px; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.01em;">Серверы</h1>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <!-- Search box with magnifying glass -->
              <div style="position: relative; width: 260px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="input" id="servers-search" placeholder="Поиск серверов..." value="${esc(this._searchTerm)}" style="width: 100%; height: 38px; padding-left: 36px; font-size: 13px; border-radius: 10px; background: rgba(0,0,0,0.32); border: 1px solid var(--border-soft);">
              </div>

              <!-- Version filter dropdown -->
              <select class="input" id="servers-version-filter" style="height: 38px; font-size: 13px; border-radius: 10px; background: rgba(0,0,0,0.32); border: 1px solid var(--border-soft); padding: 0 12px; min-width: 130px;">
                <option value="all" ${this._versionFilter === 'all' ? 'selected' : ''}>Все версии</option>
                <option value="1.21" ${this._versionFilter === '1.21' ? 'selected' : ''}>1.21.x</option>
                <option value="1.20" ${this._versionFilter === '1.20' ? 'selected' : ''}>1.20.x</option>
                <option value="1.19" ${this._versionFilter === '1.19' ? 'selected' : ''}>1.19.x</option>
                <option value="1.16" ${this._versionFilter === '1.16' ? 'selected' : ''}>1.16.5</option>
                <option value="1.12" ${this._versionFilter === '1.12' ? 'selected' : ''}>1.12.2</option>
                <option value="1.8" ${this._versionFilter === '1.8' ? 'selected' : ''}>1.8.9</option>
              </select>

              <!-- Add server button -->
              <button class="btn outline" id="btn-add-server" title="Добавить сервер в мониторинг" style="height: 38px; padding: 0 14px; font-size: 13px; font-weight: 700; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Добавить
              </button>
            </div>
          </div>

          <!-- Server List Rows Container -->
          <div id="servers-list-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
            <div class="empty-state" style="padding: 40px;"><span class="spinner"></span> Загрузка серверов…</div>
          </div>
        </div>
      `;

      // Event handlers
      const searchInput = document.getElementById('servers-search');
      if (searchInput) {
        searchInput.oninput = (e) => {
          this._searchTerm = e.target.value.toLowerCase().trim();
          this.renderRows();
        };
      }

      const versionSelect = document.getElementById('servers-version-filter');
      if (versionSelect) {
        versionSelect.onchange = (e) => {
          this._versionFilter = e.target.value;
          this.renderRows();
        };
      }

      const addBtn = document.getElementById('btn-add-server');
      if (addBtn) {
        addBtn.onclick = () => this.showAddServerModal();
      }

      await this.loadServers();
    },

    async loadServers() {
      try {
        const list = await window.api.invoke('servers:list');
        const defaultOrder = ['hypixel', 'mineblaze', 'funtime', 'reallyworld', 'cubecraft', 'workshop47'];
        const existingIds = new Set(list.map(s => s.id));
        for (const defId of defaultOrder) {
          if (!existingIds.has(defId) && KNOWN_SERVERS[defId]) {
            list.push({
              id: defId,
              name: defId === 'hypixel' ? 'Hypixel Network' :
                    defId === 'mineblaze' ? 'MineBlaze' :
                    defId === 'funtime' ? 'Funtime' :
                    defId === 'reallyworld' ? 'ReallyWorld' :
                    defId === 'workshop47' ? 'Мастерская 47' : 'CubeCraft Games',
              address: defId === 'hypixel' ? 'mc.hypixel.net' :
                       defId === 'mineblaze' ? 'play.mineblaze.ru' :
                       defId === 'funtime' ? 'mc.funtime.su' :
                       defId === 'reallyworld' ? 'mc.reallyworld.ru' :
                       defId === 'workshop47' ? 'mc.workshop47.pro' : 'play.cubecraft.net'
            });
          }
        }
        this._servers = list.filter(s => s.id !== 'lololoshka' && s.id !== 'vimeworld');
        const w47 = this._servers.find(s => s.id === 'workshop47');
        if (w47) w47.address = 'mc.workshop47.pro';
        this.renderRows();
        this.pingAll();
      } catch (err) {
        const c = document.getElementById('servers-list-container');
        if (c) c.innerHTML = `<div style="color:var(--error);font-size:13px;padding:24px;">Ошибка загрузки серверов: ${esc(err.message)}</div>`;
      }
    },

    renderRows() {
      const container = document.getElementById('servers-list-container');
      if (!container) return;

      let list = (this._servers || []).slice();

      if (this._searchTerm) {
        list = list.filter(s =>
          (s.name && s.name.toLowerCase().includes(this._searchTerm)) ||
          (s.address && s.address.toLowerCase().includes(this._searchTerm)) ||
          (KNOWN_SERVERS[s.id]?.tags && KNOWN_SERVERS[s.id].tags.toLowerCase().includes(this._searchTerm))
        );
      }

      if (this._versionFilter && this._versionFilter !== 'all') {
        list = list.filter(s => {
          const v = KNOWN_SERVERS[s.id]?.version || '';
          return v.includes(this._versionFilter);
        });
      }

      if (!list.length) {
        container.innerHTML = `
          <div class="card empty-state" style="padding: 40px; text-align: center; color: var(--text-2);">
            Серверы по вашему запросу не найдены.
          </div>
        `;
        return;
      }

      container.innerHTML = list.map(s => {
        const meta = KNOWN_SERVERS[s.id] || {};
        const iconHtml = meta.iconHtml || defaultGenericIcon(s.name);
        const tags = meta.tags || (s.address ? `Адрес: ${s.address}` : 'Пользовательский сервер');
        const version = meta.version || '1.8 - 1.21.5';
        const pingData = this._pingCache[s.id];

        let onlineText = meta.defaultOnline || '— / —';
        let isOnline = true;
        let faviconHtml = iconHtml;

        if (pingData) {
          isOnline = pingData.online !== false;
          if (pingData.players) {
            onlineText = `${pingData.players.online.toLocaleString('ru-RU')} / ${pingData.players.max.toLocaleString('ru-RU')}`;
          }
          if (pingData.icon) {
            faviconHtml = `<img src="${esc(pingData.icon)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
          }
        }

        return `
          <div class="server-card-row card" data-srv-id="${s.id}" data-srv-addr="${esc(s.address)}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-radius: 14px; background: rgba(18,22,30,0.65); border: 1px solid rgba(255,255,255,0.06); transition: all 180ms ease; cursor: pointer;">
            <!-- Column 1: Icon + Name + Tags -->
            <div style="display: flex; align-items: center; gap: 16px; flex: 1.6; min-width: 0;">
              <div id="srv-icon-${s.id}" style="flex-shrink: 0; width: 44px; height: 44px; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                ${faviconHtml}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 15px; font-weight: 750; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(s.name)}</div>
                <div style="font-size: 12px; color: #8a96a3; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(tags)}</div>
              </div>
            </div>

            <!-- Column 2: Version -->
            <div style="flex: 1; text-align: center; font-size: 13px; color: #8a96a3; font-weight: 500;">
              ${esc(version)}
            </div>

            <!-- Column 3: Players Online -->
            <div style="flex: 1; text-align: center; font-size: 13px; color: #8a96a3; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span id="srv-online-${s.id}">${onlineText}</span>
            </div>

            <!-- Column 4: Status Indicator -->
            <div style="flex: 0.9; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 7px; font-size: 12px; font-weight: 650; color: ${isOnline ? '#2ecc71' : '#e74c3c'};">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${isOnline ? '#2ecc71' : '#e74c3c'}; box-shadow: 0 0 8px ${isOnline ? 'rgba(46,204,113,0.6)' : 'rgba(231,76,60,0.6)'};"></span>
              <span id="srv-status-${s.id}">${isOnline ? 'Онлайн' : 'Оффлайн'}</span>
            </div>

            <!-- Column 5: Menu Action Button -->
            <div style="margin-left: 20px; position: relative;">
              <button class="btn ghost btn-srv-menu" data-id="${s.id}" data-addr="${esc(s.address)}" title="Действия" style="padding: 6px 10px; border-radius: 8px; color: #8a96a3;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Add hover and click effects
      container.querySelectorAll('.server-card-row').forEach(row => {
        row.onmouseenter = () => {
          row.style.background = 'rgba(28,34,48,0.75)';
          row.style.borderColor = 'rgba(91,140,255,0.3)';
        };
        row.onmouseleave = () => {
          row.style.background = 'rgba(18,22,30,0.65)';
          row.style.borderColor = 'rgba(255,255,255,0.06)';
        };

        row.onclick = (e) => {
          if (e.target.closest('.btn-srv-menu')) return;
          const srvId = row.dataset.srvId;
          const addr = row.dataset.srvAddr;
          this.showServerActionModal(srvId, addr);
        };
      });

      // Bind menu buttons
      container.querySelectorAll('.btn-srv-menu').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const srvId = btn.dataset.id;
          const addr = btn.dataset.addr;
          this.showServerActionModal(srvId, addr);
        };
      });
    },

    showServerActionModal(srvId, addr) {
      const s = this._servers.find(x => x.id === srvId) || { name: srvId, address: addr };
      const meta = KNOWN_SERVERS[srvId] || {};
      const pingData = this._pingCache[srvId];
      const iconHtml = (pingData && pingData.icon)
        ? `<img src="${esc(pingData.icon)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`
        : (meta.iconHtml || defaultGenericIcon(s.name));

      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-soft);">
            <div style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 10px; overflow: hidden;">
              ${iconHtml}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">${esc(s.name)}</h3>
              <p style="margin: 3px 0 0; font-size: 12px; color: var(--text-2);">${esc(meta.tags || s.address)}</p>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 12px; color: var(--text-2);">Адрес сервера:</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input class="input" readonly value="${esc(s.address)}" style="flex: 1; height: 38px; font-size: 13px; font-family: monospace;">
              <button class="btn primary" id="btn-copy-ip-modal" style="height: 38px; padding: 0 16px; font-size: 12px; font-weight: 700;">
                Копировать
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; padding: 12px; background: rgba(0,0,0,0.25); border-radius: 10px;">
            <div>
              <span style="color: var(--text-3);">Версия:</span>
              <div style="font-weight: 700; color: var(--text);">${esc(meta.version || '1.8 - 1.21.5')}</div>
            </div>
            <div>
              <span style="color: var(--text-3);">Статус:</span>
              <div style="font-weight: 700; color: #2ecc71;">● В сети</div>
            </div>
          </div>
        </div>
      `;

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.width = '100%';
      footer.innerHTML = `
        <div>
          ${!KNOWN_SERVERS[srvId] ? '<button class="btn outline" id="btn-del-srv-modal" style="color:var(--error); border-color:rgba(231,76,60,0.4);">Удалить</button>' : ''}
        </div>
        <div style="display: flex; gap: 8px;">
          ${meta.website ? `<button class="btn outline" id="btn-web-srv-modal">Сайт</button>` : ''}
          <button class="btn primary" id="btn-play-srv-modal">Подключиться</button>
        </div>
      `;

      const inst = Modal.open({
        title: s.name,
        body,
        footer
      });

      body.querySelector('#btn-copy-ip-modal')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(s.address);
          Toast.success('IP скопирован в буфер обмена', s.address);
        } catch {
          Toast.info('IP адрес:', s.address);
        }
      });

      footer.querySelector('#btn-web-srv-modal')?.addEventListener('click', () => {
        if (meta.website) window.api.shell.openExternal(meta.website);
      });

      footer.querySelector('#btn-play-srv-modal')?.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(s.address);
        } catch {}
        inst.close();
        Toast.success('Подключение к серверу', `IP ${s.address} скопирован. Запустите игру для входа!`);
        const homeTab = document.querySelector('[data-view="home"]');
        if (homeTab) homeTab.click();
      });

      footer.querySelector('#btn-del-srv-modal')?.addEventListener('click', async () => {
        if (!confirm(`Удалить сервер ${s.name} из списка?`)) return;
        try {
          await window.api.invoke('servers:remove', srvId);
          inst.close();
          Toast.success('Сервер удален');
          await this.loadServers();
        } catch (err) {
          Toast.error('Ошибка', err.message);
        }
      });
    },

    async pingAll() {
      const list = this._servers || [];
      for (const s of list) {
        try {
          const res = await window.api.invoke('servers:ping', s.address);
          this._pingCache[s.id] = res;

          const elOnline = document.getElementById(`srv-online-${s.id}`);
          const elStatus = document.getElementById(`srv-status-${s.id}`);
          const iconEl = document.getElementById(`srv-icon-${s.id}`);

          if (res && res.online) {
            if (elOnline && res.players) {
              elOnline.textContent = `${res.players.online.toLocaleString('ru-RU')} / ${res.players.max.toLocaleString('ru-RU')}`;
            }
            if (elStatus) {
              elStatus.textContent = 'Онлайн';
              elStatus.parentElement.style.color = '#2ecc71';
              const dot = elStatus.previousElementSibling;
              if (dot) {
                dot.style.background = '#2ecc71';
                dot.style.boxShadow = '0 0 8px rgba(46,204,113,0.6)';
              }
            }
            if (res.icon && iconEl) {
              iconEl.innerHTML = `<img src="${res.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
            }
          }
        } catch {}
      }
    },

    showAddServerModal() {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px; min-width: 320px;">
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-2); display: block; margin-bottom: 6px;">Название сервера</label>
            <input type="text" id="new-srv-name" class="input" placeholder="Например: Мой сервер" style="width: 100%;" />
          </div>
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-2); display: block; margin-bottom: 6px;">IP адрес / Домен сервера</label>
            <input type="text" id="new-srv-addr" class="input" placeholder="mc.example.com или 127.0.0.1:25565" style="width: 100%;" />
          </div>
        </div>
      `;

      const footer = document.createElement('div');
      footer.innerHTML = `
        <button class="btn ghost btn-cancel">Отмена</button>
        <button class="btn primary btn-add">Добавить сервер</button>
      `;

      const inst = Modal.open({
        title: 'Добавить сервер в мониторинг',
        body,
        footer
      });

      footer.querySelector('.btn-cancel').onclick = () => inst.close();
      footer.querySelector('.btn-add').onclick = async () => {
        const name = body.querySelector('#new-srv-name').value.trim();
        const address = body.querySelector('#new-srv-addr').value.trim();
        if (!address) {
          Toast.error('Ошибка', 'Укажите адрес сервера');
          return;
        }
        try {
          await window.api.invoke('servers:add', { name: name || address, address });
          inst.close();
          Toast.success('Сервер добавлен', address);
          await this.loadServers();
        } catch (err) {
          Toast.error('Не удалось добавить сервер', err.message);
        }
      };
    },

    destroy() {}
  };
})();
