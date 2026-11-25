/* ═══ Менеджер шейдеров view ═══ */
window.Views = window.Views || {};

window.Views.shaders = ContentCatalog.create({
  prefix: 'sh',
  title: 'Менеджер шейдеров',
  subtitle: 'Шейдеры устанавливаются в папку <b>shaderpacks/</b> выбранной установленной версии.',
  searchPlaceholder: 'Поиск шейдера…',
  folderName: 'shaderpacks',
  hasSources: true,
  fallbackSource: 'modrinth',
  passLoader: false,
  noVersionMessage: 'Нет установленной версии Minecraft — установка шейдеров заблокирована.',
  searchChannel: 'shaders:list',
  installedChannel: 'shaders:list-installed',
  installChannel: 'shaders:install',
  installButtonLabel: 'Установить',
  installedButtonLabel: 'Установленные',
  installSuccessTitle: 'Шейдер установлен',
  disclaimerText: 'Файлы на сторонних ресурсах загружаются авторами шейдеров. Nexus Launcher рекомендует убедиться в безопасности контента перед запуском.'
});
