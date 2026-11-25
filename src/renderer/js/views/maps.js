/* ═══ Maps view ═══ */
window.Views = window.Views || {};

window.Views.maps = ContentCatalog.create({
  prefix: 'maps',
  title: 'Карты',
  subtitle: 'Карты устанавливаются в папку <b>saves/</b> выбранной установленной версии. Источники: CurseForge и Minecraft Inside.',
  searchPlaceholder: 'Поиск карты…',
  folderName: 'saves',
  hasSources: true,
  availableSources: ['curseforge', 'minecraft-inside'],
  fallbackSource: 'curseforge',
  defaultSource: 'curseforge',
  includeLoaderInTarget: false,
  passLoader: false,
  noVersionMessage: 'Нет установленной версии Minecraft — установка карт заблокирована.',
  searchChannel: 'maps:list',
  installedChannel: 'maps:list-installed',
  installChannel: 'maps:install',
  installButtonLabel: 'Установить',
  modalInstallLabel: 'Установить',
  installedButtonLabel: 'Локальные карты',
  installSuccessTitle: 'Карта скачана',
  disclaimerText: 'Карты создаются участниками сообщества. Nexus Launcher распакует мир в папку сохранений выбранной версии (saves).'
});
