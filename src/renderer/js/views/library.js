/* ═══ Library View ═══ */
window.Views = window.Views || {};

window.Views.library = {
  activeTab: 'modpacks',

  render() {
    const c = document.getElementById('view-container');
    const home = document.getElementById('home-view');
    const mainContent = document.querySelector('main.content');
    if (mainContent) mainContent.style.display = 'grid';
    if (home) home.style.display = 'none';
    c.style.display = 'block';

    c.innerHTML = `
      <div class="view library-view">
        <div class="library-tabs">
          <button class="tab-item" data-tab="modpacks" style="padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); font-weight: 600; font-size: 13px; transition: all 200ms ease; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Сборки
          </button>
          <button class="tab-item" data-tab="mods" style="padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); font-weight: 600; font-size: 13px; transition: all 200ms ease; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Моды
          </button>
          <button class="tab-item" data-tab="maps" style="padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); font-weight: 600; font-size: 13px; transition: all 200ms ease; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>
            Карты
          </button>
          <button class="tab-item" data-tab="shaders" style="padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); font-weight: 600; font-size: 13px; transition: all 200ms ease; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            Шейдеры
          </button>
          <button class="tab-item" data-tab="resourcepacks" style="padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-2); font-weight: 600; font-size: 13px; transition: all 200ms ease; border: 1px solid transparent; background: transparent; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/></svg>
            Ресурспаки
          </button>
        </div>
        <div id="library-view-content" style="flex: 1; overflow-y: auto; min-height: 0;"></div>
      </div>
    `;

    c.querySelectorAll('.tab-item').forEach(btn => {
      btn.onclick = () => {
        this.switchTab(btn.dataset.tab);
      };
    });

    this.switchTab(this.activeTab);
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    const c = document.getElementById('view-container');
    if (!c) return;

    c.querySelectorAll('.tab-item').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      if (active) {
        btn.style.color = 'var(--accent-hi)';
        btn.style.background = 'rgba(255, 122, 0, 0.1)';
        btn.style.border = '1px solid rgba(255, 122, 0, 0.2)';
      } else {
        btn.style.color = 'var(--text-2)';
        btn.style.background = 'transparent';
        btn.style.border = '1px solid transparent';
      }
    });

    if (window.Views[tabName]) {
      window.Views[tabName].render();
    }
  },

  destroy() {
    if (window.Views[this.activeTab] && window.Views[this.activeTab].destroy) {
      window.Views[this.activeTab].destroy();
    }
  }
};
