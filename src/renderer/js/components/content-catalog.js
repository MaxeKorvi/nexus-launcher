/* ═══ Reusable Content Catalog View (Mods, Resourcepacks, Shaders, Maps) ═══ */
(function () {
  const esc = (v) => Shared.escapeHtml(v);

  function sourceLabel(source) {
    if (source === 'minecraft-inside') return 'Minecraft Inside';
    if (source === 'curseforge') return 'CurseForge';
    if (source === 'modrinth') return 'Modrinth';
    return source || '—';
  }

  function targetKey(v) {
    return v.rootDir || v.path || v.profileId || v.id;
  }

  function formatTarget(v, includeLoader = true) {
    const name = v.displayName || v.title || v.profileId || v.id;
    const mc = v.minecraft || v.id || '';
    const loader = includeLoader
      ? (v.loader && v.loader !== 'vanilla' ? ` · ${v.loader}${v.loaderVersion ? ' ' + v.loaderVersion : ''}` : ' · Vanilla')
      : '';
    const kind = v.modpack ? ' · сборка' : '';
    return `${name}${mc && name !== mc ? ' · MC ' + mc : ''}${loader}${kind}`;
  }

  function compareMcVersionDesc(a, b) {
    const parse = (v) => String(v || '').replace(/^[^0-9]*/, '').split(/[.\-_+]/).map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] || 0;
      const db = pb[i] || 0;
      if (db !== da) return db - da;
    }
    return String(b).localeCompare(String(a));
  }

  function sortMcVersionsDesc(list) {
    if (!Array.isArray(list)) return [];
    return Array.from(new Set(list.filter(Boolean))).sort(compareMcVersionDesc);
  }

  function isInstalled(installed, item) {
    return (installed || []).some(x => {
      if (x.source && item.source && String(x.source) === String(item.source) && x.id && item.id && String(x.id) === String(item.id)) return true;
      if (x.title && item.title && String(x.title).trim().toLowerCase() === String(item.title).trim().toLowerCase()) return true;
      return false;
    });
  }

  function checkMinecraftInsideDisclaimer(item, disclaimerText, onConfirm) {
    const isMcInside = item && (item.source === 'minecraft-inside' || !item.source || (item.url && item.url.includes('minecraft-inside.ru')));
    if (!isMcInside) {
      onConfirm();
      return;
    }
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="font-size:13px;line-height:1.6;color:var(--text-1);">
        <p style="margin-top:0;"><strong>Внимание:</strong> Вы собираетесь установить контент из источника <strong>Minecraft Inside</strong>.</p>
        <div style="background:rgba(255,180,0,0.1);border-left:3px solid #ffb400;padding:10px 12px;border-radius:4px;margin:12px 0;color:var(--text-1);font-size:12px;">
          ${esc(disclaimerText)}
        </div>
        <p style="color:var(--text-2);font-size:12px;margin-bottom:0;">Желаете продолжить загрузку?</p>
      </div>
    `;
    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="btn primary" id="mc-inside-continue">Продолжить</button>
      <button class="btn outline" id="mc-inside-cancel">Отмена</button>
    `;
    const modal = Modal.open({ title: 'Предупреждение источника', body, footer, size: 'normal' });
    footer.querySelector('#mc-inside-cancel').onclick = () => modal.close();
    footer.querySelector('#mc-inside-continue').onclick = () => {
      modal.close();
      onConfirm();
    };
  }

  window.ContentCatalog = {
    sortMcVersionsDesc,
    sourceLabel,
    targetKey,
    formatTarget,
    checkMinecraftInsideDisclaimer,

    create(cfg) {
      const p = cfg.prefix;
      const availableSources = cfg.availableSources || ['curseforge', 'modrinth', 'minecraft-inside'];
      const view = {
        query: '',
        page: 0,
        sources: cfg.hasSources ? [...availableSources] : ['minecraft-inside'],
        preferSource: cfg.fallbackSource || availableSources[0] || 'curseforge',
        mcVersion: '',
        loader: '',

        async refreshInstalled() {
          try { Store.set('installedVersions', await window.api.invoke('versions:get-installed')); } catch {}
          const targets = this.targets();
          const savedPath = Store.get('selectedInstallPath');
          const savedVersion = Store.get('selectedVersion');
          const current = targets.find(v => v.rootDir === savedPath || v.path === savedPath || v.id === savedVersion || v.profileId === savedVersion) || targets[0] || null;
          if (current) this.applyTarget(current, false);
          return targets;
        },

        targets() {
          return (Store.get('installedVersions') || []).filter(v => (v.rootDir || v.path) && (v.minecraft || v.id || v.profileId));
        },

        currentTarget() {
          const targets = this.targets();
          const savedPath = Store.get('selectedInstallPath');
          const savedVersion = Store.get('selectedVersion');
          return targets.find(v => v.rootDir === savedPath || v.path === savedPath || v.id === savedVersion || v.profileId === savedVersion) || targets[0] || null;
        },

        applyTarget(target, persist = true) {
          if (!target) return;
          const rootDir = target.rootDir || target.path;
          this.mcVersion = target.minecraft || target.id || '';
          this.loader = (cfg.passLoader && target.loader && target.loader !== 'vanilla') ? target.loader : '';
          if (persist) {
            Store.set('selectedInstallPath', rootDir);
            Store.set('selectedVersion', target.profileId || target.id);
            const bottom = document.getElementById('bottom-version');
            if (bottom) bottom.textContent = target.displayName || target.profileId || target.id;
          }
        },

        async render() {
          await this.refreshInstalled();
          const targets = this.targets();
          const current = this.currentTarget();
          const home = document.getElementById('home-view');
          document.querySelector('main.content').style.display = 'grid';
          if (home) home.style.display = 'none';
          const c = document.getElementById('library-view-content') || document.getElementById('view-container');
          if (c === document.getElementById('view-container')) {
            c.style.display = 'block';
          }

          const gridCols = cfg.hasSources
            ? 'minmax(160px,1.4fr) minmax(150px,1.2fr) minmax(85px,0.65fr) minmax(145px,1fr)'
            : 'minmax(180px,1.5fr) minmax(160px,1.3fr) minmax(90px,0.7fr) auto';

          c.innerHTML = `
            <div class="view" style="padding:24px;">
              <h1>${esc(cfg.title)}</h1>
              ${targets.length ? `<p style="color:var(--text-2);margin-bottom:14px;">${cfg.subtitle}</p>` : ''}

              <div class="search-bar" style="display:grid;grid-template-columns:${gridCols};gap:10px;align-items:center;">
                <input class="input" id="${p}-search" placeholder="${esc(cfg.searchPlaceholder)}" value="${esc(this.query)}">
                <select class="input" id="${p}-target" title="Установленная версия">
                  ${targets.length
                    ? targets.map(v => `<option value="${esc(targetKey(v))}" ${current && targetKey(v) === targetKey(current) ? 'selected' : ''}>${esc(formatTarget(v, cfg.includeLoaderInTarget !== false))}</option>`).join('')
                    : '<option value="">Версия не выбрана</option>'}
                </select>
                <input class="input" id="${p}-version" placeholder="Версия" title="Версия" value="${esc(this.mcVersion)}" readonly>
                ${cfg.hasSources ? `
                  <select class="input" id="${p}-prefer" title="Приоритет">
                    ${availableSources.map(src => `<option value="${src}" ${this.preferSource === src ? 'selected' : ''}>Приоритет: ${src === 'minecraft-inside' ? 'MC Inside' : sourceLabel(src)}</option>`).join('')}
                  </select>
                ` : `<button class="btn outline compact-btn" id="${p}-installed">${esc(cfg.installedButtonLabel || 'Установленные')}</button>`}
              </div>

              ${cfg.hasSources ? `
                <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0 14px;">
                  <span style="color:var(--text-2);font-size:12px;font-weight:600;">Источники:</span>
                  ${availableSources.map(src => `
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:12.5px;color:var(--text);">
                      <input type="checkbox" data-${p}-src="${src}" ${this.sources.includes(src) ? 'checked' : ''} style="accent-color:var(--accent);">
                      <span>${sourceLabel(src)}</span>
                    </label>`).join('')}
                  ${cfg.showRefreshButton ? `<button class="btn ghost compact-btn" id="${p}-reset-filters">Обновить версии</button>` : ''}
                  <button class="btn outline compact-btn" id="${p}-installed" style="margin-left:auto;">${esc(cfg.installedButtonLabel || 'Установленные')}</button>
                </div>
              ` : ''}

              ${targets.length ? '' : `
                <div class="mods-no-version-alert" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;margin:${cfg.hasSources ? '0' : '12px'} 0 14px;background:rgba(236,72,153,0.08);border:1px solid rgba(236,72,153,0.35);border-radius:4px;">
                  <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-hi)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style="font-size:12.5px;color:var(--text);">${esc(cfg.noVersionMessage)}</span>
                  </div>
                  <button class="btn outline compact-btn" id="${p}-go-versions" style="flex-shrink:0;">Перейти во «Версии»</button>
                </div>
              `}

              ${cfg.hasDropzone ? `<div id="${p}-dropzone" class="drop-zone">Перетащите .jar сюда — он попадёт в mods/ выбранной версии</div>` : ''}
              <div id="${p}-context" style="margin:10px 0 18px;color:var(--text-2);font-size:12px;${targets.length ? '' : 'display:none;'}"></div>
              <div id="${p}-list" class="card grid" style="grid-template-columns:1fr;"></div>
              <div style="display:flex;justify-content:center;margin-top:12px;gap:8px;">
                <button class="btn ghost" id="${p}-prev" style="${this.page > 0 ? '' : 'display:none;'}">← Назад</button>
                <span id="${p}-page" style="padding:8px 14px;">Стр. ${this.page + 1}</span>
                <button class="btn ghost" id="${p}-next">Вперёд →</button>
              </div>
            </div>
          `;

          let searchTimer = null;
          const searchEl = document.getElementById(`${p}-search`);
          searchEl.oninput = (e) => {
            this.query = e.target.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { this.page = 0; this.search(); }, 350);
          };
          searchEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
              clearTimeout(searchTimer);
              this.query = e.target.value;
              this.page = 0;
              this.search();
            }
          };

          document.getElementById(`${p}-target`).onchange = (e) => {
            const target = this.targets().find(v => targetKey(v) === e.target.value);
            if (target) this.applyTarget(target, true);
            this.page = 0;
            this.render();
          };

          if (cfg.hasSources) {
            document.getElementById(`${p}-prefer`).onchange = (e) => {
              this.preferSource = e.target.value;
              this.page = 0;
              this.search();
            };
            document.querySelectorAll(`[data-${p}-src]`).forEach(el => {
              el.onchange = () => {
                this.sources = Array.from(document.querySelectorAll(`[data-${p}-src]:checked`))
                  .map(x => x.getAttribute(`data-${p}-src`));
                if (!this.sources.length) this.sources = [cfg.fallbackSource || 'modrinth'];
                this.page = 0;
                this.search();
              };
            });
          }

          if (cfg.showRefreshButton) {
            const resetBtn = document.getElementById(`${p}-reset-filters`);
            if (resetBtn) {
              resetBtn.onclick = async () => {
                await this.refreshInstalled();
                this.render();
              };
            }
          }

          document.getElementById(`${p}-installed`).onclick = () => this.showInstalled();
          const goVerBtn = document.getElementById(`${p}-go-versions`);
          if (goVerBtn) goVerBtn.onclick = () => { if (window.App) window.App.navigate('versions'); };
          document.getElementById(`${p}-prev`).onclick = () => { if (this.page > 0) { this.page--; this.search(); } };
          document.getElementById(`${p}-next`).onclick = () => { this.page++; this.search(); };

          if (cfg.hasDropzone) {
            const dz = document.getElementById(`${p}-dropzone`);
            dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
            dz.ondragleave = () => dz.classList.remove('over');
            dz.ondrop = async (e) => {
              e.preventDefault();
              dz.classList.remove('over');
              const target = this.currentTarget();
              if (!target) { Toast.error('Нет версии', 'Сначала установите и выберите версию Minecraft.'); return; }
              const rootDir = target.rootDir || target.path;
              const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jar'));
              for (const f of files) {
                const buf = await f.arrayBuffer();
                await window.api.invoke(cfg.installChannel, { fileName: f.name, buffer: buf, rootDir, gameDir: rootDir });
              }
              Toast.success('Готово', `Установлено ${files.length} файлов в ${rootDir}/${cfg.folderName}`);
            };
          }

          this.updateContext();
          this.search();
        },

        updateContext() {
          const el = document.getElementById(`${p}-context`);
          if (!el) return;
          const target = this.currentTarget();
          if (!target) {
            el.style.display = 'none';
            el.textContent = '';
            return;
          }
          el.style.display = '';
          const rootDir = target.rootDir || target.path;
          const loaderInfo = cfg.passLoader ? ` · ${this.loader || 'vanilla/любой загрузчик'}` : '';
          el.textContent = `Каталог ограничен выбранной версией Minecraft: ${this.mcVersion || 'любая'}${loaderInfo}. Установка пойдёт сюда: ${rootDir}/${cfg.folderName}`;
        },

        showPreview(item) {
          const body = document.createElement('div');
          body.style.display = 'flex';
          body.style.flexDirection = 'column';
          body.style.gap = '14px';

          const sortedVersions = sortMcVersionsDesc(item.mcVersions);

          const header = `
            <div style="display:flex;gap:14px;align-items:flex-start;">
              <div style="width:64px;height:64px;border-radius:4px;background:var(--bg-2);background-size:cover;background-position:center;flex-shrink:0;${item.icon ? `background-image:url('${item.icon}')` : ''}"></div>
              <div style="flex:1;min-width:0;">
                <h3 style="margin:0 0 4px;font-size:17px;color:var(--text-0);">${esc(item.title || '')}</h3>
                <div style="font-size:12px;color:var(--text-2);margin-bottom:6px;">
                  Автор: <strong>${esc(item.author || '—')}</strong> · Источник: <span class="badge" style="font-size:11px;padding:2px 6px;">${esc(sourceLabel(item.source || cfg.defaultSource))}</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--text-2);">
                  ${item.downloads ? `<span>⬇ ${Number(item.downloads).toLocaleString('ru-RU')} скачиваний</span>` : ''}
                  ${item.loader ? `<span>⚙ ${esc(item.loader)}</span>` : ''}
                </div>
              </div>
            </div>
          `;

          const desc = `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;padding:12px;font-size:13px;line-height:1.6;color:var(--text-1);max-height:220px;overflow-y:auto;white-space:pre-wrap;">
              ${esc(item.description || 'Описание отсутствует.')}
            </div>
          `;

          const versions = sortedVersions.length ? `
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:6px;">Поддерживаемые версии Minecraft:</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:80px;overflow-y:auto;">
                ${sortedVersions.map(v => `<span style="background:var(--bg-2);border:1px solid var(--border);padding:2px 8px;border-radius:4px;font-size:11px;color:var(--text-1);">${esc(v)}</span>`).join('')}
              </div>
            </div>
          ` : '';

          body.innerHTML = header + desc + versions;

          const hasTarget = Boolean(this.currentTarget());
          const footer = document.createElement('div');
          footer.style.display = 'flex';
          footer.style.gap = '10px';
          footer.style.justifyContent = 'flex-end';
          footer.innerHTML = `
            ${item.url ? `<button class="btn outline" id="modal-preview-site">Открыть сайт в браузере</button>` : ''}
            <button class="btn ${hasTarget ? 'primary' : 'ghost disabled'}" id="modal-preview-install" ${hasTarget ? '' : 'disabled title="Сначала установите версию игры" data-tip="Сначала установите версию игры"'}>${esc(cfg.modalInstallLabel || 'Установить')}</button>
            <button class="btn ghost" id="modal-preview-close">Закрыть</button>
          `;

          const modal = Modal.open({
            title: esc(item.title || 'Подробнее'),
            body,
            footer,
            size: 'large'
          });

          const siteBtn = footer.querySelector('#modal-preview-site');
          if (siteBtn && item.url) {
            siteBtn.onclick = () => window.api.shell.openExternal(item.url);
          }
          footer.querySelector('#modal-preview-close').onclick = () => modal.close();
          footer.querySelector('#modal-preview-install').onclick = () => {
            modal.close();
            this.installItem(item);
          };
        },

        async installItem(item) {
          if (cfg.customInstall) {
            return cfg.customInstall.call(this, item);
          }
          const target = this.currentTarget();
          if (!target) { Toast.error('Нет версии', 'Сначала установите и выберите версию Minecraft.'); return; }
          checkMinecraftInsideDisclaimer(item, cfg.disclaimerText, async () => {
            const rootDir = target.rootDir || target.path;
            try {
              const result = await window.api.invoke(cfg.installChannel, {
                ...item,
                rootDir,
                gameDir: rootDir,
                mcVersion: target.minecraft || target.id || this.mcVersion,
                loader: target.loader && target.loader !== 'vanilla' ? target.loader : ''
              });
              Toast.success(cfg.installSuccessTitle, result && result.path ? result.path : `${rootDir}/${cfg.folderName}`);
              this.search();
            } catch (e) { Toast.error('Ошибка', e.message); }
          });
        },

        async search() {
          this.updateContext();
          const list = document.getElementById(`${p}-list`);
          list.innerHTML = '<div class="empty-state"><span class="spinner"></span> Загрузка…</div>';
          try {
            const payload = {
              query: this.query,
              mcVersion: this.mcVersion,
              page: this.page,
              pageSize: 60
            };
            if (cfg.hasSources) {
              payload.sources = this.sources;
              payload.preferSource = this.preferSource;
            }
            if (cfg.passLoader) payload.loader = this.loader;

            const r = await window.api.invoke(cfg.searchChannel, payload);
            const pageEl = document.getElementById(`${p}-page`);
            if (pageEl) pageEl.textContent = `Стр. ${this.page + 1}`;
            const prevBtn = document.getElementById(`${p}-prev`);
            if (prevBtn) prevBtn.style.display = this.page > 0 ? '' : 'none';
            if (!r.hits.length) {
              list.innerHTML = `<div class="empty-state">Ничего не найдено${r.errors && r.errors.length ? `<br><small>${esc(r.errors.join(' · '))}</small>` : ''}</div>`;
              return;
            }
            const target = this.currentTarget();
            const rootDir = target && (target.rootDir || target.path);
            const installed = rootDir ? await window.api.invoke(cfg.installedChannel, rootDir) : [];
            const hasTarget = Boolean(rootDir);

            list.innerHTML = r.hits.map((item, idx) => {
              const already = isInstalled(installed, item);
              const sortedVersions = sortMcVersionsDesc(item.mcVersions);
              return `
                <div class="mod-card">
                  <div class="icon" style="${item.icon ? `background-image:url('${item.icon}')` : 'background:var(--bg-2);'}"></div>
                  <div class="info">
                    <h3>${esc(item.title)}</h3>
                    <div class="author">${esc(item.author || (cfg.defaultSource ? sourceLabel(cfg.defaultSource) : '—'))}${cfg.hasSources ? ` · ${sourceLabel(item.source)}` : ''}</div>
                    <div class="desc">${esc(item.description || '')}</div>
                    <div class="stats">
                      ${item.downloads ? `<span>⬇ ${Number(item.downloads).toLocaleString('ru-RU')}</span>` : ''}
                      ${sortedVersions.length ? `<span>Версии: ${esc(sortedVersions.slice(0, 4).join(', '))}</span>` : ''}
                      ${cfg.passLoader && item.loader ? `<span>${esc(item.loader)}</span>` : ''}
                      ${already ? '<span style="color:var(--ok);">✓ Установлено</span>' : ''}
                    </div>
                  </div>
                  <div class="actions">
                    <button class="btn ${already ? 'ghost' : (hasTarget ? 'primary' : 'ghost disabled')}" style="padding:6px 14px;font-size:12px;" data-install="${idx}" ${hasTarget && !already ? '' : 'disabled'} ${!hasTarget && !already ? 'title="Сначала установите версию игры" data-tip="Сначала установите версию игры"' : ''}>${already ? 'Установлено' : esc(cfg.installButtonLabel || 'Установить')}</button>
                    <button class="btn ghost" style="padding:6px 14px;font-size:12px;" data-preview="${idx}">Подробнее</button>
                  </div>
                </div>
              `;
            }).join('');

            list.querySelectorAll('[data-install]').forEach(b => b.onclick = () => this.installItem(r.hits[Number(b.dataset.install)]));
            list.querySelectorAll('[data-preview]').forEach(b => b.onclick = () => this.showPreview(r.hits[Number(b.dataset.preview)]));
          } catch (e) {
            list.innerHTML = `<div class="empty-state">Ошибка: ${esc(e.message)}</div>`;
          }
        },

        async showInstalled() {
          const target = this.currentTarget();
          const el = document.getElementById(`${p}-list`);
          if (!target) { el.innerHTML = '<div class="empty-state">Нет выбранной установленной версии</div>'; return; }
          const rootDir = target.rootDir || target.path;
          const list = await window.api.invoke(cfg.installedChannel, rootDir);
          if (!list.length) {
            el.innerHTML = `<div class="empty-state">Нет установленных файлов в ${esc(rootDir)}/${esc(cfg.folderName)}</div>`;
            return;
          }
          el.innerHTML = list.map(m => `
            <div class="mod-card">
              <div class="icon" style="background:var(--bg-2);display:flex;align-items:center;justify-content:center;color:var(--accent);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2v6h6"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              </div>
              <div class="info">
                <h3>${esc(m.title || m.fileName)}</h3>
                <div class="author">${m.size ? `${(m.size / 1024).toFixed(1)} KB` : esc(m.source || '')}</div>
                <div class="desc">${esc(m.path || '')}</div>
              </div>
              ${cfg.removeChannel ? `
                <div class="actions">
                  <button class="btn ghost" style="padding:6px 14px;font-size:12px;" data-del="${esc(m.fileName)}">Удалить</button>
                </div>
              ` : ''}
            </div>
          `).join('');

          if (cfg.removeChannel) {
            el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
              await window.api.invoke(cfg.removeChannel, { fileName: b.dataset.del, rootDir });
              Toast.info('Удалено');
              this.showInstalled();
            });
          }
        },

        destroy() {}
      };

      return view;
    }
  };
})();
