#!/usr/bin/env bash
# deploy-pr-checks.sh
#
# Despliega .github/workflows/pr-checks.yml en todos los repos activos de la org,
# en las ramas develop, qa y main (las tres ramas base que reciben PRs).
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
TEMPLATE_PATH=".github/workflows/_example-caller.yml"
TARGET_PATH=".github/workflows/pr-checks.yml"
# Solo qa y main — pr-checks.yml solo contiene auto-tag, que se activa en PRs hacia qa/main.
# develop no lo necesita: los checks de validación se disparan via rulesets org-level.
TARGET_BRANCHES=("qa" "main")
COMMIT_MSG="chore: agregar pr-checks para auto-tag de releases [skip ci]"
COMMIT_MSG_UPDATE="chore: actualizar pr-checks (auto-tag de releases) [skip ci]"

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

# ─── Obtener contenido del template (base64) ──────────────────────────────────
echo ""
echo "Leyendo template desde ${TEMPLATE_REPO}..."
TEMPLATE_CONTENT=$(gh api "repos/${TEMPLATE_REPO}/contents/${TEMPLATE_PATH}" --jq '.content' 2>/dev/null) || {
  echo -e "${RED}❌ No se pudo leer el template. Verificar que existe: ${TEMPLATE_PATH}${NC}"
  exit 1
}
TEMPLATE_CONTENT=$(echo "$TEMPLATE_CONTENT" | tr -d '\n')
TEMPLATE_SHA=$(gh api "repos/${TEMPLATE_REPO}/contents/${TEMPLATE_PATH}" --jq '.sha' 2>/dev/null)

echo ""
echo "Org:     ${ORG}"
echo "Template: ${TEMPLATE_PATH} (sha: ${TEMPLATE_SHA:0:7})"
echo "Destino:  ${TARGET_PATH} en ramas: ${TARGET_BRANCHES[*]}"
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

# ─── Función: desplegar en una rama específica ────────────────────────────────
deploy_to_branch() {
  local FULL_REPO="$1"
  local BRANCH="$2"

  # Verificar que la rama existe
  BRANCH_EXISTS=$(gh api "repos/${FULL_REPO}/branches/${BRANCH}" 2>/dev/null | jq -r '.name // empty' || true)
  if [ -z "$BRANCH_EXISTS" ]; then
    printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${GRAY}rama no existe — omitiendo${NC}")"
    return
  fi

  # Verificar si el archivo ya existe en esa rama
  EXISTING=$(gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}?ref=${BRANCH}" 2>/dev/null || true)

  if [ -n "$EXISTING" ]; then
    EXISTING_SHA=$(echo "$EXISTING" | jq -r '.sha')
    EXISTING_CONTENT=$(echo "$EXISTING" | jq -r '.content' | tr -d '\n')

    if [ "$EXISTING_CONTENT" = "$TEMPLATE_CONTENT" ] && [ "$FORCE" = false ]; then
      printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${GRAY}─  sin cambios${NC}")"
      SKIPPED=$((SKIPPED + 1))
      return
    fi

    RESULT=$(gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}" \
      -X PUT \
      -f message="$COMMIT_MSG_UPDATE" \
      -f content="$TEMPLATE_CONTENT" \
      -f sha="$EXISTING_SHA" \
      -f branch="$BRANCH" 2>&1) && {
      printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${GREEN}✅ actualizado${NC}")"
      UPDATED=$((UPDATED + 1))
    } || {
      printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${RED}❌ error al actualizar${NC}")"
      info "$RESULT"
      ERRORS=$((ERRORS + 1))
    }
  else
    RESULT=$(gh api "repos/${FULL_REPO}/contents/${TARGET_PATH}" \
      -X PUT \
      -f message="$COMMIT_MSG" \
      -f content="$TEMPLATE_CONTENT" \
      -f branch="$BRANCH" 2>&1) && {
      printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${GREEN}✅ creado${NC}")"
      CREATED=$((CREATED + 1))
    } || {
      printf "  %-10s %s\n" "[$BRANCH]" "$(echo -e "${RED}❌ error al crear${NC}")"
      info "$RESULT"
      ERRORS=$((ERRORS + 1))
    }
  fi
}

# ─── Procesar repos ───────────────────────────────────────────────────────────
echo ""
for REPO in "${REPOS[@]}"; do
  FULL_REPO="${ORG}/${REPO}"
  echo "  ${REPO}"

  for BRANCH in "${TARGET_BRANCHES[@]}"; do
    deploy_to_branch "$FULL_REPO" "$BRANCH"
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
echo "El auto-tag se activará al mergear el próximo PR de release/* hacia qa o main."
echo "Los checks de validación (validate, security, commitlint, release-validate)"
echo "se disparan automáticamente via rulesets — no requieren este archivo."
echo ""
