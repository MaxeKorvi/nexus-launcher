/* ═══ Mods view ═══ */
window.Views = window.Views || {};

(function () {
  const esc = Shared.escapeHtml;

  const modsView = ContentCatalog.create({
    prefix: 'm',
    title: 'Менеджер модов',
    subtitle: 'Моды устанавливаются в папку <b>mods/</b> выбранной установленной версии.',
    searchPlaceholder: 'Поиск мода…',
    folderName: 'mods',
    hasSources: true,
    fallbackSource: 'curseforge',
    passLoader: true,
    hasDropzone: true,
    showRefreshButton: true,
    noVersionMessage: 'Нет установленной версии Minecraft — установка модов заблокирована.',
    searchChannel: 'mods:search',
    installedChannel: 'mods:list-installed',
    installChannel: 'mods:install',
    removeChannel: 'mods:remove',
    installButtonLabel: 'Выбрать и установить',
    installedButtonLabel: 'Установленные',
    disclaimerText: 'Файлы на сторонних ресурсах загружаются авторами модификаций. Nexus Launcher рекомендует убедиться в безопасности контента перед запуском.',
    customInstall(mod) {
      return this.showInstallDialog(mod);
    }
  });

  modsView.showInstallDialog = async function (mod) {
    const targets = this.targets();
    if (!targets.length) {
      Toast.error('Нет версий', 'Сначала установите Minecraft/Forge/Fabric во вкладке «Версии».');
      return;
    }
    const current = this.currentTarget() || targets[0];
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="color:var(--text-2);margin-top:0;">Выберите установленную версию Minecraft, куда поставить мод.</p>
      <label style="font-size:12px;color:var(--text-2);">Куда установить</label>
      <select class="input" id="mod-install-target" style="width:100%;margin:6px 0 12px;">
        ${targets.map(v => `<option value="${esc(ContentCatalog.targetKey(v))}" ${ContentCatalog.targetKey(v) === ContentCatalog.targetKey(current) ? 'selected' : ''}>${esc(ContentCatalog.formatTarget(v, true))}</option>`).join('')}
      </select>
      <div id="mod-version-box" style="margin-top:10px;color:var(--text-2);font-size:13px;">${mod.source === 'modrinth' ? 'Загружаю версии файла…' : 'Для этого источника будет выбран совместимый файл автоматически.'}</div>
    `;
    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="btn primary" id="mod-install-ok">Установить</button>
      <button class="btn outline" id="mod-install-cancel">Отмена</button>
    `;
    const modal = Modal.open({ title: esc(mod.title || 'Установка мода'), body, footer, size: 'large' });
    footer.querySelector('#mod-install-cancel').onclick = () => modal.close();

    let versionList = [];
    const selectTarget = body.querySelector('#mod-install-target');
    const box = body.querySelector('#mod-version-box');

    const loadFileVersions = async () => {
      const target = targets.find(v => ContentCatalog.targetKey(v) === selectTarget.value) || current;
      if (mod.source !== 'modrinth') {
        box.textContent = `Мод будет установлен в ${target.rootDir || target.path}/mods`;
        return;
      }
      box.innerHTML = '<span class="spinner"></span> Загружаю версии файла…';
      try {
        const info = await window.api.invoke('mods:get-by-id', mod.id, mod.source);
        const targetMc = target.minecraft || target.id || '';
        const targetLoader = target.loader && target.loader !== 'vanilla' ? target.loader : '';
        versionList = (info.versions || []).filter(v => {
          const okMc = !targetMc || (v.game_versions || []).includes(targetMc);
          const okLoader = !targetLoader || (v.loaders || []).includes(targetLoader);
          return okMc && okLoader && (v.files || []).length;
        });
        if (!versionList.length) versionList = (info.versions || []).filter(v => (v.files || []).length).slice(0, 30);
        box.innerHTML = versionList.length ? `
          <label style="font-size:12px;color:var(--text-2);">Версия файла мода</label>
          <select class="input" id="mod-file-version" style="width:100%;margin-top:6px;">
            ${versionList.slice(0, 60).map((v, idx) => {
              const file = (v.files || []).find(f => f.primary) || (v.files || [])[0] || {};
              const mc = (v.game_versions || []).slice(0, 3).join(', ');
              const loaders = (v.loaders || []).slice(0, 3).join(', ');
              return `<option value="${idx}">${esc(v.name || v.version_number || v.id)} · MC ${esc(mc)} · ${esc(loaders)} · ${esc(file.filename || '')}</option>`;
            }).join('')}
          </select>
        ` : '<div style="color:var(--accent-hi);">Совместимый файл не найден. Можно попробовать быструю автоматическую установку.</div>';
      } catch (e) {
        box.innerHTML = `<div style="color:var(--accent-hi);">Не удалось загрузить версии файла: ${esc(e.message)}. Будет выбран совместимый файл автоматически.</div>`;
      }
    };

    selectTarget.onchange = () => loadFileVersions();
    loadFileVersions();

    footer.querySelector('#mod-install-ok').onclick = async () => {
      const target = targets.find(v => ContentCatalog.targetKey(v) === selectTarget.value) || current;
      ContentCatalog.checkMinecraftInsideDisclaimer(mod, 'Файлы на сторонних ресурсах загружаются авторами модификаций. Nexus Launcher рекомендует убедиться в безопасности контента перед запуском.', async () => {
        this.applyTarget(target, true);
        const rootDir = target.rootDir || target.path;
        let versionId = undefined;
        const fileSelect = body.querySelector('#mod-file-version');
        if (fileSelect && versionList[Number(fileSelect.value)]) versionId = versionList[Number(fileSelect.value)].id;

        Toast.info('Установка', `${mod.title || 'Мод'} → ${rootDir}/mods`);
        try {
          const result = await window.api.invoke('mods:install', {
            ...mod,
            versionId,
            mcVersion: target.minecraft || target.id || this.mcVersion,
            loader: target.loader && target.loader !== 'vanilla' ? target.loader : '',
            rootDir,
            gameDir: rootDir
          });
          if (result && result.warning) {
            Toast.show({ title: 'Внимание!', message: result.warning, type: 'error', duration: 8000 });
          } else {
            Toast.success('Мод установлен', `${rootDir}/mods`);
          }
          modal.close();
          this.search();
        } catch (e) {
          Toast.error('Ошибка', e.message);
        }
      });
    };
  };

  window.Views.mods = modsView;
})();
