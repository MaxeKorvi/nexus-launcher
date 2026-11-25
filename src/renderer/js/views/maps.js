/* ═══ Maps view ═══ */
window.Views = window.Views || {};

window.Views.maps = ContentCatalog.create({
  prefix: 'maps',
  title: 'Карты',
  subtitle: 'Карта ставится в папку <b>saves/</b> выбранной установленной версии. Каталог берётся с Minecraft Inside.',
  searchPlaceholder: 'Поиск карты…',
  folderName: 'saves',
  hasSources: false,
  defaultSource: 'minecraft-inside',
  includeLoaderInTarget: false,
  passLoader: false,
  noVersionMessage: 'Нет установленной версии Minecraft — установка карт заблокирована.',
  searchChannel: 'maps:list',
  installedChannel: 'maps:list-installed',
  installChannel: 'maps:install',
  installButtonLabel: 'Скачать в выбранную версию',
  modalInstallLabel: 'Скачать карту',
  installedButtonLabel: 'Локальные карты',
  installSuccessTitle: 'Карта скачана',
  disclaimerText: 'Карты создаются участниками сообщества. Nexus Launcher распакует мир в папку сохранений выбранной версии (saves).'
});
