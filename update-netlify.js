/**
 * Netlify Release Updater & Deployer for Nexus Launcher 2026.1.2
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const NETLIFY_TOKEN = process.env.NETLIFY_PERSONAL_ACCESS_TOKEN || 'nfp_Lf2nc4pLN5f1GviMSutQo8RRmPJM6xZn04a2';
const OLD_VERSION = '2026.1.1';
const NEW_VERSION = '2026.1.2';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = !options.protocol || options.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : parsed}`));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function netlifyApi(apiPath, method = 'GET', body = null, headers = {}) {
  const isUrl = apiPath.startsWith('http');
  const parsedUrl = isUrl ? new URL(apiPath) : null;

  const options = {
    hostname: parsedUrl ? parsedUrl.hostname : 'api.netlify.com',
    port: parsedUrl ? (parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80)) : 443,
    path: parsedUrl ? parsedUrl.pathname + parsedUrl.search : '/api/v1' + apiPath,
    method,
    headers: {
      'Authorization': `Bearer ${NETLIFY_TOKEN}`,
      'User-Agent': 'Nexus-Netlify-Deployer',
      'Content-Type': 'application/json',
      ...headers
    }
  };

  return await request(options, body);
}

async function main() {
  console.log('===================================================');
  console.log('  Nexus Launcher - Netlify Deployer (2026.1.2)');
  console.log('===================================================\n');

  console.log('[1/4] Подключение к Netlify API...');
  let sitesRes;
  try {
    sitesRes = await netlifyApi('/sites');
  } catch (err) {
    console.error('Ошибка доступа к Netlify API:', err.message);
    process.exit(1);
  }

  const sites = sitesRes.data || [];
  console.log(`Найдено сайтов в аккаунте Netlify: ${sites.length}`);

  if (sites.length === 0) {
    console.log('В аккаунте Netlify пока нет созданных сайтов.');
    return;
  }

  for (const site of sites) {
    console.log('\n---------------------------------------------------');
    console.log(`Проект: ${site.name}`);
    console.log(`ID: ${site.id}`);
    console.log(`URL: ${site.ssl_url || site.url}`);
    if (site.build_settings && site.build_settings.repo_url) {
      console.log(`Репозиторий: ${site.build_settings.repo_url}`);
    }

    // 1. If site is connected to git repository
    if (site.build_settings && site.build_settings.repo_url) {
      console.log(`[2/4] Запуск новой сборки (Trigger Build) для репозитория...`);
      try {
        const buildRes = await netlifyApi(`/sites/${site.id}/builds`, 'POST', {});
        console.log(`✓ Сборка успешно запущена! ID деплоя: ${buildRes.data && buildRes.data.id ? buildRes.data.id : 'OK'}`);
      } catch (e) {
        console.warn(`Не удалось запустить автосборку git: ${e.message}`);
      }
    }

    // 2. Check latest deploy files to replace release version
    console.log(`[3/4] Проверка опубликованных файлов сайта...`);
    try {
      const deploysRes = await netlifyApi(`/sites/${site.id}/deploys?per_page=1`);
      const latestDeploy = (deploysRes.data && deploysRes.data[0]) || null;
      if (latestDeploy) {
        console.log(`Текущий деплой: ${latestDeploy.id} (${latestDeploy.state})`);

        // Check if there are downloadable files / HTML to update
        const filesRes = await netlifyApi(`/deploys/${latestDeploy.id}/files`);
        const files = filesRes.data || [];
        console.log(`Файлов в деплое: ${files.length}`);

        let modified = false;
        const deployFiles = {};

        for (const file of files) {
          const filePath = file.path;
          if (filePath.endsWith('.html') || filePath.endsWith('.json') || filePath.endsWith('.js')) {
            try {
              // Fetch file content
              const fileContentRes = await request({
                hostname: parsedSiteUrl(site.ssl_url || site.url).hostname,
                path: filePath,
                method: 'GET',
                headers: { 'User-Agent': 'Nexus-Deployer' }
              });

              if (typeof fileContentRes.data === 'string' && fileContentRes.data.includes(OLD_VERSION)) {
                console.log(`-> Обновление версии в файле: ${filePath}`);
                let updated = fileContentRes.data.split(OLD_VERSION).join(NEW_VERSION);
                deployFiles[filePath.replace(/^\//, '')] = updated;
                modified = true;
              }
            } catch (fe) {
              // file fetch error, ignore
            }
          }
        }

        if (modified) {
          console.log(`[4/4] Загрузка обновлённого релиза 2026.1.2 в Netlify...`);
          // Deploy updated files via zip/hash deploy
          // Trigger deploy
          const newDeployRes = await netlifyApi(`/sites/${site.id}/deploys`, 'POST', {
            title: `Release ${NEW_VERSION} Update`,
            files: Object.keys(deployFiles).reduce((acc, k) => {
              const crypto = require('crypto');
              const hash = crypto.createHash('sha1').update(deployFiles[k]).digest('hex');
              acc[k] = hash;
              return acc;
            }, {})
          });

          const newDeployId = newDeployRes.data.id;
          const required = newDeployRes.data.required || [];
          console.log(`Деплой создан: ${newDeployId}, требуется загрузить файлов: ${required.length}`);

          for (const sha of required) {
            const fileKey = Object.keys(deployFiles).find(k => {
              const crypto = require('crypto');
              return crypto.createHash('sha1').update(deployFiles[k]).digest('hex') === sha;
            });
            if (fileKey) {
              const content = deployFiles[fileKey];
              await netlifyApi(`/deploys/${newDeployId}/files/${encodeURIComponent(fileKey)}`, 'PUT', content, {
                'Content-Type': 'application/octet-stream'
              });
              console.log(`  ✓ Загружен: ${fileKey}`);
            }
          }
          console.log(`✓ Деплой сайта ${site.name} успешно обновлён на версию ${NEW_VERSION}!`);
        } else {
          console.log(`Файлы сайта не содержали устаревших ссылок ${OLD_VERSION} (или сайт собирается напрямую из GitHub).`);
        }
      }
    } catch (err) {
      console.log(`Информация о деплоях: ${err.message}`);
    }
  }

  console.log('\n===================================================');
  console.log(`  [УСПЕХ] Netlify проект(ы) успешно обновлены!`);
  console.log(`  Версия релиза: ${NEW_VERSION}`);
  console.log('===================================================\n');
}

function parsedSiteUrl(urlStr) {
  try {
    return new URL(urlStr);
  } catch {
    return { hostname: 'localhost' };
  }
}

main().catch(e => {
  console.error('[ОШИБКА]', e);
  process.exit(1);
});
