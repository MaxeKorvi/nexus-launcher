#!/usr/bin/env bash
# ============================================================================
# AMOLED Minecraft Launcher — master bootstrap script
# ----------------------------------------------------------------------------
# Этот скрипт делает АБСОЛЮТНО ВСЁ за вас:
#   1. Проверяет Arch Linux
#   2. Ставит системные зависимости через pacman (с sudo)
#   3. Ставит Node.js (LTS) если нет
#   4. Устанавливает npm-зависимости (electron и т.д.)
#   5. Запускает лаунчер
#
# Запуск:
#   chmod +x start.sh && ./start.sh
#
# Скрипт написан под bash (POSIX), потому что start.sh — это всегда bash.
# Fish вы используете в интерактиве — это нормально, start.sh запустится в bash
# (shebang #!/usr/bin/env bash это гарантирует).
#
# После первого запуска для повторного старта без переустановок:
#   ./start.sh --run        # только запустить
#   ./start.sh --rebuild    # пересобрать node_modules и запустить
#   ./start.sh --dist       # собрать AppImage/DEB/RPM
# ============================================================================

set -e

# ─── Цвета для вывода ──────────────────────────────────────────────────────
RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; ORANGE=$'\e[38;5;208m'
BLUE=$'\e[34m'; BOLD=$'\e[1m'; RESET=$'\e[0m'

log()   { printf "%s┃%s %s\n" "$ORANGE" "$RESET" "$*"; }
ok()    { printf "%s✓%s %s\n" "$GREEN" "$RESET" "$*"; }
warn()  { printf "%s!%s %s\n" "$YELLOW" "$RESET" "$*"; }
err()   { printf "%s✗%s %s\n" "$RED" "$RESET" "$*" >&2; }
title() { printf "\n%s═══ %s ═══%s\n" "$BOLD$ORANGE" "$*" "$RESET"; }

# ─── Определение каталога скрипта ──────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Подхватываем локальный .env, но НЕ через source.
# CurseForge ключи часто содержат "$" — обычный source портит такой ключ
# из-за shell-подстановок ($2, $10 и т.д.).
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  CF_LINE="$(grep -m1 -E '^[[:space:]]*CF_API_KEY[[:space:]]*=' "${SCRIPT_DIR}/.env" || true)"
  if [[ -n "${CF_LINE}" ]]; then
    CF_VALUE="${CF_LINE#*=}"
    CF_VALUE="${CF_VALUE#"${CF_VALUE%%[![:space:]]*}"}"
    CF_VALUE="${CF_VALUE%"${CF_VALUE##*[![:space:]]}"}"
    CF_VALUE="${CF_VALUE%$'\r'}"
    # Убираем только внешние кавычки, если они есть.
    if [[ "${CF_VALUE}" == \"*\" && "${CF_VALUE}" == *\" ]]; then
      CF_VALUE="${CF_VALUE:1:${#CF_VALUE}-2}"
    elif [[ "${CF_VALUE}" == \'*\' && "${CF_VALUE}" == *\' ]]; then
      CF_VALUE="${CF_VALUE:1:${#CF_VALUE}-2}"
    fi
    export CF_API_KEY="${CF_VALUE}"
  fi
fi

# Проверка, что папка распакована полностью.
# Если здесь нет src/main/main.js, Electron запустит package.json, но не найдёт приложение.
if [[ ! -f "${SCRIPT_DIR}/src/main/main.js" ]]; then
  err "Исходники распакованы не полностью: нет src/main/main.js"
  err "Текущая папка: ${SCRIPT_DIR}"
  err "Удалите эту папку и распакуйте архив заново так, чтобы внутри были package.json и папка src/"
  err "Команды:"
  err "  cd ~/Загрузки"
  err "  rm -rf launcher-source"
  err "  unzip nexus-launcher-v1_1_14-hotfix9-modpack-details-versions.zip"
  err "  cd launcher-source"
  err "  ./start.sh"
  exit 1
fi

MODE="${1:-install-and-run}"

# ─── 1. Проверка ОС ─────────────────────────────────────────────────────────
title "Проверка системы"

if [[ ! -f /etc/arch-release ]]; then
  warn "Это не Arch Linux (нет /etc/arch-release)."
  warn "Скрипт продолжит, но команды pacman могут не сработать."
  warn "Если у вас другой дистрибутив — установите зависимости вручную."
else
  ok "Arch Linux обнаружен."
fi

# Проверка fish (опционально)
if command -v fish &>/dev/null; then
  ok "Fish shell обнаружен: $(fish --version | head -1)"
else
  warn "Fish shell не найден (вы упомянули, что используете его). Установлю."
  sudo pacman -S --noconfirm --needed fish || warn "Не удалось установить fish (не критично)."
fi

# ─── 2. Установка системных зависимостей ────────────────────────────────────
title "Установка системных зависимостей (pacman)"

# Список пакетов, нужных Electron на Linux:
#   - nodejs, npm — для запуска и сборки
#   - fish — ваша оболочка
#   - git — для загрузки зависимостей
#   - base-devel — gcc, make, etc. для сборки нативных модулей (keytar)
#   - gtk3, nss, at-spi2-atk, at-spi2-core, cups, libxcomposite, libxdamage
#     libxrandr, libxkbcommon, pango, alsa-lib, mesa, libdrm — Electron runtime
#   - java-runtime (jre-openjdk) — для запуска Minecraft
#   - libsecret — для keytar (GNOME Keyring)
#   - webkit2gtk — для встроенных веб-вью (опционально, Electron может юзать)
#   - tar — для распаковки Java (Azul Zulu)

PKGS=(
  nodejs npm git base-devel
  gtk3 nss at-spi2-atk at-spi2-core cups libxcomposite libxdamage
  libxrandr libxkbcommon pango alsa-lib mesa libdrm
  jre-openjdk libsecret tar xdg-utils unzip
  fontconfig ttf-dejavu ttf-liberation noto-fonts
)

log "Проверяю установленные пакеты…"
NEEDED=()
for pkg in "${PKGS[@]}"; do
  if pacman -Qi "$pkg" &>/dev/null; then
    : # уже установлен
  else
    NEEDED+=("$pkg")
  fi
done

if [[ ${#NEEDED[@]} -eq 0 ]]; then
  ok "Все системные пакеты уже установлены."
else
  log "Будут установлены: ${NEEDED[*]}"
  log "Требуется sudo. Введите пароль если потребуется."
  sudo pacman -Sy --noconfirm --needed "${NEEDED[@]}" || {
    err "Ошибка установки пакетов pacman."
    err "Попробуйте вручную: sudo pacman -S ${NEEDED[*]}"
    exit 1
  }
  ok "Системные пакеты установлены."
fi

# ─── 3. Проверка Node.js ────────────────────────────────────────────────────
title "Проверка Node.js"

if ! command -v node &>/dev/null; then
  err "Node.js не установлен. Установите: sudo pacman -S nodejs npm"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VER" -lt 18 ]]; then
  err "Требуется Node.js >= 18. У вас: $(node -v)"
  err "Обновите: sudo pacman -Syu nodejs"
  exit 1
fi

ok "Node.js: $(node -v)"
ok "npm: $(npm -v)"

# ─── 4. Установка npm-зависимостей ──────────────────────────────────────────
if [[ "$MODE" == "--rebuild" || "$MODE" == "install-and-run" ]]; then
  title "Установка npm-зависимостей"

  # Наличие каталога node_modules ещё не означает, что установка завершилась:
  # предыдущий npm install мог оборваться. Проверяем все обязательные модули.
  if [[ -d node_modules && "$MODE" != "--rebuild" ]] && \
     node -e "for (const name of ['axios','electron-store','jszip','electron']) require.resolve(name)" &>/dev/null; then
    ok "Все обязательные npm-зависимости установлены."
  else
    if [[ -d node_modules && "$MODE" != "--rebuild" ]]; then
      warn "node_modules неполный — восстанавливаю отсутствующие зависимости."
    fi
    if [[ "$MODE" == "--rebuild" && -d node_modules ]]; then
      log "Удаляю старый node_modules…"
      rm -rf node_modules package-lock.json
    fi

    # Явно разрешаем postinstall-скрипты (нужны для скачивания Electron-бинарника)
    export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
    export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

    log "Устанавливаю пакеты (это может занять несколько минут)…"
    log "Electron ~250 MB будет скачан через зеркало npmmirror.com (надёжнее GitHub)."

    npm install --no-audit --no-fund --loglevel=error --foreground-scripts || {
      err "npm install упал. Попробуйте:"
      err "  npm cache clean --force"
      err "  rm -rf node_modules package-lock.json"
      err "  ./start.sh --rebuild"
      exit 1
    }

    ok "npm-зависимости установлены."
  fi
fi

# ─── 4.5. Проверка и починка Electron-бинарника ────────────────────────────
title "Проверка Electron-бинарника"

# Electron postinstall иногда не отрабатывает (тихо падает на скачивании).
# Проверяем, что node_modules/electron/dist/electron существует; если нет — чиним.
ELECTRON_DIR="node_modules/electron"
ELECTRON_BIN="$ELECTRON_DIR/dist/electron"
ELECTRON_PATH_FILE="$ELECTRON_DIR/path.txt"
ELECTRON_INSTALLED=0

# npm-пакет Electron ищет исполняемый файл через path.txt. Проверяем оба файла,
# иначе `electron .` сообщает, что Electron установлен некорректно.
if [[ -x "$ELECTRON_BIN" && -f "$ELECTRON_PATH_FILE" && "$(tr -d '\r\n' < "$ELECTRON_PATH_FILE")" == "electron" ]]; then
  if "$ELECTRON_BIN" --version &>/dev/null; then
    ok "Electron-бинарник на месте и исправен."
    ELECTRON_INSTALLED=1
  else
    warn "Electron найден, но не запускается. Переустанавливаю только Electron."
    rm -rf "$ELECTRON_DIR/dist" "$ELECTRON_PATH_FILE"
  fi
else
  warn "Electron-бинарник отсутствует (postinstall не отработал). Чиню…"

  # Список зеркал (пробуем по очереди)
  MIRRORS=(
    "https://npmmirror.com/mirrors/electron/"
    "https://github.com/electron/electron/releases/download/"
    "https://mirrors.tuna.tsinghua.edu.cn/electron/"
  )

  for MIRROR in "${MIRRORS[@]}"; do
    log "Пробую зеркало: $MIRROR"
    ELECTRON_MIRROR="$MIRROR" node node_modules/electron/install.js 2>&1 | tail -10
    if [[ -x "$ELECTRON_BIN" ]]; then
      ok "Electron-бинарник скачан через $MIRROR"
      ELECTRON_INSTALLED=1
      break
    fi
  done

  if [[ $ELECTRON_INSTALLED -eq 0 ]]; then
    # Последняя попытка — скачать вручную через curl
    warn "Зеркала не помогли. Пробую прямое скачивание через curl…"
    ELECTRON_VERSION=$(node -p "require('./node_modules/electron/package.json').version")
    case "$(uname -m)" in
      x86_64) ELECTRON_ARCH="x64" ;;
      aarch64|arm64) ELECTRON_ARCH="arm64" ;;
      *) err "Неподдерживаемая архитектура: $(uname -m)"; exit 1 ;;
    esac
    ELECTRON_URL="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-${ELECTRON_ARCH}.zip"
    log "URL: $ELECTRON_URL"
    if curl -L --fail --progress-bar -o /tmp/electron.zip "$ELECTRON_URL"; then
      rm -rf node_modules/electron/dist
      mkdir -p node_modules/electron/dist
      if command -v unzip &>/dev/null; then
        unzip -q /tmp/electron.zip -d node_modules/electron/dist
      else
        # Python fallback если unzip нет
        python3 -c "import zipfile; zipfile.ZipFile('/tmp/electron.zip').extractall('node_modules/electron/dist')"
      fi
      chmod +x "$ELECTRON_BIN" 2>/dev/null || true
      # Electron CLI читает path.txt буквально: завершающий перевод строки становится
      # частью пути и приводит к spawn .../electron\n ENOENT.
      printf '%s' 'electron' > "$ELECTRON_PATH_FILE"
      rm -f /tmp/electron.zip
      if [[ -x "$ELECTRON_BIN" ]] && "$ELECTRON_BIN" --version &>/dev/null; then
        ok "Electron-бинарник установлен вручную и прошёл проверку."
        ELECTRON_INSTALLED=1
      fi
    else
      err "Прямое скачивание не удалось."
    fi
  fi

  if [[ $ELECTRON_INSTALLED -eq 0 ]]; then
    err "Не удалось установить Electron-бинарник ни одним способом."
    err ""
    err "Ручное решение:"
    err "  1. Проверьте интернет: curl -I https://github.com/electron/electron/releases"
    err "  2. Если GitHub заблокирован, используйте VPN:"
    err "     ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \\"
    err "       node node_modules/electron/install.js"
    err "  3. Либо установите electron из AUR: yay -S electron"
    err "     и создайте симлинк: ln -sf /usr/bin/electron node_modules/electron/dist/electron"
    exit 1
  fi
fi

# Финальная проверка покрывает также случай повреждённого, но существующего бинарника.
if [[ $ELECTRON_INSTALLED -eq 0 ]]; then
  warn "Повторно запускаю официальный установщик Electron после очистки."
  rm -rf "$ELECTRON_DIR/dist" "$ELECTRON_PATH_FILE"
  ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node "$ELECTRON_DIR/install.js" || true
  if [[ -x "$ELECTRON_BIN" && -f "$ELECTRON_PATH_FILE" ]] && "$ELECTRON_BIN" --version &>/dev/null; then
    ELECTRON_INSTALLED=1
    ok "Electron восстановлен и прошёл smoke-проверку."
  else
    err "Electron установлен некорректно: отсутствует path.txt или бинарник не запускается."
    exit 1
  fi
fi

# Если keytar не собрался (нативный модуль) — НЕ критично, лаунчер использует fallback
if [[ -d node_modules/keytar ]]; then
  if ! node -e "require('keytar')" 2>/dev/null; then
    warn "keytar не собрался (нативный модуль). Лаунчер продолжит работу,"
    warn "токены будут храниться в зашифрованном файле (fallback)."
    warn "Для keyring интеграции: sudo pacman -S libsecret gnome-keyring"
  fi
fi

# ─── 5. Создание структуры ~/.minecraft ─────────────────────────────────────
title "Подготовка каталогов Minecraft"

MC_HOME="${HOME}/.minecraft"
for sub in versions mods modpacks shaderpacks resourcepacks libraries assets/objects assets/indexes logs; do
  mkdir -p "${MC_HOME}/${sub}"
done
ok "Каталоги готовы: ${MC_HOME}"

# ─── 6. Проверка Java ───────────────────────────────────────────────────────
title "Проверка Java"

if command -v java &>/dev/null; then
  JAVA_VER=$(java -version 2>&1 | head -1 | awk -F\" '{print $2}')
  ok "Java: ${JAVA_VER}"
else
  warn "Java не найдена в PATH. Лаунчер сможет скачать её автоматически"
  warn "через Настройки → Java → Скачать Java 17/21."
fi

# ─── 7. Запуск лаунчера ─────────────────────────────────────────────────────
title "Запуск Nexus Launcher"

if [[ "$MODE" == "--dist" ]]; then
  log "Сборка дистрибут��вов (AppImage / DEB / RPM)…"
  log "Это может занять 5–10 минут."
  npm run dist:all || {
    err "Сборка не удалась. Убедитесь, что установлен binutils и tar."
    exit 1
  }
  ok "Готово! Проверьте каталог: ${SCRIPT_DIR}/dist/"
  ls -la dist/ 2>/dev/null || true
  exit 0
fi

# Передаём переменные окружения для Wayland/X11
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
export ELECTRON_ENABLE_LOGGING=0

# Определяем тип сессии
if [[ -n "$WAYLAND_DISPLAY" ]]; then
  log "Сессия: Wayland"
  export ELECTRON_OZONE_PLATFORM_HINT=auto
else
  log "Сессия: X11"
fi

log "Запускаю electron…"
log "Для остановки: Ctrl+C"
echo ""

if [[ -n "${CF_API_KEY:-}" ]]; then
  MASKED_CF_KEY="${CF_API_KEY:0:4}…${CF_API_KEY: -4}"
  ok "CurseForge API key обнаружен: ${MASKED_CF_KEY}"
else
  warn "CurseForge API key не найден. Если нужен CurseForge, создайте файл .env рядом со start.sh: CF_API_KEY=ваш_ключ"
fi

# Нормализуем path.txt без перевода строки для совместимости с Electron CLI.
printf '%s' 'electron' > "$ELECTRON_PATH_FILE"

# Запускаем проверенный бинарник напрямую. Это не зависит от npm shim и path.txt,
# поэтому работает и в каталогах с кириллицей, и после ручной установки Electron.
if [[ "$MODE" == "--dev" ]]; then
  exec "$ELECTRON_BIN" . --enable-logging
else
  exec "$ELECTRON_BIN" .
fi
