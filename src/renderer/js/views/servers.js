/* ═══ Servers view (Dedicated Server Monitoring) ═══ */
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

  window.Views.servers = {
    _servers: [],
    _searchTerm: '',

    async render() {
      const c = document.getElementById('view-container');
      const home = document.getElementById('home-view');
      document.querySelector('main.content').style.display = 'grid';
      if (home) home.style.display = 'none';
      c.style.display = 'block';

      c.innerHTML = `
        <div class="view servers-view" style="height: 100%; overflow-y: auto; padding-bottom: 40px;">
          <div class="settings-hero compact single">
            <div class="settings-hero-title" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div class="settings-hero-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2"/>
                    <rect x="2" y="14" width="20" height="8" rx="2"/>
                    <line x1="6" y1="6" x2="6.01" y2="6"/>
                    <line x1="6" y1="18" x2="6.01" y2="18"/>
                  </svg>
                </div>
                <div>
                  <div class="section-kicker">Сетевая игра</div>
                  <h1 style="font-size: 26px; margin: 0;">Мониторинг серверов</h1>
                  <p style="margin: 3px 0 0; color: var(--text-2); font-size: 13px;">Проверяйте онлайн игроков, статус и задержку (ping) серверов Minecraft в реальном времени.</p>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <button class="btn outline" id="btn-refresh-servers-view" style="display: flex; align-items: center; gap: 6px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  Обновить статус
                </button>
                <button class="btn primary" id="btn-add-server-view" style="display: flex; align-items: center; gap: 6px;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Добавить сервер
                </button>
              </div>
            </div>
          </div>

          <div class="card themes-single-card" style="margin-top: 14px; display: flex; flex-direction: column; gap: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; padding-bottom: 14px; border-bottom: 1px solid var(--border-soft);">
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Список игровых серверов</h3>
                <p style="margin: 2px 0 0; font-size: 12px; color: var(--text-2);">Нажмите на карточку любого сервера, чтобы скопировать его IP в буфер обмена.</p>
              </div>
              <div style="min-width: 220px;">
                <input class="input" id="servers-search" placeholder="Поиск по названию или IP..." style="width: 100%; font-size: 13px;" value="${esc(this._searchTerm || '')}">
              </div>
            </div>

            <div id="servers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
              <div style="color: var(--text-2); font-size: 13px; padding: 20px 0;"><span class="spinner"></span> Опрос серверов...</div>
            </div>
          </div>
        </div>
      `;

      // Handlers
      const refreshBtn = document.getElementById('btn-refresh-servers-view');
      const addBtn = document.getElementById('btn-add-server-view');
      const searchIn = document.getElementById('servers-search');

      if (refreshBtn) refreshBtn.onclick = () => this.refreshServers();
      if (addBtn) addBtn.onclick = () => this.showAddServerModal();
      if (searchIn) {
        searchIn.oninput = (e) => {
          this._searchTerm = e.target.value.toLowerCase().trim();
          this.renderList();
        };
      }

      await this.refreshServers();
    },

    async refreshServers() {
      try {
        this._servers = await window.api.invoke('servers:list');
        this.renderList();
        this.pingAll();
      } catch (err) {
        const grid = document.getElementById('servers-grid');
        if (grid) grid.innerHTML = `<div style="color:var(--error);font-size:13px;">Ошибка загрузки серверов: ${esc(err.message)}</div>`;
      }
    },

    renderList() {
      const grid = document.getElementById('servers-grid');
      if (!grid) return;

      let list = this._servers || [];
      if (this._searchTerm) {
        list = list.filter(s =>
          (s.name && s.name.toLowerCase().includes(this._searchTerm)) ||
          (s.address && s.address.toLowerCase().includes(this._searchTerm))
        );
      }

      if (!list.length) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: var(--text-2);">
            <div style="font-size: 36px; margin-bottom: 10px;">🌐</div>
            <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px;">Серверы не найдены</div>
            <div style="font-size: 13px;">Добавьте свой первый сервер кнопкой «Добавить сервер» выше.</div>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(s => `
        <div class="server-card-item server-box-${esc(s.id)}" data-addr="${esc(s.address)}" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-soft); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.2s ease; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div>
              <b style="font-size: 15px; color: var(--text); display: block; line-height: 1.3;">${esc(s.name)}</b>
              <span class="server-addr-val" style="font-family: monospace; font-size: 12px; color: var(--accent-hi); margin-top: 2px; display: inline-block;">${esc(s.address)}</span>
            </div>
            <span class="ping-badge-item" style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.06); color: var(--text-2); white-space: nowrap;">
              <span class="spinner" style="width:9px;height:9px;"></span>
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-soft); font-size: 12px; color: var(--text-2);">
            <div>
              <span>Игроки: </span>
              <strong class="players-val" style="color: var(--text);">—</strong>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn outline compact-btn btn-copy-ip" data-addr="${esc(s.address)}" title="Скопировать IP адрес" style="padding: 4px 8px; font-size: 11px;">
                Копировать IP
              </button>
              ${s.custom !== false ? `
                <button class="icon-button btn-del-srv" data-id="${esc(s.id)}" title="Удалить сервер" style="width: 26px; height: 26px; font-size: 12px; color: var(--error);">
                  ✕
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `).join('');

      // Copy IP handlers
      grid.querySelectorAll('.server-card-item').forEach(card => {
        card.onclick = async (e) => {
          if (e.target.closest('.btn-del-srv')) return;
          const addr = card.dataset.addr;
          try {
            await window.api.clipboard.write(addr);
            Toast.success('IP адрес скопирован!', addr);
          } catch {
            navigator.clipboard?.writeText(addr);
            Toast.success('IP скопирован', addr);
          }
        };
      });

      // Delete handlers
      grid.querySelectorAll('.btn-del-srv').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (!confirm('Удалить этот сервер из списка мониторинга?')) return;
          try {
            await window.api.invoke('servers:remove', id);
            Toast.success('Сервер удален');
            await this.refreshServers();
          } catch (err) {
            Toast.error('Ошибка удаления', err.message);
          }
        };
      });
    },

    async pingAll() {
      const list = this._servers || [];
      for (const s of list) {
        const card = document.querySelector(`.server-box-${s.id}`);
        if (!card) continue;
        try {
          const res = await window.api.invoke('servers:ping', s.address);
          const badge = card.querySelector('.ping-badge-item');
          const players = card.querySelector('.players-val');

          if (res.online) {
            const pingColor = res.latency < 60 ? '#10b981' : res.latency < 120 ? '#f59e0b' : '#ef4444';
            const pingBg = res.latency < 60 ? 'rgba(16,185,129,0.15)' : res.latency < 120 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
            if (badge) {
              badge.innerHTML = `● ${res.latency} ms`;
              badge.style.color = pingColor;
              badge.style.background = pingBg;
            }
            if (players && res.players) {
              players.textContent = `${res.players.online.toLocaleString()} / ${res.players.max.toLocaleString()}`;
            }
          } else {
            if (badge) {
              badge.innerHTML = '● Оффлайн';
              badge.style.color = '#ef4444';
              badge.style.background = 'rgba(239,68,68,0.15)';
            }
            if (players) players.textContent = 'Недоступен';
          }
        } catch {
          const badge = card.querySelector('.ping-badge-item');
          if (badge) {
            badge.innerHTML = '● Ошибка';
            badge.style.color = '#ef4444';
          }
        }
      }
    },

    showAddServerModal() {
      const body = document.createElement('div');
      body.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px; min-width: 320px;">
          <div class="form-group">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-2); display: block; margin-bottom: 6px;">Название сервера</label>
            <input type="text" id="new-srv-name" class="input" placeholder="Например: Мой любимый сервер" style="width: 100%;" />
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
          await this.refreshServers();
        } catch (err) {
          Toast.error('Не удалось добавить сервер', err.message);
        }
      };
    },

    destroy() {}
  };
})();
