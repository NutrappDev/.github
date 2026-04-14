# Guía de contribución — NutrappDev

Si es tu primer PR en la organización, lee esta guía completa antes de empezar.

---

## Flujo de ramas

```
main
 ↑ release/prod-YYYY-MM-DD    (cherry-pick desde qa)
 ↑ hotfix/TICKET-descripcion
 ↑ revert/release-prod-YYYY-MM-DD

qa
 ↑ release/qa-YYYY-MM-DD      (cherry-pick desde develop)
 ↑ revert/release-qa-YYYY-MM-DD

develop
 ↑ feat/TICKET-descripcion
 ↑ fix / refactor / chore / docs / build / test
```

**Regla fundamental:** ningún commit va directo a `develop`, `qa` ni `main`. Todo llega via PR.

---

## Reglas por rama destino

### `develop` — integración continua

| Regla | Detalle |
|-------|---------|
| Fuentes permitidas | `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `build/`, `test/` |
| Merge | **Squash** — cada PR queda como un único commit en develop |
| Jira ticket | Obligatorio en rama, en cada commit y en el título del PR |
| Commit directo | ❌ Nunca |

### `qa` — pruebas

| Regla | Detalle |
|-------|---------|
| Fuentes permitidas | `release/qa-YYYY-MM-DD`, `revert/release-qa-YYYY-MM-DD` |
| Merge | **Merge commit** (sin squash, sin rebase) |
| Proceso release | Cherry-pick desde develop → rama `release/qa-YYYY-MM-DD` → PR a qa |
| Proceso revert | `npm run revert-release -- <merge-commit>` → PR a qa |
| Commit directo | ❌ Nunca |

### `main` — producción

| Regla | Detalle |
|-------|---------|
| Fuentes permitidas | `release/prod-YYYY-MM-DD`, `hotfix/TICKET-descripcion`, `revert/release-prod-YYYY-MM-DD` |
| Merge | **Merge commit** (sin squash, sin rebase) |
| Proceso | Cherry-pick desde qa → rama `release/prod-YYYY-MM-DD` → PR a main |
| Aprobaciones | 2 requeridas |
| Commit directo | ❌ Nunca |

---

## Naming conventions

### Ramas

```
feat/SUP-123-descripcion-corta
fix/SUP-456-descripcion-corta
refactor/SUP-789-descripcion-corta
chore/SUP-101-descripcion-corta
docs/SUP-102-descripcion-corta
build/SUP-103-descripcion-corta
test/SUP-104-descripcion-corta
release/qa-2025-01-15
release/prod-2025-01-20
hotfix/SUP-999-descripcion-corta
revert/release-qa-2025-01-15
revert/release-prod-2025-01-20
```

- El ticket Jira va en **MAYÚSCULAS**
- La descripción en **minúsculas con guiones**
- Las ramas `release/` y `revert/` usan fecha, no ticket (agrupan varios)
- Las ramas `revert/` se crean con `npm run revert-release`, no manualmente

### Commits — Conventional Commits

```
tipo(scope): descripción breve TICKET-JIRA
```

Ejemplos:

```
feat(auth): agregar login con Google SUP-123
fix(api): corregir timeout en endpoint de usuarios SUP-456
chore(deps): actualizar dependencias de seguridad SUP-789
```

Tipos válidos: `feat` `fix` `refactor` `docs` `chore` `build` `test` `release` `hotfix` `merge` `revert`

### Títulos de PR

Mismo formato que los commits. En PRs de release y revert no se requiere ticket (agrupan varios):

```
feat(auth): agregar login con Google SUP-123
fix(api): corregir timeout en endpoint de usuarios SUP-456
release: qa-2025-01-15
release: prod-2025-01-20
revert: release qa-2025-01-15
```

---

## Validaciones automáticas

Cada PR a `develop`, `qa` o `main` ejecuta los siguientes checks en paralelo vía los rulesets de la org — **no requieren ningún archivo en tu repo**. Todos deben pasar para poder hacer merge. El bot comenta en el PR con el detalle de los errores.

### `validate / Validate PR`

Verifica en todo PR:
- Que la rama fuente esté permitida hacia ese destino
- Que el título tenga formato conventional commits
- Que el ticket Jira del título coincida con el de la rama
- Que el PR esté dentro de los límites de tamaño por tipo

### `security / Security & Quality Check`

Verifica en todo PR:
- Sin archivos `.env`, credentials ni claves privadas en el diff
- Sin secretos en el contenido del código (`API_KEY=`, `TOKEN=`, etc.)
- Sin binarios mayores a 5 MB
- Archivos de código dentro del límite de líneas configurado
- Sin `console.log` en código de producción
- Que el nombre del repo siga la nomenclatura de la organización

### `commitlint / Validate Commit Messages`

Solo en PRs a `develop`. Revisa **cada commit** del PR:
- Formato conventional commits
- Ticket Jira presente
- Ticket del commit coincide con el ticket de la rama

### `release-validate / Validate Release PR`

Solo en ramas `release/*`. Verifica antes del merge a qa o main:
- **Validación A:** No existen commits más recientes en develop que toquen los mismos archivos sin haber sido incluidos en este release (evita dependencias ocultas entre features)
- **Validación B:** Todos los archivos que este PR modifica ya existen en la rama destino (evita referencias a archivos que aún no fueron creados allí)

---

## Configurar tu repo

Los checks de validación (`validate`, `security`, `commitlint`, `release-validate`) se disparan automáticamente en todos los repos vía los rulesets de la org. No necesitas hacer nada para que aparezcan en tus PRs.

Lo único que requiere configuración adicional son dos archivos, que el script `scripts/deploy-pr-checks.sh` distribuye automáticamente a todos los repos:

| Archivo | Rama | Propósito |
|---------|------|-----------|
| `.github/workflows/pr-checks.yml` | `qa`, `main` | Auto-tag al mergear `release/*` o `revert/*` |
| `scripts/revert-release.sh` | `develop` | Script de revert de emergencia |

Para distribuir manualmente a un repo específico:

```bash
./scripts/deploy-pr-checks.sh nombre-del-repo
```

**Si los checks de validación no aparecen o el PR quedó bloqueado inesperadamente:**
1. Haz un push a tu rama — los checks se disparan automáticamente en el próximo evento del PR
2. Verifica que GitHub Actions esté habilitado: **Settings → Actions → General → Allow all actions**
3. Verifica que el PR apunte a `develop`, `qa` o `main` (otras ramas no disparan el workflow)

**Si el auto-tag no se crea al mergear un release o revert:**
1. Verifica que el archivo esté en `.github/workflows/pr-checks.yml` (ruta exacta)
2. Verifica que GitHub Actions esté habilitado en el repo
3. Verifica que el PR sea de una rama `release/*` o `revert/*` hacia `qa` o `main`

---

## Proceso de release a QA

1. Identificar los commits de `develop` a incluir (squash commits, del más antiguo al más reciente)
2. Crear rama desde qa: `git checkout -b release/qa-YYYY-MM-DD origin/qa`
3. Cherry-pick en orden cronológico: `git cherry-pick <sha>`
4. Resolver conflictos si los hay — verificar que no incluyas cambios de PRs que no deberían ir en este release
5. Push y PR: `gh pr create --base qa --title "release: qa-YYYY-MM-DD"`
6. 1 aprobación → merge con **"Create a merge commit"** — el merge commit actúa como marcador exacto del despliegue
7. El tag `qa-YYYY-MM-DD` se crea automáticamente al mergear

---

## Proceso de promoción a producción

1. Verificar que los commits estén probados y aprobados en QA
2. Crear rama desde main: `git checkout -b release/prod-YYYY-MM-DD origin/main`
3. Cherry-pick desde qa en orden: `git cherry-pick <sha>`
4. Resolver conflictos si los hay
5. Push y PR: `gh pr create --base main --title "release: prod-YYYY-MM-DD"`
6. **2 aprobaciones** → merge con **"Create a merge commit"** — el merge commit actúa como marcador exacto del despliegue
7. El tag `prod-YYYY-MM-DD` se crea automáticamente al mergear

---

## Proceso de revert de release

Usar cuando un release recién mergeado genera un error en `qa` o `main` y se necesita revertir de emergencia.

> **No usar el botón de revert de GitHub** — la rama que genera no sigue la convención y no actualiza `affected.txt` correctamente.

### Pasos

1. Obtener el merge commit del release a revertir:

   ```bash
   git fetch --all
   git log origin/qa --oneline | head -5
   ```

2. Ejecutar el script:

   ```bash
   npm run revert-release -- <merge-commit>
   # o con descripción explícita:
   npm run revert-release -- <merge-commit> release-qa-2025-01-15
   ```

3. Revisar y commitear:

   ```bash
   git diff --cached
   git commit -m "revert: release qa-YYYY-MM-DD"
   ```

4. Push y PR a `qa`:

   ```bash
   gh pr create --base qa --title "revert: release qa-YYYY-MM-DD"
   ```

5. Al mergear → tag `revert-qa-YYYY-MM-DD` se crea automáticamente.

### Por qué usar el script y no el botón de GitHub

| | Botón de GitHub | `revert-release.sh` |
|--|-----------------|---------------------|
| Nombre de rama | `revert-NNN-release/qa-...` (inválido) | `revert/release-qa-YYYY-MM-DD` |
| `affected.txt` | Queda con valor previo al release | Se restaura con los proyectos del release revertido |
| Tag automático | No se crea | `revert-qa-YYYY-MM-DD` |
| Validaciones org | Fallan | Pasan |

---

## Criterios de urgencia para hotfix

Un hotfix solo está justificado si se cumple **al menos uno** de los siguientes criterios objetivos:

| # | Criterio | Ejemplos |
|---|----------|---------|
| 1 | **Servicio caído** — funcionalidad crítica completamente inoperativa en producción | Login roto, API principal sin respuesta, app no carga |
| 2 | **Corrupción o pérdida de datos** — datos de usuarios o negocio en riesgo | Escrituras duplicadas, registros eliminados incorrectamente |
| 3 | **Vulnerabilidad de seguridad activa** — brecha explotable en producción | Credenciales expuestas, endpoint sin autenticación, XSS explotado |
| 4 | **Transacciones financieras fallando** — pagos, facturación o cobros no funcionan | Pasarela de pago caída, errores en checkout |
| 5 | **Incumplimiento legal o regulatorio** — riesgo jurídico inmediato | Datos personales expuestos (GDPR/Habeas Data), términos contractuales incumplidos |

**Requiere autorización previa** del Supervisor de Desarrollo antes de abrir la rama.

Bugs menores, mejoras o problemas de UX que no cumplan ninguno de estos criterios van al flujo normal: `feat/` o `fix/` → `develop` → release a qa → release a main.

---

## Proceso de hotfix

1. Crear rama desde main: `git checkout -b hotfix/TICKET-descripcion origin/main`
2. Aplicar el fix
3. PR a `main` — el ticket Jira es obligatorio, se requieren 2 aprobaciones
4. Merge con **"Create a merge commit"** — tag `prod-YYYY-MM-DD` se crea automáticamente
5. **Backport obligatorio:** abrir también un PR a `develop` con el mismo fix (tipo `fix/`) — merge Squash

---

## Nomenclatura de repositorios

Patrón: `[fase]-[tipo]-[proyecto]`

| Fase | Descripción | Criticidad |
|------|-------------|------------|
| `raiz` | Backend, Core, SSO, Bases de datos, Infra | Crítica |
| `tronco` | APIs de integración (ERP, CRM, IA) | Alta |
| `ramas` | Frontends internos (Admin, Intranet) | Media |
| `fruto` | Frontends de conversión (e-commerce, B2B) | Crítica |

Ejemplos: `fruto-app-alivia`, `raiz-monorepo-core`, `tronco-api-mensajeria`

Topics obligatorios en GitHub: `fase-[raiz|tronco|ramas|fruto]`, `team-[roble|sakura|manglar]`

No incluir la tecnología en el nombre del repo (puede cambiar con el tiempo).

---

## Integración con el dashboard

El [dashboard centralizado](https://nutrappdev.github.io/.github/) se regenera diariamente a las 06:00 UTC.

---

## Tamaños máximos de PR

Definidos en [`.github/pr-config.json`](.github/pr-config.json):

| Tipo | Máx. líneas | Máx. archivos |
|------|-------------|---------------|
| `feat` | 2 000 | 60 |
| `fix` / `hotfix` | 200 | 10 |
| `refactor` | 6 500 | 150 |
| `docs` | 5 000 | 16 |
| `chore` | 250 | 16 |
| `build` | 250 | 15 |
| `test` | 1 000 | 50 |
| `release` / `merge` / `revert` | 5 000 | 350 |

Superarlos muestra una advertencia pero no bloquea el merge por defecto.
