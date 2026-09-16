/* ═══ Home view (default — rendered inside the main launcher window) ═══ */
window.Views = window.Views || {};

window.Views.home = {
  render() {
    const home = document.getElementById('home-view');
    const c = document.getElementById('view-container');
    document.querySelector('main.content').style.display = 'grid';
    if (c) { c.style.display = 'none'; c.innerHTML = ''; }
    if (home) {
      home.style.display = 'flex';
      home.scrollTop = 0;
    }

    this.initHeroInstancesButton();
  },

  initHeroInstancesButton() {
    const btn = document.getElementById('hero-btn-instances');
    if (btn) {
      btn.onclick = () => {
        if (window.App) {
          window.App.navigate('library');
          if (window.Views.library && window.Views.library.switchTab) {
            window.Views.library.switchTab('instances');
          }
        }
      };
    }
  },

  destroy() {}
};

