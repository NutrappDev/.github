#!/usr/bin/env bash
# deploy-pr-checks.sh
#
# Despliega en todos los repos activos de la org:
#   1. .github/workflows/pr-checks.yml  — auto-tag de releases y reverts
#   2. scripts/revert-release.sh        — script de revert de emergencia
#
# Es idempotente: si el archivo ya existe y es idéntico, lo omite.
#
# Requisitos:
#   - gh CLI autenticado con scope: repo
#   - jq instalado
#
# Uso:
#   chmod +x scripts/deploy-pr-checks.sh
#   ./scripts/deploy-pr-checks.sh
#
# Para procesar solo un repo:
#   ./scripts/deploy-pr-checks.sh fruto-web-nutra-co
#
# Para forzar actualización aunque el contenido sea igual:
#   ./scripts/deploy-pr-checks.sh --force
#   ./scripts/deploy-pr-checks.sh fruto-web-nutra-co --force

set -euo pipefail
export MSYS_NO_PATHCONV=1

ORG="NutrappDev"
TEMPLATE_REPO="NutrappDev/.github"

# Workflow de auto-tag (se despliega en qa y main)
WORKFLOW_TEMPLATE_PATH=".github/workflows/_example-caller.yml"
WORKFLOW_TARGET_PATH=".github/workflows/pr-checks.yml"
WORKFLOW_BRANCHES=("qa" "main")
WORKFLOW_COMMIT_MSG="chore: agregar pr-checks para auto-tag de releases [skip ci]"
WORKFLOW_COMMIT_MSG_UPDATE="chore: actualizar pr-checks (auto-tag de releases y reverts) [skip ci]"

# Script de revert (se despliega en develop)
SCRIPT_TEMPLATE_PATH="scripts/revert-release.sh"
SCRIPT_TARGET_PATH="scripts/revert-release.sh"
SCRIPT_BRANCHES=("develop")
SCRIPT_COMMIT_MSG="chore: agregar script revert-release para manejo de reverts de emergencia [skip ci]"
SCRIPT_COMMIT_MSG_UPDATE="chore: actualizar revert-release.sh [skip ci]"

# ─── Colores ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'
GRAY='\033[0;90m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
skip() { echo -e "${GRAY}─  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
info() { echo -e "${BLUE}   $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }

# ─── Parsear argumentos ───────────────────────────────────────────────────────
TARGET_REPO=""
FORCE=false

for ARG in "$@"; do
  case "$ARG" in
    --force) FORCE=true ;;
    *)       TARGET_REPO="$ARG" ;;
  esac
done

# ─── Verificar dependencias ───────────────────────────────────────────────────
command -v gh  > /dev/null 2>&1 || { echo -e "${RED}❌ gh CLI no encontrado${NC}"; exit 1; }
command -v jq  > /dev/null 2>&1 || { echo -e "${RED}❌ jq no encontrado${NC}"; exit 1; }
gh auth status > /dev/null 2>&1 || { echo -e "${RED}❌ No autenticado. Ejecutar: gh auth login${NC}"; exit 1; }

# ─── Cargar templates ─────────────────────────────────────────────────────────
echo ""
echo "Leyendo templates desde ${TEMPLATE_REPO}..."

WORKFLOW_CONTENT=$(gh api "repos/${TEMPLATE_REPO}/contents/${WORKFLOW_TEMPLATE_PATH}" --jq '.content' 2>/dev/null) || {
  err "No se pudo leer el template de workflow: ${WORKFLOW_TEMPLATE_PATH}"
  exit 1
}
WORKFLOW_CONTENT=$(echo "$WORKFLOW_CONTENT" | tr -d '\n')

SCRIPT_CONTENT=$(gh api "repos/${TEMPLATE_REPO}/contents/${SCRIPT_TEMPLATE_PATH}" --jq '.content' 2>/dev/null) || {
  err "No se pudo leer el template del script: ${SCRIPT_TEMPLATE_PATH}"
  exit 1
}
SCRIPT_CONTENT=$(echo "$SCRIPT_CONTENT" | tr -d '\n')

echo ""
echo "Org:      ${ORG}"
echo "Workflow: ${WORKFLOW_TARGET_PATH} → ramas: ${WORKFLOW_BRANCHES[*]}"
echo "Script:   ${SCRIPT_TARGET_PATH}   → ramas: ${SCRIPT_BRANCHES[*]}"
[ "$FORCE" = true ] && warn "Modo --force: se sobreescribirá aunque el contenido sea igual"
echo "────────────────────────────────────────────────────────────────"

# ─── Obtener lista de repos ───────────────────────────────────────────────────
if [ -n "$TARGET_REPO" ]; then
  REPOS=("$TARGET_REPO")
else
  echo "Obteniendo repos de la org..."
  REPOS=()
  PAGE=1
  while true; do
    BATCH=$(gh api "orgs/${ORG}/repos?type=all&per_page=100&page=${PAGE}" \
      --jq '.[] | select(.archived == false and .fork == false) | .name' 2>/dev/null || true)
    [ -z "$BATCH" ] && break
    while IFS= read -r REPO; do
      [ "$REPO" = ".github" ] && continue
      REPOS+=("$REPO")
    done <<< "$BATCH"
    PAGE=$((PAGE + 1))
  done
  echo "Repos encontrados: ${#REPOS[@]}"
fi

# ─── Contadores globales ──────────────────────────────────────────────────────
CREATED=0
UPDATED=0
SKIPPED=0
ERRORS=0

# ─── Función: desplegar un archivo en una rama ────────────────────────────────
deploy_file() {
  local FULL_REPO="$1"
  local BRANCH="$2"
  local TARGET_PATH="$3"
  local CONTENT="$4"
  local COMMIT_MSG_NEW="$5"
  local COMMIT_MSG_UPD="$6"

  BRANCH_EXISTS=$(gh api "repos/${FULL_REPO}/branches/${BRANCH}" 2>/dev/null | jq -r '.name // empty' || true)
  if [ -z "$BRANCH_EXISTS" ]; then
    printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${GRAY}rama no existe — omitiendo${NC}")"
    return
  fi

  EXISTING=$(gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}?ref=${BRANCH}" 2>/dev/null || true)

  if [ -n "$EXISTING" ]; then
    EXISTING_SHA=$(echo "$EXISTING" | jq -r '.sha')
    EXISTING_CONTENT=$(echo "$EXISTING" | jq -r '.content' | tr -d '\n')

    if [ "$EXISTING_CONTENT" = "$CONTENT" ] && [ "$FORCE" = false ]; then
      printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${GRAY}─  sin cambios${NC}")"
      SKIPPED=$((SKIPPED + 1))
      return
    fi

    gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}" \
      -X PUT \
      -f message="$COMMIT_MSG_UPD" \
      -f content="$CONTENT" \
      -f sha="$EXISTING_SHA" \
      -f branch="$BRANCH" > /dev/null 2>&1 && {
      printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${GREEN}✅ actualizado${NC}")"
      UPDATED=$((UPDATED + 1))
    } || {
      printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${RED}❌ error al actualizar${NC}")"
      ERRORS=$((ERRORS + 1))
    }
  else
    gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}" \
      -X PUT \
      -f message="$COMMIT_MSG_NEW" \
      -f content="$CONTENT" \
      -f branch="$BRANCH" > /dev/null 2>&1 && {
      printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${GREEN}✅ creado${NC}")"
      CREATED=$((CREATED + 1))
    } || {
      printf "  %-10s %-40s %s\n" "[$BRANCH]" "$TARGET_PATH" "$(echo -e "${RED}❌ error al crear${NC}")"
      ERRORS=$((ERRORS + 1))
    }
  fi
}

# ─── Procesar repos ───────────────────────────────────────────────────────────
echo ""
for REPO in "${REPOS[@]}"; do
  FULL_REPO="${ORG}/${REPO}"
  echo "  ${REPO}"

  for BRANCH in "${WORKFLOW_BRANCHES[@]}"; do
    deploy_file "$FULL_REPO" "$BRANCH" \
      "$WORKFLOW_TARGET_PATH" "$WORKFLOW_CONTENT" \
      "$WORKFLOW_COMMIT_MSG" "$WORKFLOW_COMMIT_MSG_UPDATE"
  done

  for BRANCH in "${SCRIPT_BRANCHES[@]}"; do
    deploy_file "$FULL_REPO" "$BRANCH" \
      "$SCRIPT_TARGET_PATH" "$SCRIPT_CONTENT" \
      "$SCRIPT_COMMIT_MSG" "$SCRIPT_COMMIT_MSG_UPDATE"
  done

  echo ""
done

# ─── Resumen ──────────────────────────────────────────────────────────────────
echo "────────────────────────────────────────────────────────────────"
echo -e "  ${GREEN}Creados:      ${CREATED}${NC}"
echo -e "  ${YELLOW}Actualizados: ${UPDATED}${NC}"
echo -e "  ${GRAY}Sin cambios:  ${SKIPPED}${NC}"
[ "$ERRORS" -gt 0 ] && echo -e "  ${RED}Errores:      ${ERRORS}${NC}"
echo ""
echo "Auto-tag activado en releases y reverts que mergeen a qa o main."
echo "Script revert-release.sh disponible en develop de todos los repos."
echo ""
