# Guía de contribución — NutrappDev

Si es tu primer PR en la organización, lee esta guía completa antes de empezar.

---

## Flujo de ramas

```
main
 ↑ release/prod-YYYY-MM-DD   (cherry-pick desde qa)
 ↑ hotfix/TICKET-descripcion

qa
 ↑ release/qa-YYYY-MM-DD     (cherry-pick desde develop)

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
| Fuentes permitidas | Solo `release/qa-YYYY-MM-DD` |
| Merge | **Rebase** |
| Proceso | Cherry-pick desde develop → rama `release/qa-YYYY-MM-DD` → PR a qa |
| Commit directo | ❌ Nunca |

### `main` — producción

| Regla | Detalle |
|-------|---------|
| Fuentes permitidas | `release/prod-YYYY-MM-DD` o `hotfix/TICKET-descripcion` |
| Merge | **Rebase** |
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
```

- El ticket Jira va en **MAYÚSCULAS**
- La descripción en **minúsculas con guiones**
- Las ramas `release/` usan fecha, no ticket (agrupan varios)

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

Tipos válidos: `feat` `fix` `refactor` `docs` `chore` `build` `test` `release` `hotfix` `merge`

### Títulos de PR

Mismo formato que los commits. En PRs de release no se requiere ticket (agrupan varios):

```
feat(auth): agregar login con Google SUP-123
fix(api): corregir timeout en endpoint de usuarios SUP-456
release: qa-2025-01-15
release: prod-2025-01-20
```

---

## Validaciones automáticas

Cada PR a `develop`, `qa` o `main` ejecuta los siguientes checks en paralelo. Todos deben pasar para poder hacer merge. El bot comenta en el PR con el detalle de los errores.

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

Cada repo necesita el archivo `.github/workflows/pr-checks.yml`. Sin él, los checks quedan en estado "pending" permanentemente y bloquean el merge.

Copia el contenido de [`_example-caller.yml`](.github/workflows/_example-caller.yml) en `.github/workflows/pr-checks.yml` de tu repo. No necesitas cambiar nada.

**Si los checks siguen en "pending" después de agregarlo:**
1. Verifica que la ruta sea exactamente `.github/workflows/pr-checks.yml`
2. Verifica que GitHub Actions esté habilitado: **Settings → Actions → General → Allow all actions**
3. Verifica que el PR apunte a `develop`, `qa` o `main` (otras ramas no disparan el workflow)

---

## Proceso de release a QA

1. Identificar los commits de `develop` a incluir (squash commits, del más antiguo al más reciente)
2. Crear rama desde qa: `git checkout -b release/qa-YYYY-MM-DD origin/qa`
3. Cherry-pick en orden cronológico: `git cherry-pick <sha>`
4. Resolver conflictos si los hay — verificar que no incluyas cambios de PRs que no deberían ir en este release
5. Push y PR: `gh pr create --base qa --title "release: qa-YYYY-MM-DD"`
6. 1 aprobación → merge con **"Rebase and merge"**
7. Crear tag anotado apuntando al HEAD de qa:
   ```bash
   git fetch origin qa
   git tag -a qa-YYYY-MM-DD origin/qa -m "Release qa-YYYY-MM-DD"
   git push origin qa-YYYY-MM-DD
   ```
---

## Proceso de promoción a producción

1. Verificar que los commits estén probados y aprobados en QA
2. Crear rama desde main: `git checkout -b release/prod-YYYY-MM-DD origin/main`
3. Cherry-pick desde qa en orden: `git cherry-pick <sha>`
4. Resolver conflictos si los hay
5. Push y PR: `gh pr create --base main --title "release: prod-YYYY-MM-DD"`
6. **2 aprobaciones** → merge con **"Rebase and merge"**
7. Crear tag anotado apuntando al HEAD de main:
   ```bash
   git fetch origin main
   git tag -a prod-YYYY-MM-DD origin/main -m "Release prod-YYYY-MM-DD"
   git push origin prod-YYYY-MM-DD
   ```

---

## Proceso de hotfix

1. Crear rama desde main: `git checkout -b hotfix/TICKET-descripcion origin/main`
2. Aplicar el fix
3. PR a `main` — el ticket Jira es obligatorio, se requieren 2 aprobaciones
4. **Backport obligatorio:** abrir también un PR a `develop` con el mismo fix (tipo `fix/`)

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
| `release` / `merge` | 5 000 | 350 |

Superarlos muestra una advertencia pero no bloquea el merge por defecto.
