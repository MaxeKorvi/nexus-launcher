/* ═══ Profile view (spec §3.6) ═══ */
window.Views = window.Views || {};

window.Views.profile = {
  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    document.querySelector('main.content').style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';
    c.innerHTML = `
      <div class="view" style="padding:24px;">
        <h1>Профиль пользователя</h1>
        <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;">
          <div class="card" style="text-align:center;padding:24px;">
            <div id="p-avatar" style="width:140px;height:140px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-hi));margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:60px;font-weight:700;color:var(--bg);border:3px solid var(--accent);box-shadow:0 0 30px var(--glow);">?</div>
            <h2 id="p-nick" style="font-size:22px;">Гость</h2>
            <div id="p-uuid" style="font-size:11px;color:var(--text-2);margin-top:4px;font-family:monospace;">—</div>
            <div id="p-provider" style="font-size:12px;color:var(--accent-hi);margin-top:6px;">Войдите в аккаунт</div>
            <button class="btn outline" id="p-skin" style="margin-top:14px;">Сменить скин</button>
            <button class="btn outline" id="p-cape" style="margin-top:8px;">Сменить плащ</button>
          </div>
          <div class="card">
            <h2>Статистика</h2>
            <p style="color:var(--text-2);margin-bottom:14px;">Статистика синхронизируется с Mojang API для Microsoft-аккаунтов. Для локальных — недоступна.</p>
            <table class="table">
              <tr><td>Дата регистрации</td><td id="p-reg">—</td></tr>
              <tr><td>Время в игре</td><td id="p-playtime">—</td></tr>
              <tr><td>Поймано вещей</td><td id="p-items">—</td></tr>
              <tr><td>Достижения</td><td id="p-achv">—</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
    document.getElementById('p-skin').onclick = async () => {
      const settings = await window.api.invoke('settings:get');
      if (settings.skinSystem === 'none') {
        Toast.warning('Система скинов', 'Система скинов отключена в настройках.');
        return;
      }
      window.App.navigate('skins');
    };
    document.getElementById('p-cape').onclick = () => {
      window.api.shell.openExternal('https://www.minecraft.net/profile/skin');
    };
    this.refresh();
  },

  async refresh() {
    const accounts = await window.api.invoke('accounts:list');
    const active = accounts.find(a => a.active) || accounts[0];
    if (!active) return;
    document.getElementById('p-nick').textContent = active.nickname;
    document.getElementById('p-avatar').textContent = (active.nickname || '?').charAt(0).toUpperCase();
    document.getElementById('p-uuid').textContent = active.uuid ? `UUID: ${active.uuid}` : '—';
    document.getElementById('p-provider').textContent = `Провайдер: ${active.type}`;
  },

  destroy() {}
};
