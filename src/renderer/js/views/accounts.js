/* ═══ Accounts view ═══ */
window.Views = window.Views || {};

window.Views.accounts = {
  pollCancel: false,
  searchTerm: '',
  sortBy: 'default',

  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    document.querySelector('main.content').style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';

    c.innerHTML = `
      <div class="view accounts-view" style="padding: 24px; max-width: 1360px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- Top Hero Banner (Photo 3) -->
        <div class="card" style="padding: 24px 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; background: linear-gradient(135deg, rgba(20,26,23,0.85) 0%, rgba(12,15,14,0.95) 100%); border: 1px solid var(--border-soft); border-radius: 18px; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -40px; top: -40px; width: 180px; height: 180px; background: var(--accent-glow); filter: blur(60px); pointer-events: none; opacity: 0.3;"></div>
          <div>
            <div style="color: var(--accent-hi); font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 4px;">NEXUS ACCOUNTS</div>
            <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: var(--text);">Аккаунты</h1>
            <p style="margin: 6px 0 0; color: var(--text-2); font-size: 13px; max-width: 600px; line-height: 1.5;">Управляйте своими профилями Minecraft. Поддержка Microsoft, Ely.by и локальных аккаунтов с безопасным хранением данных.</p>
          </div>
          <div class="card" style="padding: 12px 18px; display: flex; align-items: center; gap: 14px; background: rgba(46, 204, 113, 0.08); border: 1px solid rgba(46, 204, 113, 0.25); border-radius: 14px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(46, 204, 113, 0.15); display: grid; place-items: center; color: #2ecc71; font-size: 18px;">
              🛡️
            </div>
            <div>
              <div style="color: #2ecc71; font-weight: 700; font-size: 13px;">Ваши аккаунты в безопасности</div>
              <div style="color: var(--text-2); font-size: 11px; margin-top: 2px;">Все токены шифруются локально на ПК</div>
            </div>
          </div>
        </div>

        <!-- 2-Column Split (Photo 3) -->
        <div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: 20px; align-items: start;">
          <!-- Left Column -->
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Methods Block -->
            <div>
              <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.1em; color: var(--text-2); text-transform: uppercase; margin-bottom: 12px;">Способ входа</div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                <!-- Microsoft -->
                <div class="card acc-method-card" id="add-ms" style="padding: 18px 16px; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border-soft); transition: all 200ms ease;">
                  <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(0,164,239,0.12); display: grid; place-items: center; font-size: 18px;">
                    <svg width="20" height="20" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="13" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="13" width="10" height="10" fill="#00a4ef"/><rect x="13" y="13" width="10" height="10" fill="#ffb900"/></svg>
                  </div>
                  <div>
                    <div style="font-weight: 800; font-size: 15px; color: var(--text);">Microsoft</div>
                    <div style="font-size: 12px; color: var(--accent-hi); margin-top: 2px;">Лицензионный аккаунт</div>
                  </div>
                  <div style="font-size: 11px; color: var(--text-3); line-height: 1.4;">Официальный OAuth через браузер без ввода пароля в лаунчере</div>
                </div>

                <!-- Ely.by -->
                <div class="card acc-method-card" id="add-ely" style="padding: 18px 16px; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border-soft); transition: all 200ms ease;">
                  <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(46,204,113,0.12); display: grid; place-items: center; color: #2ecc71;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5" stroke-linejoin="round"><polygon points="12 2 2 22 22 22"/></svg>
                  </div>
                  <div>
                    <div style="font-weight: 800; font-size: 15px; color: var(--text);">Ely.by</div>
                    <div style="font-size: 12px; color: #2ecc71; margin-top: 2px;">Бесплатные скины</div>
                  </div>
                  <div style="font-size: 11px; color: var(--text-3); line-height: 1.4;">Авторизация через веб-сайт или логин для доступа к скинам Ely</div>
                </div>

                <!-- Offline -->
                <div class="card acc-method-card" id="add-local" style="padding: 18px 16px; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border-soft); transition: all 200ms ease;">
                  <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(243,156,18,0.12); display: grid; place-items: center;">
                    📦
                  </div>
                  <div>
                    <div style="font-weight: 800; font-size: 15px; color: var(--text);">Offline</div>
                    <div style="font-size: 12px; color: #f39c12; margin-top: 2px;">Локальный профиль</div>
                  </div>
                  <div style="font-size: 11px; color: var(--text-3); line-height: 1.4;">Быстрый вход только по никнейму для одиночной игры и оффлайн-серверов</div>
                </div>
              </div>
            </div>

            <!-- Saved Accounts List Card -->
            <div class="card" style="padding: 20px; border-radius: 18px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                <div id="acc-count-label" style="font-size: 15px; font-weight: 800; color: var(--text);">Мои аккаунты</div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input class="input" id="acc-search" placeholder="Поиск аккаунта…" value="" style="font-size: 12px; padding: 6px 12px; width: 170px;">
                  <select class="input" id="acc-sort" style="font-size: 12px; padding: 6px 10px; width: 150px;">
                    <option value="default">По умолчанию</option>
                    <option value="active-first">Сначала активный</option>
                    <option value="name">По алфавиту</option>
                  </select>
                </div>
              </div>

              <div id="acc-list" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="empty-state"><span class="spinner"></span> Загрузка аккаунтов…</div>
              </div>
            </div>
          </div>

          <!-- Right Column: Current Account Inspector + Add Account Prompt -->
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <div id="current-account-card" class="card" style="padding: 24px; border-radius: 18px; display: flex; flex-direction: column; gap: 16px;">
              <div class="empty-state"><span class="spinner"></span> Загрузка профиля…</div>
            </div>

            <div class="card" id="btn-quick-add-more" style="padding: 20px; border-radius: 18px; border: 2px dashed var(--border-soft); text-align: center; cursor: pointer; transition: all 200ms ease; display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <div style="width: 42px; height: 42px; border-radius: 50%; background: var(--accent-glow); display: grid; place-items: center; color: var(--accent-hi); font-size: 22px; font-weight: 700;">+</div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text);">Добавить ещё аккаунт</div>
              <div style="color: var(--text-2); font-size: 12px; max-width: 260px; line-height: 1.4;">Переключайтесь между аккаунтами в один клик прямо перед запуском игры</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-ms').onclick = () => this.addMicrosoft();
    document.getElementById('add-ely').onclick = () => this.addEly();
    document.getElementById('add-local').onclick = () => this.addLocal();
    document.getElementById('btn-quick-add-more').onclick = () => {
      document.getElementById('add-ms')?.scrollIntoView({ behavior: 'smooth' });
    };

    const searchIn = document.getElementById('acc-search');
    if (searchIn) {
      searchIn.oninput = (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.renderAccountsList();
      };
    }
    const sortIn = document.getElementById('acc-sort');
    if (sortIn) {
      sortIn.onchange = (e) => {
        this.sortBy = e.target.value;
        this.renderAccountsList();
      };
    }

    this.refresh();
  },

  providerLabel(a) {
    if (a.type === 'microsoft') return 'Microsoft · online';
    if (a.type === 'ely') return 'Ely.by · online';
    if (a.type === 'tlauncher') return 'Local · offline';
    return 'Local · offline';
  },

  async refresh() {
    const list = await window.api.invoke('accounts:list');
    Store.set('accounts', list);
    this._cachedList = list;
    this.renderAccountsList();
    this.renderCurrentAccount();
  },

  renderAccountsList() {
    let list = (this._cachedList || []).slice();
    const countLabel = document.getElementById('acc-count-label');
    if (countLabel) countLabel.textContent = `Мои аккаунты (${list.length})`;

    if (this.searchTerm) {
      list = list.filter(a => (a.nickname || '').toLowerCase().includes(this.searchTerm) || (a.type || '').toLowerCase().includes(this.searchTerm));
    }

    if (this.sortBy === 'active-first') {
      list.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    } else if (this.sortBy === 'name') {
      list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));
    }

    const el = document.getElementById('acc-list');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = `<div class="empty-state" style="padding: 24px;">Нет сохранённых аккаунтов. Выберите способ входа выше, чтобы добавить аккаунт.</div>`;
      return;
    }

    el.innerHTML = list.map(a => {
      const initial = (a.nickname || '?').charAt(0).toUpperCase();
      const isActive = !!a.active;
      return `
        <div class="card acc-row-card" style="padding: 12px 16px; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid ${isActive ? 'var(--accent)' : 'var(--border-soft)'}; background: ${isActive ? 'rgba(255,255,255,0.03)' : 'transparent'};">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: ${isActive ? 'var(--accent)' : 'var(--bg-2)'}; color: ${isActive ? 'var(--bg)' : 'var(--text)'}; display: grid; place-items: center; font-weight: 800; font-size: 17px; box-shadow: ${isActive ? '0 0 14px var(--shadow-glow)' : 'none'};">
              ${initial}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800; font-size: 15px; color: var(--text);">${a.nickname}</span>
                ${isActive ? `<span class="pill-mini ok" style="font-size: 10px; padding: 2px 7px; font-weight: 800;">АКТИВНЫЙ</span>` : ''}
              </div>
              <div style="font-size: 12px; color: var(--text-2); margin-top: 2px;">
                ${this.providerLabel(a)} ${a.uuid ? `· ${a.uuid.slice(0, 8)}…` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${!isActive ? `
              <button class="btn outline compact-btn" data-activate="${a.id}" style="font-size: 12px; padding: 6px 12px;">Сделать активным</button>
            ` : ''}
            ${a.type === 'microsoft' || a.type === 'ely' ? `
              <button class="btn ghost compact-btn" data-refresh-profile="${a.id}" title="Проверить токен" style="padding: 6px 10px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            ` : ''}
            <button class="btn ghost compact-btn" data-remove="${a.id}" title="Удалить" style="padding: 6px 10px; color: var(--error);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('[data-activate]').forEach(b => b.onclick = async () => {
      await window.api.invoke('accounts:set-active', b.dataset.activate);
      Toast.success('Активный аккаунт изменён');
      await this.refresh();
      window.App.refreshUserCard();
    });
    el.querySelectorAll('[data-refresh-profile]').forEach(b => b.onclick = async () => {
      try { await window.api.invoke('accounts:get-profile', b.dataset.refreshProfile); Toast.success('Профиль обновлён'); }
      catch (e) { Toast.error('Проверка не выполнена', e.message); }
      await this.refresh();
      window.App.refreshUserCard();
    });
    el.querySelectorAll('[data-remove]').forEach(b => b.onclick = async () => {
      Modal.confirm({
        title: 'Удалить аккаунт?',
        message: 'Аккаунт и сохранённый токен будут удалены.',
        okText: 'Удалить',
        onOk: async () => {
          await window.api.invoke('accounts:remove', b.dataset.remove);
          Toast.info('Аккаунт удалён');
          await this.refresh();
          window.App.refreshUserCard();
        }
      });
    });
  },

  renderCurrentAccount() {
    const card = document.getElementById('current-account-card');
    if (!card) return;
    const list = this._cachedList || [];
    const active = list.find(a => a.active) || list[0] || null;

    if (!active) {
      card.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div style="font-size: 32px; margin-bottom: 8px;">👤</div>
          <div style="font-weight: 700; color: var(--text);">Нет активного аккаунта</div>
          <div style="font-size: 12px; color: var(--text-2); margin-top: 4px;">Добавьте аккаунт для запуска игры</div>
        </div>
      `;
      return;
    }

    const typeTitle = active.type === 'microsoft' ? 'Лицензия (Online)' : (active.type === 'ely' ? 'Ely.by (Online)' : 'Локальный (Offline)');
    const statusText = active.type === 'local' ? '● Локальный профиль' : '● Подключён к серверу';
    const skinHeadUrl = `https://mc-heads.net/avatar/${encodeURIComponent(active.nickname)}/100`;

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); padding-bottom: 14px;">
        <span style="font-size: 12px; font-weight: 800; letter-spacing: 0.1em; color: var(--text-2); text-transform: uppercase;">Текущий аккаунт</span>
        <button class="btn ghost compact-btn" id="btn-acc-settings" style="font-size: 12px; display: flex; align-items: center; gap: 6px; padding: 4px 8px;">
          ⚙ Настройки
        </button>
      </div>

      <!-- Avatar & Nickname Showcase -->
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 10px 0;">
        <div style="width: 84px; height: 84px; border-radius: 20px; overflow: hidden; border: 2px solid var(--accent); box-shadow: 0 0 24px var(--shadow-glow); background: var(--bg-2);">
          <img src="${skinHeadUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22><circle cx=%2212%22 cy=%228%22 r=%225%22/><path d=%22M20 21a8 8 0 1 0-16 0%22/></svg>'">
        </div>
        <div>
          <div style="font-size: 20px; font-weight: 800; color: var(--text);">${active.nickname}</div>
          <div style="font-size: 12px; color: var(--ok); font-weight: 700; margin-top: 3px;">${statusText}</div>
        </div>
      </div>

      <!-- Key-Value Metadata Grid -->
      <div class="card" style="padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.02); display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-3);">UUID</span>
          <span style="color: var(--text); font-family: monospace; font-size: 11px;">${active.uuid ? active.uuid.slice(0, 12) + '…' : 'Offline'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-3);">Тип</span>
          <span style="color: var(--text); font-weight: 600;">${typeTitle}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-3);">Скин</span>
          <span style="color: var(--accent-hi); font-weight: 600;">Классический (Стив)</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-3);">Плащ</span>
          <span style="color: var(--text); font-weight: 600;">Nexus Founder Cape</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <button class="btn outline" id="btn-change-skin" style="flex: 1; padding: 8px 0; font-size: 12px; font-weight: 700; border-radius: 10px;">Сменить скин</button>
        <button class="btn ghost" id="btn-logout-acc" style="padding: 8px 16px; font-size: 12px; border-radius: 10px; color: var(--error);">Выйти</button>
      </div>
    `;

    card.querySelector('#btn-acc-settings')?.addEventListener('click', () => {
      window.App.navigate('settings');
    });
    card.querySelector('#btn-change-skin')?.addEventListener('click', () => {
      window.App.navigate('settings');
    });
    card.querySelector('#btn-logout-acc')?.addEventListener('click', () => {
      Modal.confirm({
        title: 'Выйти из аккаунта?',
        message: `Вы действительно хотите удалить профиль ${active.nickname}?`,
        okText: 'Выйти',
        onOk: async () => {
          await window.api.invoke('accounts:remove', active.id);
          Toast.info('Вы вышли из аккаунта');
          await this.refresh();
          window.App.refreshUserCard();
        }
      });
    });
  },

  async addMicrosoft() {
    this.pollCancel = false;
    let r;
    try { r = await window.api.invoke('accounts:start-ms-oauth'); }
    catch (e) { Toast.error('Microsoft OAuth недоступен', e.message); return; }

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="modal-hint">Открылся официальный сайт Microsoft. Пароль вводится только там, не в лаунчере.</p>
      <div class="code-row"><input class="input" id="ms-code" readonly value="${r.userCode || ''}"><button class="btn outline" id="copy-code">Копировать</button></div>
      <button class="btn primary" id="open-ms">Открыть страницу входа</button>
      <div id="ms-status" class="card modal-status">После подтверждения входа нажмите «Готово».</div>`;
    body.querySelector('#copy-code').onclick = () => { window.api.clipboard.write(r.userCode || ''); Toast.info('Код скопирован'); };
    body.querySelector('#open-ms').onclick = () => window.api.shell.openExternal(r.verificationUri);
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn ghost btn-cancel">Отмена</button><button class="btn primary btn-ok">Готово</button>`;
    const inst = Modal.open({ title: 'Вход через Microsoft', body, footer, size: 'large' });
    footer.querySelector('.btn-cancel').onclick = () => { this.pollCancel = true; inst.close(); };
    footer.querySelector('.btn-ok').onclick = async () => {
      footer.querySelector('.btn-ok').disabled = true;
      body.querySelector('#ms-status').innerHTML = '<span class="spinner"></span> Проверяю Microsoft и Minecraft-профиль…';
      try {
        await window.api.invoke('accounts:add', { type: 'microsoft', deviceCode: r.deviceCode, interval: r.interval, expiresIn: r.expiresIn });
        Toast.success('Microsoft-аккаунт добавлен');
        inst.close();
        await this.refresh(); window.App.refreshUserCard();
      } catch (e) { body.querySelector('#ms-status').textContent = e.message; Toast.error('Ошибка авторизации', e.message); footer.querySelector('.btn-ok').disabled = false; }
    };
  },

  async addEly() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button class="btn primary" id="btn-ely-web-auth" style="width: 100%; justify-content: center; height: 44px; font-size: 14px; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Войти через сайт Ely.by
        </button>
        <small style="display: block; margin-top: 8px; color: var(--text-2); font-size: 11px; text-align: center; line-height: 1.4;">
          Рекомендуется: откроется официальная страница входа Ely.by. Авторизуйтесь там, и аккаунт автоматически синхронизируется с лаунчером.
        </small>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; margin: 16px 0; color: var(--text-2); font-size: 11px;">
        <hr style="flex:1; border:0; border-top:1px solid rgba(255,255,255,0.08);">
        <span>ИЛИ ВХОД ПО ЛОГИНУ И ПАРОЛЮ</span>
        <hr style="flex:1; border:0; border-top:1px solid rgba(255,255,255,0.08);">
      </div>

      <input class="input" id="ely-login" placeholder="Email или ник Ely.by" autocomplete="username">
      <input class="input" id="ely-pass" type="password" placeholder="Пароль Ely.by" autocomplete="current-password">
      <input class="input" id="ely-totp" placeholder="2FA код, если включён (необязательно)">
      <div class="modal-status card" id="ely-status">Шифрование включено</div>`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn ghost btn-cancel">Отмена</button><button class="btn primary btn-ok">Добавить Ely.by</button>`;
    const inst = Modal.open({ title: 'Вход в аккаунт Ely.by', body, footer });

    const btnWeb = body.querySelector('#btn-ely-web-auth');
    btnWeb.onclick = async () => {
      const originalHtml = btnWeb.innerHTML;
      btnWeb.disabled = true;
      btnWeb.innerHTML = '<span class="spinner"></span> Ожидание авторизации на сайте…';
      const statusEl = body.querySelector('#ely-status');
      statusEl.innerHTML = '<span class="spinner"></span> Окно входа Ely.by открыто. Выполните вход на сайте…';
      try {
        await window.api.invoke('accounts:start-ely-oauth');
        Toast.success('Аккаунт Ely.by синхронизирован!');
        inst.close();
        await this.refresh();
        window.App.refreshUserCard();
      } catch (err) {
        btnWeb.disabled = false;
        btnWeb.innerHTML = originalHtml;
        statusEl.textContent = err.message || String(err);
        Toast.error('Ошибка входа через сайт Ely.by', err.message);
      }
    };

    footer.querySelector('.btn-cancel').onclick = () => inst.close();
    footer.querySelector('.btn-ok').onclick = async () => {
      try {
        await window.api.invoke('accounts:add', {
          type: 'ely',
          username: body.querySelector('#ely-login').value.trim(),
          password: body.querySelector('#ely-pass').value,
          totp: body.querySelector('#ely-totp').value.trim()
        });
        body.querySelector('#ely-pass').value = '';
        Toast.success('Ely.by аккаунт добавлен');
        inst.close(); await this.refresh(); window.App.refreshUserCard();
      } catch (e) { Toast.error('Не удалось войти', e.message); }
    };
  },


  async addLocal() {
    const body = document.createElement('div');
    body.innerHTML = `<p class="modal-hint">Локальный профиль работает только для offline-запуска.</p><input class="input" id="local-nick" placeholder="Никнейм: 3–16 символов A-Z, 0-9, _">`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="btn ghost btn-cancel">Отмена</button><button class="btn primary btn-ok">Добавить</button>`;
    const inst = Modal.open({ title: 'Новый offline-профиль', body, footer });
    footer.querySelector('.btn-cancel').onclick = () => inst.close();
    footer.querySelector('.btn-ok').onclick = async () => {
      try {
        await window.api.invoke('accounts:add', { type: 'local', nickname: body.querySelector('#local-nick').value.trim() });
        Toast.success('Профиль добавлен');
        inst.close(); await this.refresh(); window.App.refreshUserCard();
      } catch (e) { Toast.error('Не удалось добавить', e.message); }
    };
  },

  destroy() { this.pollCancel = true; }
};
