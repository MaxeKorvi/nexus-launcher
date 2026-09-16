'use strict';

/**
 * Intelligent Crash Diagnostics Engine for Minecraft
 * Analyzes crash reports, latest.log, and process stderr to detect
 * root causes and suggest actionable solutions in Russian.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function findLatestCrashReport(gameDir) {
  const crashDir = path.join(gameDir, 'crash-reports');
  if (!fs.existsSync(crashDir)) return null;

  try {
    const files = await fsp.readdir(crashDir);
    const textFiles = files.filter(f => f.startsWith('crash-') && f.endsWith('.txt'));
    if (!textFiles.length) return null;

    let newest = null;
    let newestMtime = 0;
    for (const f of textFiles) {
      const fullPath = path.join(crashDir, f);
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs > newestMtime) {
        newestMtime = stat.mtimeMs;
        newest = fullPath;
      }
    }

    // Only return if report was generated in the last 10 minutes
    if (Date.now() - newestMtime < 10 * 60 * 1000) {
      return newest;
    }
  } catch {}
  return null;
}

async function readLogSnippet(gameDir) {
  const logFile = path.join(gameDir, 'logs', 'latest.log');
  if (!fs.existsSync(logFile)) return '';
  try {
    const stat = await fsp.stat(logFile);
    const readLen = Math.min(stat.size, 65536); // read up to last 64KB
    const fd = await fsp.open(logFile, 'r');
    const buf = Buffer.alloc(readLen);
    await fd.read(buf, 0, readLen, Math.max(0, stat.size - readLen));
    await fd.close();
    return buf.toString('utf8');
  } catch {
    return '';
  }
}

async function analyzeCrash(gameDir, exitCode, stderrLines = []) {
  const stderrText = (Array.isArray(stderrLines) ? stderrLines.join('\n') : String(stderrLines || ''));
  const reportPath = await findLatestCrashReport(gameDir);
  let reportText = '';
  if (reportPath) {
    try {
      reportText = await fsp.readFile(reportPath, 'utf8');
    } catch {}
  }

  const logText = await readLogSnippet(gameDir);
  const combined = `${stderrText}\n${reportText}\n${logText}`;

  // 1. Out of memory
  if (/OutOfMemoryError|There is insufficient memory|Metaspace|unable to create new native thread/i.test(combined)) {
    return {
      isCrash: true,
      exitCode,
      type: 'oom',
      title: 'Нехватка оперативной памяти (OOM)',
      reason: 'Minecraft аварийно завершился из-за нехватки оперативной памяти (java.lang.OutOfMemoryError). Вашей сборке требуется больше ОЗУ.',
      solution: 'Перейдите в «Настройки» и увеличьте ползунок выделяемой памяти до 4–6 ГБ (или нажмите кнопку «Рекомендуемое»).',
      conflictingMods: [],
      action: { type: 'navigate', target: 'settings', label: 'Настроить память' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /OutOfMemoryError/i)
    };
  }

  // 2. OptiFine + Sodium / Embeddium / Rubidium conflict
  if (
    (/optifine/i.test(combined) && /(?:sodium|embeddium|rubidium)/i.test(combined)) ||
    /Cannot load both.*OptiFine.*Sodium|OptiFine is not compatible with Sodium/i.test(combined)
  ) {
    return {
      isCrash: true,
      exitCode,
      type: 'mod_conflict_render',
      title: 'Конфликт модов: OptiFine и Sodium/Embeddium',
      reason: 'Мод OptiFine конфликтует с Sodium/Embeddium. Оба мода одновременно перехватывают движок рендеринга графики и несовместимы друг с другом.',
      solution: 'Удалите OptiFine или Sodium из папки mods. Для шейдеров на Fabric используйте связку «Fabric + Iris Shaders».',
      conflictingMods: ['OptiFine', 'Sodium/Embeddium'],
      action: { type: 'open_folder', target: path.join(gameDir, 'mods'), label: 'Открыть папку mods' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /optifine|sodium/i)
    };
  }

  // 3. Missing Fabric API
  const fabricApiMatch = combined.match(/requires.*fabric-api|needs.*fabric-api|Could not find required mod: fabric-api|Unsatisfied dependency.*fabric/i);
  if (fabricApiMatch) {
    return {
      isCrash: true,
      exitCode,
      type: 'missing_fabric_api',
      title: 'Отсутствует библиотека Fabric API',
      reason: 'Один или несколько установленных Fabric-модов требуют базовую библиотеку «Fabric API», которая сейчас не установлена.',
      solution: 'Установите Fabric API соответствующей версии Minecraft во вкладке «Моды».',
      conflictingMods: ['Fabric API (отсутствует)'],
      action: { type: 'navigate', target: 'mods', label: 'Перейти к установке модов' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /fabric-api/i)
    };
  }

  // 4. Duplicate mods
  const dupMatch = combined.match(/Duplicate mods? (?:found|detected)|Found duplicate mods?: '([^']+)'|Duplicate mod ID: '([^']+)'/i);
  if (dupMatch) {
    const modId = dupMatch[1] || dupMatch[2] || 'мод';
    return {
      isCrash: true,
      exitCode,
      type: 'duplicate_mod',
      title: 'Обнаружен дубликат мода',
      reason: `В папке mods находятся две разные версии одного и того же мода (${modId}).`,
      solution: 'Откройте папку mods и удалите одну из версий дублирующегося файла.',
      conflictingMods: [modId],
      action: { type: 'open_folder', target: path.join(gameDir, 'mods'), label: 'Открыть папку mods' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /Duplicate/i)
    };
  }

  // 5. Incompatible Java version
  const javaVerMatch = combined.match(/UnsupportedClassVersionError.*class file version (\d+)/i);
  if (javaVerMatch) {
    const classVer = Number(javaVerMatch[1]);
    const reqJava = classVer === 65 ? 'Java 21' : classVer === 61 ? 'Java 17' : classVer === 60 ? 'Java 16' : 'Java 8';
    return {
      isCrash: true,
      exitCode,
      type: 'java_version',
      title: 'Несовместимая версия Java',
      reason: `Игра или один из модов требуют более новую версию Java (${reqJava}). Выбранная Java устарела для этого ядра.`,
      solution: `В Настройках лаунчера переключите Java на совместимую версию (${reqJava}) или выберите автоопределение.`,
      conflictingMods: [],
      action: { type: 'navigate', target: 'settings', label: 'Настроить Java' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /UnsupportedClassVersionError/i)
    };
  }

  // 6. Old Forge on modern Java
  if (/URLClassLoader/i.test(combined) && /launchwrapper/i.test(combined)) {
    return {
      isCrash: true,
      exitCode,
      type: 'forge_legacy_java',
      title: 'Для старого Forge требуется Java 8',
      reason: 'Forge для версий 1.7.10 – 1.12.2 не может запускаться на Java 9+ из-за ограничений загрузчика LaunchWrapper.',
      solution: 'Установите и выберите Java 8 в настройках лаунчера.',
      conflictingMods: [],
      action: { type: 'navigate', target: 'settings', label: 'Выбрать Java 8' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /launchwrapper|URLClassLoader/i)
    };
  }

  // 7. Mixin transformation error (mod crash)
  if (/MixinTransformerError|Failed to apply mixin|MixinApplyError/i.test(combined)) {
    const modCandidate = combined.match(/from mod ([a-zA-Z0-9_\-]+)|in config \[([a-zA-Z0-9_\-\.]+)\.mixins\.json\]/i);
    const modName = modCandidate ? (modCandidate[1] || modCandidate[2]) : null;
    return {
      isCrash: true,
      exitCode,
      type: 'mixin_error',
      title: 'Сбой инъекции Mixin (конфликт мода)',
      reason: modName
        ? `Мод «${modName}» вызвал критический конфликт при попытке модифицировать код игры.`
        : 'Один из модов вызвал критическую ошибку при инъекции в код клиента.',
      solution: modName
        ? `Попробуйте временно отключить или обновить мод «${modName}» в папке mods.`
        : 'Проверьте совместимость недавно добавленных модов в папке mods.',
      conflictingMods: modName ? [modName] : [],
      action: { type: 'open_folder', target: path.join(gameDir, 'mods'), label: 'Открыть папку mods' },
      reportFile: reportPath,
      logSnippet: extractRelevantSnippet(combined, /Mixin/i)
    };
  }

  // 8. Generic fallback
  return {
    isCrash: true,
    exitCode,
    type: 'generic',
    title: `Minecraft закрылся с кодом ошибки ${exitCode}`,
    reason: reportPath
      ? 'Игра аварийно закрылась. В папке crash-reports сформирован подробный отчёт об ошибке.'
      : 'Процесс завершился некорректно. Ознакомьтесь с журналом консоли для выяснения причины.',
    solution: 'Нажмите «Открыть консоль» или перейдите в папку с краш-репортами для просмотра деталей.',
    conflictingMods: [],
    action: { type: 'navigate', target: 'console', label: 'Открыть консоль' },
    reportFile: reportPath,
    logSnippet: stderrText.slice(-600) || logText.slice(-600)
  };
}

function extractRelevantSnippet(text, regex, linesRadius = 5) {
  const lines = text.split('\n');
  let matchIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx === -1) return lines.slice(-8).join('\n');
  const start = Math.max(0, matchIdx - linesRadius);
  const end = Math.min(lines.length, matchIdx + linesRadius + 1);
  return lines.slice(start, end).join('\n');
}

module.exports = {
  analyzeCrash,
  findLatestCrashReport
};
