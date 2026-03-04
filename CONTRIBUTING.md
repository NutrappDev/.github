# Guía de contribución — NutrappDev

## Flujo de ramas

```md
main
 ↑ PR desde release/prod-YYYY-MM-DD  (cherry-pick desde qa)
 ↑ PR desde hotfix/TICKET-JIRA-descripcion

qa
 ↑ PR desde release/qa-YYYY-MM-DD    (cherry-pick desde develop)

develop
 ↑ PR desde feat/TICKET-JIRA-descripcion
 ↑ PR desde fix/TICKET-JIRA-descripcion
 ↑ PR desde refactor/TICKET-JIRA-descripcion
 ↑ PR desde chore/TICKET-JIRA-descripcion
 ↑ PR desde docs/TICKET-JIRA-descripcion
 ↑ PR desde build/TICKET-JIRA-descripcion
 ↑ PR desde test/TICKET-JIRA-descripcion
```

---

## Reglas por rama destino

### `develop` — integración continua

| Regla              | Detalle                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Fuentes permitidas | `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `build/`, `test/` |
| Merge              | **Squash** — cada PR queda como un solo commit limpio              |
| Jira ticket        | **Obligatorio** en rama, commit y título del PR                    |
| Commit directo     | ❌ Nunca                                                            |

### `qa` — ambiente de pruebas

| Regla              | Detalle                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| Fuentes permitidas | Solo `release/qa-YYYY-MM-DD`                                           |
| Merge              | **Rebase merge** — mantiene historial lineal y trazabilidad de cherry-picks |
| Jira ticket        | No requerido en el título del PR (la rama agrupa múltiples)            |
| Commit directo     | ❌ Nunca                                                                |
| Proceso            | Cherry-pick desde `develop` → rama `release/qa-YYYY-MM-DD` → PR a `qa` |

### `main` — producción

| Regla              | Detalle                                                               |
| ------------------ | --------------------------------------------------------------------- |
| Fuentes permitidas | `release/prod-YYYY-MM-DD` o `hotfix/TICKET-JIRA-descripcion`          |
| Merge              | **Rebase merge** — mantiene historial lineal y trazabilidad de cherry-picks |
| Jira ticket        | No requerido en el título del PR de release (sí en hotfix)            |
| Commit directo     | ❌ Nunca                                                               |
| Proceso            | Cherry-pick desde `qa` → rama `release/prod-YYYY-MM-DD` → PR a `main` |

---

## Naming conventions

### Ramas

```md
feat/TICKET-123-descripcion-corta
fix/TICKET-456-descripcion-corta
refactor/TICKET-789-descripcion-corta
chore/TICKET-101-descripcion-corta
docs/TICKET-102-descripcion-corta
build/TICKET-103-descripcion-corta
test/TICKET-104-descripcion-corta
release/qa-2025-01-15
release/prod-2025-01-20
hotfix/TICKET-999-descripcion-corta
```

Reglas:

- El ticket Jira va en **MAYÚSCULAS**
- La descripción en **minúsculas con guiones**
- Las ramas `release/` usan fecha, no ticket (agrupan varios)

### Commits (Conventional Commits)

```md
tipo(scope): descripción breve TICKET-JIRA
```

Ejemplos:

```md
feat(auth): agregar login con Google NUTRI-123
fix(api): corregir timeout en endpoint de usuarios NUTRI-456
chore(deps): actualizar dependencias de seguridad NUTRI-789
```

Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `chore`, `build`, `test`, `release`, `hotfix`, `merge`

### Títulos de PR

Mismo formato que los commits:

```
feat(auth): agregar login con Google NUTRI-123
fix(api): corregir timeout en endpoint de usuarios NUTRI-456
release(qa): promoción a QA 2025-01-15
```

---

## Proceso de release a QA

1. Identificar los commits de `develop` a incluir (merge commits, del más antiguo al más reciente)
2. Crear rama: `git checkout -b release/qa-YYYY-MM-DD qa`
3. Cherry-pick de cada commit en orden cronológico:
   - Merge commit: `git cherry-pick -m 1 <sha>`
   - Commit directo: `git cherry-pick <sha>`
4. Resolver conflictos con cuidado — antes de usar `--theirs`, verificar que el conflicto no tenga contaminación de contexto (líneas de otro PR pendiente que no debería estar en QA)
5. Crear commit vacío de resumen: `git commit --allow-empty -m "release: deploy PRs a QA - YYYY-MM-DD"`
6. Abrir PR: `gh pr create --base qa --title "release: deploy PRs a QA - YYYY-MM-DD"`
7. Obtener aprobación (1 revisor)
8. Merge usando **"Rebase and merge"** (único método permitido por ruleset)
9. Crear tag anotado apuntando al HEAD de `qa`: `git tag -a qa-YYYY-MM-DD`

## Proceso de promoción a producción

1. Verificar que los commits estén probados y aprobados en QA
2. Crear rama: `git checkout -b release/prod-YYYY-MM-DD main`
3. Cherry-pick de los commits desde `qa` (los commits en QA tienen 1 solo padre — nunca usar `-m 1`)
4. Resolver conflictos con cuidado (ver nota en proceso a QA)
5. Crear commit vacío de resumen: `git commit --allow-empty -m "release: deploy PRs a producción - YYYY-MM-DD"`
6. Abrir PR: `gh pr create --base main --title "release: deploy PRs a producción - YYYY-MM-DD"`
7. Obtener 2 aprobaciones
8. Merge usando **"Rebase and merge"** (único método permitido por ruleset)
9. Crear tag anotado apuntando al HEAD de `main`: `git tag -a prod-YYYY-MM-DD`

## Proceso de hotfix

1. Crear rama desde `main`: `git checkout -b hotfix/TICKET-999-descripcion main`
2. Aplicar el fix
3. Abrir PR a `main` (merge sin squash)
4. **Backport obligatorio:** abrir también un PR a `develop` con el mismo fix (tipo `fix/`)

---

## Nomenclatura de repositorios

Patrón: `[fase]-[tipo]-[proyecto]`

| Fase | Descripción | SLA |
| ---- | ----------- | --- |
| `raiz` | Backend, Core, SSO, Bases de datos, Infra | Crítica |
| `tronco` | APIs de integración (ERP, CRM, IA) | Alta |
| `ramas` | Frontends internos (Admin, Intranet) | Media |
| `fruto` | Frontends de conversión (e-commerce, B2B) | Crítica |

Ejemplos: `fruto-app-alivia`, `raiz-monorepo-core`, `tronco-api-mensajeria-automatizacion`

Reglas:
- No incluir la tecnología en el nombre (puede cambiar)
- Topics obligatorios en GitHub: `fase-[raiz|tronco|ramas|fruto]`, `team-[roble|sakura|manglar]`

---

## Integración con el dashboard

El dashboard se regenera automáticamente cada día a las 06:00 UTC. Para actualizaciones en tiempo real tras un deploy, agrega este paso al final del workflow de despliegue de tu repo:

```yaml
- name: Actualizar dashboard
  if: success()
  run: |
    gh api repos/NutrappDev/.github/dispatches \
      -f event_type=deployment-completed \
      -f "client_payload[repo]=${{ github.repository }}"
  env:
    GH_TOKEN: ${{ secrets.ORG_READ_TOKEN }}
```

El secret `ORG_READ_TOKEN` ya existe a nivel de organización. Solo necesita el scope `repo` para poder despachar el evento.

---

## Tamaños máximos de PR

Definidos en [`.github/pr-config.json`](.github/pr-config.json).

| Tipo                | Máx. líneas | Máx. archivos |
| ------------------- | ----------- | ------------- |
| `feat`              | 2 000       | 60            |
| `fix` / `hotfix`    | 200         | 10            |
| `refactor`          | 6 500       | 150           |
| `docs`              | 5 000       | 16            |
| `chore`             | 250         | 16            |
| `build`             | 250         | 15            |
| `test`              | 1 000       | 50            |
| `release` / `merge` | 5 000       | 350           |
