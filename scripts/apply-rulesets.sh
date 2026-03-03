#!/usr/bin/env bash
# apply-rulesets.sh
#
# Crea o actualiza los Organization Rulesets de NutrappDev.
# Es idempotente: si el ruleset ya existe lo actualiza, si no lo crea.
#
# Requisitos:
#   - gh CLI autenticado con un token que tenga scope: admin:org
#   - jq instalado
#
# Uso:
#   chmod +x scripts/apply-rulesets.sh
#   gh auth login          # si aún no está autenticado
#   ./scripts/apply-rulesets.sh
#
# Para aplicar solo un ruleset:
#   ./scripts/apply-rulesets.sh develop

set -euo pipefail

# Evitar que Git Bash en Windows reescriba paths de la API como rutas de filesystem
export MSYS_NO_PATHCONV=1

ORG="NutrappDev"
RULESETS_DIR=".github/rulesets"
SCOPE="${1:-all}"  # "all" | "develop" | "qa" | "main"

# ─── Colores para output ───────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; exit 1; }

# ─── Verificar dependencias ────────────────────────────────────────────────────
command -v gh  > /dev/null 2>&1 || err "gh CLI no encontrado. Instalar desde https://cli.github.com"
command -v jq  > /dev/null 2>&1 || err "jq no encontrado. Instalar con: brew install jq / apt install jq"

# ─── Verificar autenticación ──────────────────────────────────────────────────
gh auth status > /dev/null 2>&1 || err "No autenticado en gh CLI. Ejecutar: gh auth login"

echo ""
echo "Aplicando rulesets en la organización: ${ORG}"
echo "────────────────────────────────────────────────"

# ─── Función principal ─────────────────────────────────────────────────────────
apply_ruleset() {
  local JSON_FILE="$1"
  local RULESET_NAME

  # Leer nombre del JSON (ignorar _comment)
  RULESET_NAME=$(jq -r '.name' "$JSON_FILE")

  echo ""
  echo "Procesando: \"${RULESET_NAME}\""

  # Limpiar _comment fields antes de enviar (la API no los acepta)
  CLEAN_JSON=$(jq 'del(.. | ._comment?)' "$JSON_FILE")

  # Buscar si ya existe un ruleset con ese nombre
  EXISTING_ID=$(gh api "/orgs/${ORG}/rulesets" \
    --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" 2>/dev/null || true)

  if [ -n "$EXISTING_ID" ]; then
    warn "Ya existe (id: ${EXISTING_ID}) — actualizando..."
    echo "$CLEAN_JSON" | gh api -X PUT "/orgs/${ORG}/rulesets/${EXISTING_ID}" \
      --input - > /dev/null
    ok "Actualizado: \"${RULESET_NAME}\""
  else
    echo "  Creando nuevo ruleset..."
    echo "$CLEAN_JSON" | gh api -X POST "/orgs/${ORG}/rulesets" \
      --input - > /dev/null
    ok "Creado: \"${RULESET_NAME}\""
  fi
}

# ─── Aplicar según scope ───────────────────────────────────────────────────────
case "$SCOPE" in
  develop)
    apply_ruleset "${RULESETS_DIR}/protect-develop.json"
    ;;
  qa)
    apply_ruleset "${RULESETS_DIR}/protect-qa.json"
    ;;
  main)
    apply_ruleset "${RULESETS_DIR}/protect-main.json"
    ;;
  all)
    apply_ruleset "${RULESETS_DIR}/protect-develop.json"
    apply_ruleset "${RULESETS_DIR}/protect-qa.json"
    apply_ruleset "${RULESETS_DIR}/protect-main.json"
    ;;
  *)
    err "Scope inválido: '${SCOPE}'. Usar: all | develop | qa | main"
    ;;
esac

echo ""
echo "────────────────────────────────────────────────"
ok "Listo. Verificar en: https://github.com/organizations/${ORG}/settings/rules"
echo ""
echo "Notas:"
echo "  • Los rulesets aplican a TODOS los repos de la org automáticamente."
echo "  • Los status checks requeridos (validate, security, commitlint) solo"
echo "    bloquean si el repo tiene configurado el workflow pr-checks.yml."
echo "    Si un repo no lo tiene, la regla pasa como 'pending' sin bloquear."
echo "  • Los admins de la org pueden hacer bypass cuando sea necesario."
