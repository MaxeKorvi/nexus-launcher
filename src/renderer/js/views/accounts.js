/* ═══ Accounts view ═══ */
window.Views = window.Views || {};

window.Views.accounts = {
  pollCancel: false,

  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    document.querySelector('main.content').style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';
    c.innerHTML = `
      <div class="view accounts-view">
        <div class="view-hero">
          <div>
            <div class="eyebrow">Nexus Accounts</div>
            <h1>Аккаунты</h1>
            <p>Выберите способ входа: Microsoft для лицензии, Ely.by для Ely-серверов или локальный offline-профиль. Система скинов выбирается отдельно в настройках.</p>
          </div>
          <div class="hero-badge success">Шифрование включено</div>
        </div>

        <div class="card accounts-single-card">
          <div id="security-card" class="card security-card" style="margin-bottom:0; background:transparent; border:none; box-shadow:none; padding:0;"></div>

          <h3 style="margin-top:10px; font-size:16px;">Добавить аккаунт</h3>
          <div class="account-methods">
            <button class="account-method primary" id="add-ms"><b>Microsoft</b><span>Официальный OAuth без ввода пароля в лаунчере</span></button>
            <button class="account-method" id="add-ely"><b>Ely.by</b><span>Yggdrasil-вход, пароль не сохраняется</span></button>
            <button class="account-method" id="add-local"><b>Offline</b><span>Простой локальный профиль</span></button>
          </div>

          <h3 style="font-size:16px;">Сохранённые аккаунты</h3>
          <div id="acc-list" class="account-grid"><div class="empty-state"><span class="spinner"></span> Загрузка…</div></div>
        </div>
      </div>`;

    document.getElementById('add-ms').onclick = () => this.addMicrosoft();
    document.getElementById('add-ely').onclick = () => this.addEly();
    document.getElementById('add-local').onclick = () => this.addLocal();

    this.renderStorageInfo();
    this.refresh();
  },

  async renderStorageInfo() {
    const el = document.getElementById('security-card');
    if (!el) return;
    el.innerHTML = `
      <div class="secure-row">
        <div class="secure-icon">🔐</div>
        <div>
          <b>Шифрование включено</b>
          <span>Токены сохраняются защищённо. Пароли Microsoft не запрашиваются; пароль Ely.by используется только для получения токена и не сохраняется.</span>
        </div>
      </div>`;
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
    const el = document.getElementById('acc-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = `<div class="empty-state">Нет сохранённых аккаунтов.</div>`; return; }
    el.innerHTML = list.map(a => `
      <div class="account-card ${a.active ? 'active' : ''}">
        <div class="avatar">${(a.nickname || '?').charAt(0).toUpperCase()}</div>
        <div class="account-main">
          <b>${a.nickname}</b>
          <span>${this.providerLabel(a)}</span>
          <small>${a.uuid ? 'UUID: ' + a.uuid.slice(0, 8) + '…' : ''}</small>
        </div>
        <div class="account-tags">
          <span class="tag ${a.status === 'connected' ? 'ok' : ''}">${a.status || '—'}</span>
          ${a.onlineMode ? '<span class="tag ok">Online</span>' : '<span class="tag">Offline</span>'}
        </div>
        <div class="account-actions">
          <button class="btn ghost compact-btn" data-activate="${a.id}">${a.active ? 'Активный' : 'Сделать активным'}</button>
          ${a.type === 'microsoft' || a.type === 'ely' ? `<button class="btn outline compact-btn" data-refresh-profile="${a.id}">Проверить</button>` : ''}
          <button class="btn outline compact-btn" data-remove="${a.id}">Удалить</button>
        </div>
      </div>`).join('');

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
