/* ═══ Network & Virtual LAN View (Сетевая игра / P2P) ═══ */
window.Views = window.Views || {};

window.Views.radmin = {
  state: null,
  pollTimer: null,
  activeTab: 'host', // 'host' | 'client' | 'adapters' | 'rooms'
  pingResult: null,

  async render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    const mainContent = document.querySelector('main.content');
    if (mainContent) mainContent.style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';

    await this.fetchStatus();
    this.drawUI(c);
    this.startPolling();
  },

  async fetchStatus() {
    try {
      this.state = await window.api.invoke('radmin:get-status');
    } catch {
      this.state = {
        status: 'idle',
        virtualIp: '192.168.0.75',
        publicIp: null,
        adapters: [],
        savedNetworks: [],
        activeNetwork: null,
        lanGame: null,
        hostConfig: null,
        reflector: { active: false }
      };
    }
  },

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      try {
        const newState = await window.api.invoke('radmin:get-status');
        const prevLan = this.state && this.state.lanGame ? this.state.lanGame.port : null;
        const newLan = newState && newState.lanGame ? newState.lanGame.port : null;
        this.state = newState;

        // If a new LAN world is suddenly detected while on host tab, update the port input
        if (newLan && newLan !== prevLan) {
          const portInput = document.getElementById('net-host-port');
          if (portInput && (!portInput.value || portInput.value === '25565')) {
            portInput.value = newLan;
          }
        }

        this.updateDynamicFields();
      } catch {}
    }, 2500);
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  destroy() {
    this.stopPolling();
  },

  drawUI(c) {
    const s = this.state || {};
    const isHosting = !!(s.hostConfig && s.hostConfig.active);
    const lanGame = s.lanGame || null;
    const defaultPort = lanGame ? lanGame.port : 25565;

    c.innerHTML = `
      <style>
        .st-switch {
          position: relative;
          width: 40px;
          height: 22px;
          background: rgba(255,255,255,0.15);
          border-radius: 11px;
          cursor: pointer;
          transition: background 180ms ease;
          flex-shrink: 0;
          user-select: none;
        }
        .st-switch.on { background: var(--accent); }
        .st-switch::after {
          content: '';
          position: absolute;
          left: 3px;
          top: 3px;
          width: 16px;
          height: 16px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 180ms ease, background 180ms ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .st-switch.on::after {
          transform: translateX(18px);
          background: var(--bg);
        }
        .st-tab-btn {
          background: none;
          border: none;
          padding: 6px 16px;
          border-radius: 3px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-2);
          cursor: pointer;
          transition: all 160ms ease;
        }
        .st-tab-btn:hover {
          color: var(--text);
          background: rgba(255,255,255,0.06);
        }
        .st-tab-btn.active {
          background: var(--accent);
          color: var(--bg);
          font-weight: 700;
          box-shadow: 0 2px 10px var(--glow);
        }
        .st-input-row {
          display: flex;
          align-items: center;
          background: rgba(0,0,0,0.25);
          border: 1px solid var(--border-soft);
          border-radius: 3px;
          padding: 0 12px;
          height: 38px;
          gap: 10px;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .st-input-row:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--glow);
        }
        .st-input-row input, .st-input-row select {
          background: none;
          border: none;
          color: var(--text);
          font-size: 13px;
          width: 100%;
          height: 100%;
          outline: none;
        }
        .st-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-2);
          margin-bottom: 6px;
          display: block;
        }
        .st-group-box {
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--border-soft);
          border-radius: 4px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
      </style>

      <div class="view settings-single-card" style="padding: 24px 30px; max-width: 1100px; margin: 16px auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- Header & Navigation Sub-tabs -->
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="eyebrow" style="color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.06em;">Мультиплеер</span>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 3px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-soft); color: var(--text-2);">P2P / LAN Engine</span>
              </div>
              <h1 style="font-size: 24px; font-weight: 800; margin: 4px 0; color: var(--text);">Сетевая игра</h1>
              <p style="color: var(--text-2); font-size: 13px; margin: 0;">Совместная игра с друзьями в Minecraft: открывайте локальные миры, подключайтесь по IP и играйте без белого IP и без платных хостингов</p>
            </div>
            <div style="display: flex; gap: 10px;">
              <button class="btn outline" id="btn-net-refresh" style="display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Обновить
              </button>
            </div>
          </div>

          <!-- Sub-tabs: [Открыть мир для друзей (Хост)] [Присоединиться к другу] [Сетевые адаптеры] [Комнаты] -->
          <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px solid var(--border-soft); padding-bottom: 12px;">
            <button class="st-tab-btn ${this.activeTab === 'host' ? 'active' : ''}" data-tab="host">Стать хостом (Сервер)</button>
            <button class="st-tab-btn ${this.activeTab === 'client' ? 'active' : ''}" data-tab="client">Присоединиться к другу</button>
            <button class="st-tab-btn ${this.activeTab === 'adapters' ? 'active' : ''}" data-tab="adapters">Сетевые адаптеры и IP</button>
            <button class="st-tab-btn ${this.activeTab === 'rooms' ? 'active' : ''}" data-tab="rooms">Комнаты</button>
          </div>
        </div>

        <!-- Dynamic Content Body -->
        <div id="net-tab-content">
          ${this.renderTabContent(s, defaultPort)}
        </div>
      </div>
    `;

    // Sub-tab switching
    c.querySelectorAll('.st-tab-btn').forEach(btn => {
      btn.onclick = () => {
        this.activeTab = btn.dataset.tab;
        this.drawUI(c);
      };
    });

    const refreshBtn = c.querySelector('#btn-net-refresh');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        await this.fetchStatus();
        this.drawUI(c);
        if (window.Toast) Toast.success('Обновлено', 'Сетевой статус актуализирован');
      };
    }

    this.bindEvents(c);
  },

  renderTabContent(s, defaultPort) {
    const isHosting = !!(s.hostConfig && s.hostConfig.active);
    const lanGame = s.lanGame || null;

    if (this.activeTab === 'host') {
      return `
        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 20px;">
          <!-- Left Column: Host Controls -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Minecraft World Detection Banner -->
            <div class="st-group-box" style="border-left: 3px solid ${lanGame ? 'var(--accent)' : 'var(--border-soft)'};">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: ${lanGame ? 'var(--accent)' : 'var(--text)'};">
                    ${lanGame ? '🟢 Обнаружен открытый мир Minecraft' : '⚪ Мир в игре пока не открыт'}
                  </div>
                  <div style="font-size: 12.5px; color: var(--text-2); margin-top: 4px; line-height: 1.45;">
                    ${lanGame
                      ? `Название: <b>${lanGame.motd || 'Мир'}</b> • Локальный порт: <b style="color:var(--text);">${lanGame.port}</b>`
                      : 'Откройте одиночный мир в игре и нажмите <b>Esc → «Открыть для сети»</b>. Лаунчер автоматически перехватит порт!'
                    }
                  </div>
                </div>
                ${lanGame ? `
                  <button class="btn outline" id="btn-use-lan-port" style="padding: 4px 10px; font-size: 12px; white-space: nowrap;">
                    Использовать порт ${lanGame.port}
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Host Config Card -->
            <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">Параметры хоста</h3>

              <div>
                <label class="st-label">Порт игры (Minecraft LAN / Server Port)</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                  <input id="net-host-port" type="number" value="${isHosting ? s.hostConfig.port : defaultPort}" placeholder="25565" min="1024" max="65535">
                </div>
              </div>

              <div>
                <label class="st-label">Описание мира (MOTD)</label>
                <div class="st-input-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <input id="net-host-motd" type="text" value="${isHosting ? s.hostConfig.motd : (lanGame ? lanGame.motd : 'Мир для друзей')}" placeholder="Мир для друзей">
                </div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-soft); margin-top: 6px;">
                <div style="font-size: 12.5px; color: var(--text-2);">
                  Статус: <b style="color: ${isHosting ? 'var(--accent)' : 'var(--text-2)'};">${isHosting ? '● Активен' : 'Остановлен'}</b>
                </div>

                <button class="btn ${isHosting ? 'outline' : 'primary'}" id="btn-toggle-host" style="display: flex; align-items: center; gap: 8px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span>${isHosting ? 'Остановить хостинг' : 'Запустить сервер для друзей'}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Addresses to Share with Friends -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">Готовые адреса для друзей</h3>
              <p style="font-size: 12px; color: var(--text-2); margin: 0; line-height: 1.45;">
                Отправьте один из адресов ниже другу. Друг заходит в Minecraft → <b>Сетевая игра → Прямое подключение</b> и вставляет адрес!
              </p>

              <!-- Address 1: LAN / Radmin VPN -->
              <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent); letter-spacing: 0.04em;">Локальная сеть / Radmin VPN</span>
                  <span style="font-size: 10.5px; color: var(--text-2);">В одной сети / VPN</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #ffffff;" id="net-lan-addr-display">
                    ${isHosting ? s.hostConfig.fullLanAddress : `${s.virtualIp}:${defaultPort}`}
                  </span>
                  <button class="btn outline" id="btn-copy-lan-addr" style="padding: 4px 10px; font-size: 11.5px;">Копировать</button>
                </div>
              </div>

              <!-- Address 2: Public Internet IP -->
              <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-soft); border-radius: 4px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text); letter-spacing: 0.04em;">Публичный IP (Через интернет)</span>
                  <span style="font-size: 10.5px; color: var(--text-2);">${s.publicIp ? 'Определён автоматически' : 'Поиск...'}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #ffffff;" id="net-public-addr-display">
                    ${s.publicIp ? `${s.publicIp}:${isHosting ? s.hostConfig.port : defaultPort}` : 'Укажите роутер / UPnP'}
                  </span>
                  <button class="btn outline" id="btn-copy-public-addr" style="padding: 4px 10px; font-size: 11.5px;" ${!s.publicIp ? 'disabled' : ''}>Копировать</button>
                </div>
              </div>

              <!-- Instructions -->
              <div style="font-size: 12px; color: var(--text-2); line-height: 1.5; padding-top: 8px; border-top: 1px solid var(--border-soft);">
                <b>Как играть бесплатно без хостинга:</b>
                <ol style="margin: 6px 0 0 18px; padding: 0;">
                  <li>Если играете через <b>Radmin VPN</b> или <b>Wi-Fi</b>: оба подключитесь к одной сети и скопируйте первый адрес.</li>
                  <li>Если играете через <b>Интернет напрямую</b>: используйте второй адрес (убедитесь, что на роутере открыт порт).</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'client') {
      const reflectorActive = !!(s.reflector && s.reflector.active);
      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- Connect & Ping Test Card -->
          <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
            <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">Подключение к другу</h3>
            <p style="font-size: 12.5px; color: var(--text-2); margin: 0;">
              Вставьте IP-адрес или домен хоста, который вам прислал друг.
            </p>

            <div>
              <label class="st-label">Адрес сервера друга (IP:Порт)</label>
              <div class="st-input-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <input id="net-client-target" type="text" placeholder="например, 26.120.45.10:54321 или 192.168.0.75:25565">
              </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 4px;">
              <button class="btn primary" id="btn-ping-target" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Проверить связь (Пинг)
              </button>
              <button class="btn outline" id="btn-copy-target-for-game">
                Копировать в игру
              </button>
            </div>

            <div id="net-ping-result-box" style="margin-top: 6px;">
              ${this.pingResult ? `
                <div style="padding: 10px 14px; border-radius: 4px; font-size: 12.5px; background: ${this.pingResult.online ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 85, 85, 0.1)'}; border: 1px solid ${this.pingResult.online ? 'var(--accent)' : 'var(--error)'}; color: ${this.pingResult.online ? 'var(--accent-hi)' : 'var(--error)'};">
                  ${this.pingResult.online ? `🟢 Сервер онлайн! Пинг: <b>${this.pingResult.ping} ms</b> (${this.pingResult.host}:${this.pingResult.port})` : `🔴 Сервер недоступен: ${this.pingResult.message}`}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- LAN Reflector Assistant Card -->
          <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">LAN-ретранслятор в игре</h3>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 3px; background: ${reflectorActive ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.06)'}; color: ${reflectorActive ? 'var(--accent)' : 'var(--text-2)'}; font-weight: 600;">
                ${reflectorActive ? 'Активен' : 'Отключен'}
              </span>
            </div>

            <p style="font-size: 12.5px; color: var(--text-2); margin: 0; line-height: 1.5;">
              Транслирует сервер друга прямо в игровое меню Minecraft <b>«Сетевая игра»</b> через локальный широковещательный поиск (UDP Multicast). Сервер появится в списке миров так, будто друг сидит с вами за одним роутером!
            </p>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-top: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft);">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text);">Автопоказ в списке серверов</div>
                <div style="font-size: 11.5px; color: var(--text-2);">Генерировать локальный анонс мира</div>
              </div>
              <button class="btn ${reflectorActive ? 'outline' : 'primary'}" id="btn-toggle-reflector" style="padding: 6px 14px; font-size: 12.5px;">
                ${reflectorActive ? 'Отключить' : 'Включить ретранслятор'}
              </button>
            </div>

            <div style="font-size: 12px; color: var(--text-2); line-height: 1.45;">
              💡 <b>Совет:</b> Если ретранслятор не требуется, просто скопируйте адрес друга и введите его в Minecraft через <b>Сетевая игра → Прямое подключение</b>.
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'adapters') {
      const adapters = s.adapters || [];
      return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">Сетевые интерфейсы вашего ПК</h3>
                <p style="font-size: 12px; color: var(--text-2); margin: 2px 0 0;">Реальные IP-адреса для подключения других игроков в локальной или виртуальной сети</p>
              </div>
              <div style="font-size: 12px; color: var(--text-2);">
                Публичный IP: <b style="color: var(--accent);">${s.publicIp || 'Загрузка...'}</b>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${adapters.length ? adapters.map(a => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-soft); border-radius: 4px;">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text);">${a.label}</div>
                    <div style="font-size: 11.5px; color: var(--text-2);">Интерфейс: <span style="color:var(--text);">${a.interface}</span> • Маска: ${a.netmask || '255.255.255.0'}</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: var(--accent);">${a.ip}</span>
                    <button class="btn outline" style="padding: 4px 10px; font-size: 11.5px;" onclick="navigator.clipboard.writeText('${a.ip}'); Toast.success('IP скопирован', '${a.ip}');">
                      Копировать
                    </button>
                  </div>
                </div>
              `).join('') : `
                <div style="padding: 20px; text-align: center; color: var(--text-2); font-size: 13px;">
                  Сетевые адаптеры не обнаружены
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'rooms') {
      const saved = s.savedNetworks || [];
      return `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="st-group-box" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text); margin: 0;">Сохранённые комнаты и сети</h3>
                <p style="font-size: 12px; color: var(--text-2); margin: 2px 0 0;">Быстрое переключение между комнатами для совместной игры</p>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn primary" id="btn-add-room" style="padding: 6px 14px; font-size: 12.5px;">+ Создать комнату</button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${saved.length ? saved.map(r => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-soft); border-radius: 4px;">
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: var(--text);">${r.name}</div>
                    <div style="font-size: 11px; color: var(--text-2);">${r.isOwner ? 'Владелец' : 'Участник'}</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn outline" style="padding: 4px 10px; font-size: 11.5px;" onclick="window.Views.radmin.connect('${r.name}')">Выбрать</button>
                    <button class="icon-button" style="width: 26px; height: 26px; color: var(--error);" title="Удалить" onclick="window.Views.radmin.deleteRoom('${r.id}')">✕</button>
                  </div>
                </div>
              `).join('') : `
                <div style="padding: 24px; text-align: center; color: var(--text-2); font-size: 13px;">
                  Нет сохранённых комнат
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    return '';
  },

  bindEvents(c) {
    const s = this.state || {};
    const defaultPort = (s.lanGame && s.lanGame.port) ? s.lanGame.port : 25565;

    // Use LAN Port button
    const useLanBtn = c.querySelector('#btn-use-lan-port');
    if (useLanBtn && s.lanGame) {
      useLanBtn.onclick = () => {
        const portInput = c.querySelector('#net-host-port');
        if (portInput) portInput.value = s.lanGame.port;
        if (window.Toast) Toast.info('Порт обновлен', `Установлен порт ${s.lanGame.port}`);
      };
    }

    // Toggle Host Button
    const toggleHostBtn = c.querySelector('#btn-toggle-host');
    if (toggleHostBtn) {
      toggleHostBtn.onclick = async () => {
        const isHosting = !!(s.hostConfig && s.hostConfig.active);
        try {
          if (isHosting) {
            this.state = await window.api.invoke('radmin:stop-host');
            if (window.Toast) Toast.info('Хостинг остановлен', 'Сетевой сервер отключен');
          } else {
            const portInput = c.querySelector('#net-host-port');
            const motdInput = c.querySelector('#net-host-motd');
            const port = portInput ? parseInt(portInput.value, 10) : defaultPort;
            const motd = motdInput ? motdInput.value : 'Nexus LAN Game';

            this.state = await window.api.invoke('radmin:start-host', { port, motd });
            if (window.Toast) Toast.success('Хостинг запущен', `Сервер открыт на порту ${port}`);
          }
          this.drawUI(c);
        } catch (err) {
          if (window.Toast) Toast.error('Ошибка хостинга', err.message || String(err));
        }
      };
    }

    // Copy LAN Address Button
    const copyLanBtn = c.querySelector('#btn-copy-lan-addr');
    if (copyLanBtn) {
      copyLanBtn.onclick = () => {
        const disp = c.querySelector('#net-lan-addr-display');
        const text = disp ? disp.textContent.trim() : `${s.virtualIp}:${defaultPort}`;
        navigator.clipboard.writeText(text);
        if (window.Toast) Toast.success('Скопировано', `Адрес ${text} помещён в буфер обмена`);
      };
    }

    // Copy Public Address Button
    const copyPubBtn = c.querySelector('#btn-copy-public-addr');
    if (copyPubBtn && s.publicIp) {
      copyPubBtn.onclick = () => {
        const disp = c.querySelector('#net-public-addr-display');
        const text = disp ? disp.textContent.trim() : `${s.publicIp}:${defaultPort}`;
        navigator.clipboard.writeText(text);
        if (window.Toast) Toast.success('Скопировано', `Публичный IP ${text} скопирован`);
      };
    }

    // Ping Server Target Button
    const pingBtn = c.querySelector('#btn-ping-target');
    if (pingBtn) {
      pingBtn.onclick = async () => {
        const targetInput = c.querySelector('#net-client-target');
        const addr = targetInput ? targetInput.value.trim() : '';
        if (!addr) {
          if (window.Toast) Toast.warning('Введите адрес', 'Укажите IP или хост друга с портом');
          return;
        }

        pingBtn.disabled = true;
        pingBtn.textContent = 'Проверка...';

        try {
          const res = await window.api.invoke('radmin:ping-server', addr, 25565);
          this.pingResult = res;
          this.drawUI(c);
        } catch (err) {
          this.pingResult = { online: false, message: err.message };
          this.drawUI(c);
        } finally {
          pingBtn.disabled = false;
        }
      };
    }

    // Copy Target for Game Button
    const copyTargetBtn = c.querySelector('#btn-copy-target-for-game');
    if (copyTargetBtn) {
      copyTargetBtn.onclick = () => {
        const targetInput = c.querySelector('#net-client-target');
        const addr = targetInput ? targetInput.value.trim() : '';
        if (!addr) {
          if (window.Toast) Toast.warning('Введите адрес', 'Поле адреса пустое');
          return;
        }
        navigator.clipboard.writeText(addr);
        if (window.Toast) Toast.success('Скопировано', 'Вставьте адрес в Minecraft: Сетевая игра → Прямое подключение');
      };
    }

    // Toggle LAN Reflector Button
    const toggleReflBtn = c.querySelector('#btn-toggle-reflector');
    if (toggleReflBtn) {
      toggleReflBtn.onclick = async () => {
        const isRefl = !!(s.reflector && s.reflector.active);
        try {
          if (isRefl) {
            await window.api.invoke('radmin:stop-reflector');
            if (window.Toast) Toast.info('Ретранслятор отключен', 'Локальный анонс мира остановлен');
          } else {
            const targetInput = c.querySelector('#net-client-target');
            const addr = targetInput ? targetInput.value.trim() : '';
            if (!addr) {
              if (window.Toast) Toast.warning('Укажите адрес', 'Введите адрес сервера друга перед включением');
              return;
            }
            let host = addr;
            let port = 25565;
            if (addr.includes(':')) {
              const parts = addr.split(':');
              host = parts[0];
              port = parseInt(parts[1], 10) || 25565;
            }

            await window.api.invoke('radmin:start-reflector', { hostAddress: host, port, motd: 'Сервер друга' });
            if (window.Toast) Toast.success('Ретранслятор запущен', 'Сервер теперь виден в локальном поиске Minecraft!');
          }
          await this.fetchStatus();
          this.drawUI(c);
        } catch (err) {
          if (window.Toast) Toast.error('Ошибка ретранслятора', err.message || String(err));
        }
      };
    }

    // Add Room Button
    const addRoomBtn = c.querySelector('#btn-add-room');
    if (addRoomBtn) {
      addRoomBtn.onclick = () => {
        const name = prompt('Введите название новой комнаты:');
        if (name && name.trim()) {
          window.api.invoke('radmin:create-network', name.trim(), '')
            .then(st => {
              this.state = st;
              this.drawUI(c);
              if (window.Toast) Toast.success('Комната создана', name);
            })
            .catch(err => {
              if (window.Toast) Toast.error('Ошибка создания', err.message || String(err));
            });
        }
      };
    }
  },

  async connect(name) {
    try {
      this.state = await window.api.invoke('radmin:connect', name, '');
      const c = document.getElementById('view-container');
      if (c) this.drawUI(c);
      if (window.Toast) Toast.success('Комната выбрана', name);
    } catch (err) {
      if (window.Toast) Toast.error('Ошибка подключения', err.message || String(err));
    }
  },

  async deleteRoom(id) {
    if (!confirm('Удалить эту комнату?')) return;
    try {
      this.state = await window.api.invoke('radmin:delete-network', id);
      const c = document.getElementById('view-container');
      if (c) this.drawUI(c);
      if (window.Toast) Toast.info('Комната удалена', '');
    } catch (err) {
      if (window.Toast) Toast.error('Ошибка удаления', err.message || String(err));
    }
  },

  updateDynamicFields() {
    // Light live DOM updates if user is not actively typing
  }
};
