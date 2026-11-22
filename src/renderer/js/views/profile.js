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
      <div class="view settings-single-card" style="padding:24px 30px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); padding-bottom: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="eyebrow" style="color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.06em;">Профиль игрока</span>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 3px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-soft); color: var(--text-2);">User Profile</span>
            </div>
            <h1 style="font-size: 24px; font-weight: 800; margin: 4px 0; color: var(--text);">Профиль пользователя</h1>
          </div>
          <button class="btn outline" onclick="window.App.navigate('accounts')">Управление аккаунтами</button>
        </div>

        <div style="display:grid;grid-template-columns:280px 1fr;gap:24px; align-items: start;">
          <div style="text-align:center;padding:24px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); border-radius: 4px;">
            <div id="p-avatar" style="width:96px;height:96px;border-radius:4px;background:var(--glow);margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700;color:var(--accent-hi);border:1px solid var(--accent);box-shadow:0 0 20px var(--glow);">?</div>
            <h2 id="p-nick" style="font-size:20px;margin:0;color:var(--text);">Гость</h2>
            <div id="p-uuid" style="font-size:11px;color:var(--text-2);margin-top:4px;font-family:monospace;">—</div>
            <div id="p-provider" style="font-size:12px;color:var(--accent-hi);margin-top:6px;font-weight:600;">Войдите в аккаунт</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">
              <button class="btn outline" id="p-skin">Сменить скин</button>
              <button class="btn outline" id="p-cape">Сменить плащ</button>
            </div>
          </div>
          <div style="padding:20px 24px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-soft); border-radius: 4px;">
            <h2 style="font-size:16px;margin:0 0 6px;color:var(--text);">Статистика профиля</h2>
            <p style="color:var(--text-2);font-size:12px;margin:0 0 16px;">Синхронизируется с серверами Minecraft для официальных лицензий. Для оффлайн-профилей сохраняется локально.</p>
            <table class="table" style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid var(--border-soft);"><td style="padding:8px 0;color:var(--text-2);font-size:13px;">Дата регистрации</td><td id="p-reg" style="text-align:right;color:var(--text);font-weight:600;">—</td></tr>
              <tr style="border-bottom:1px solid var(--border-soft);"><td style="padding:8px 0;color:var(--text-2);font-size:13px;">Время в игре</td><td id="p-playtime" style="text-align:right;color:var(--text);font-weight:600;">—</td></tr>
              <tr style="border-bottom:1px solid var(--border-soft);"><td style="padding:8px 0;color:var(--text-2);font-size:13px;">Сессий запущено</td><td id="p-items" style="text-align:right;color:var(--text);font-weight:600;">—</td></tr>
              <tr><td style="padding:8px 0;color:var(--text-2);font-size:13px;">Статус синхронизации</td><td id="p-achv" style="text-align:right;color:var(--accent-hi);font-weight:600;">Локальный профиль</td></tr>
            </table>
          </div>
        </div>
      </div>
    `;
    document.getElementById('p-skin').onclick = async () => {
      const accounts = await window.api.invoke('accounts:list').catch(() => []);
      const active = (accounts || []).find(a => a.active) || accounts[0];
      if (!active || active.type !== 'microsoft') {
        if (active && active.type === 'ely') {
          window.api.shell.openExternal('https://ely.by/skin');
        } else {
          Toast.info('Скины', 'Для локальных профилей скины настраиваются через Ely.by или моды.');
        }
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
