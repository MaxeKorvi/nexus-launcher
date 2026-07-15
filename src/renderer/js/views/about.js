/* ═══ About view ═══ */
window.Views = window.Views || {};

window.Views.about = {
  render() {
    document.querySelector('[data-view="settings"]').click();
    // Wait a tick then switch to about section
    setTimeout(() => {
      const navItem = document.querySelector('.settings-nav .nav-item[data-section="about"]');
      if (navItem) navItem.click();
    }, 50);
  },
  destroy() {}
};
