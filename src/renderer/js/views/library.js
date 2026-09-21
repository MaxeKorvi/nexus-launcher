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
      <div class="view library-view" style="display:flex; flex-direction:column; height:100%; overflow:hidden;">
        <div class="library-tabs-wrap" style="padding: 18px 24px 10px; border-bottom: 1px solid var(--border-soft); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
          <div class="library-tabs" style="display:inline-flex; align-items:center; gap:4px; padding:4px; border-radius:12px; background:rgba(0,0,0,0.35); border:1px solid var(--border-soft);">
            <button class="tab-item" data-tab="instances">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span>Профили</span>
            </button>
            <button class="tab-item active" data-tab="modpacks">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <span>Сборки</span>
            </button>
            <button class="tab-item" data-tab="worlds">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>Миры</span>
            </button>
            <button class="tab-item" data-tab="maps">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/></svg>
              <span>Карты</span>
            </button>
            <button class="tab-item" data-tab="shaders">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <span>Шейдеры</span>
            </button>
            <button class="tab-item" data-tab="resourcepacks">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7L12 12l8.7-5"/></svg>
              <span>Ресурспаки</span>
            </button>
          </div>
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
