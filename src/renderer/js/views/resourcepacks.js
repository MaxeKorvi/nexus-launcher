/* ═══ Менеджер ресурспаков view ═══ */
window.Views = window.Views || {};

window.Views.resourcepacks = ContentCatalog.create({
  prefix: 'rp',
  title: 'Менеджер ресурспаков',
  subtitle: 'Ресурспаки устанавливаются в папку <b>resourcepacks/</b> выбранной установленной версии.',
  searchPlaceholder: 'Поиск ресурспака…',
  folderName: 'resourcepacks',
  hasSources: true,
  fallbackSource: 'modrinth',
  passLoader: false,
  noVersionMessage: 'Нет установленной версии Minecraft — установка ресурспаков заблокирована.',
  searchChannel: 'resourcepacks:list',
  installedChannel: 'resourcepacks:list-installed',
  installChannel: 'resourcepacks:install',
  installButtonLabel: 'Установить',
  installedButtonLabel: 'Установленные',
  installSuccessTitle: 'Ресурспак установлен',
  disclaimerText: 'Файлы на сторонних ресурсах загружаются авторами ресурспаков. Nexus Launcher рекомендует убедиться в безопасности контента перед запуском.'
});
