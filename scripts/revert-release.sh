#!/bin/bash
set -e

# Revierte un release en qa o main creando una rama con la convención correcta.
#
# Uso:
#   ./scripts/revert-release.sh <commit-merge> [descripcion]
#
# Ejemplos:
#   ./scripts/revert-release.sh abc1234
#   ./scripts/revert-release.sh abc1234 release-qa-2026-03-25
#
# El commit a revertir es el merge commit del release (HEAD de la rama destino
# justo después del merge). Puedes obtenerlo con:
#   git log origin/qa --oneline | head -5

COMMIT_TO_REVERT="${1:-}"
DESCRIPTION="${2:-}"

# ─── Validaciones ────────────────────────────────────────────────────────────

if [[ -z "$COMMIT_TO_REVERT" ]]; then
  echo ""
  echo "❌ Falta el commit a revertir."
  echo ""
  echo "Uso: ./scripts/revert-release.sh <commit-merge> [descripcion]"
  echo ""
  echo "Para obtener el commit del último release en qa:"
  echo "  git log origin/qa --oneline | head -5"
  echo ""
  exit 1
fi

if ! git cat-file -e "${COMMIT_TO_REVERT}^{commit}" 2>/dev/null; then
  echo "❌ El commit '${COMMIT_TO_REVERT}' no existe o no está disponible localmente."
  echo "   Ejecuta: git fetch --all"
  exit 1
fi

# ─── Nombre de rama ──────────────────────────────────────────────────────────

DATE=$(date -u +%Y-%m-%d)

if [[ -z "$DESCRIPTION" ]]; then
  BRANCH_NAME="revert/release-qa-${DATE}"
else
  # Normalizar descripcion: minúsculas, espacios a guiones
  DESCRIPTION_CLEAN=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  BRANCH_NAME="revert/${DESCRIPTION_CLEAN}"
fi

# Si la rama ya existe, agregar timestamp para evitar conflicto
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}" 2>/dev/null; then
  TIMESTAMP=$(date -u +%H%M)
  BRANCH_NAME="${BRANCH_NAME}-${TIMESTAMP}"
fi

# ─── Leer affected.txt del commit a revertir como fallback ───────────────────

AFFECTED_ORIGINAL=$(git show "${COMMIT_TO_REVERT}:affected.txt" 2>/dev/null | tr -s ' \n' ' ' | xargs || echo "")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "↩️  Preparando revert"
echo "   Commit:   ${COMMIT_TO_REVERT}"
echo "   Rama:     ${BRANCH_NAME}"
if [[ -n "$AFFECTED_ORIGINAL" ]]; then
  echo "   Affected: ${AFFECTED_ORIGINAL}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Crear rama y revertir ───────────────────────────────────────────────────

git checkout -b "$BRANCH_NAME"
echo "✅ Rama '$BRANCH_NAME' creada"

git revert --no-commit "$COMMIT_TO_REVERT"
echo "✅ Cambios del commit ${COMMIT_TO_REVERT} revertidos (sin commit aún)"

# ─── Restaurar affected.txt ──────────────────────────────────────────────────
# El git revert resetea affected.txt al estado previo al release.
# Lo restauramos con los proyectos del release revertido para que
# CodeBuild sepa qué microservicios redesplegar.
# El hook affected.sh recalculará esto al commitear — esto es un fallback.

if [[ -n "$AFFECTED_ORIGINAL" ]]; then
  echo "$AFFECTED_ORIGINAL" > affected.txt
  git add affected.txt
  echo "✅ affected.txt restaurado con proyectos del release revertido"
fi

# ─── Instrucciones finales ───────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Revisa los cambios con: git diff --cached"
echo ""
echo "Cuando estés listo, haz commit:"
echo "  git commit -m \"revert: <descripcion del release revertido>\""
echo ""
echo "El hook pre-commit recalculará affected.txt automáticamente."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
