#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Использование:"
  echo "  ./set-curseforge-key.sh 'ВАШ_CF_API_KEY'"
  echo
  echo "Важно: ключ с символами \$ вставляйте в одинарных кавычках."
  exit 1
fi

KEY="$1"
cat > "${SCRIPT_DIR}/.env" <<EOF
CF_API_KEY=${KEY}
EOF

chmod 600 "${SCRIPT_DIR}/.env" || true
echo "CF_API_KEY записан в ${SCRIPT_DIR}/.env"
