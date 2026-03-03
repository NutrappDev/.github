# Schema de repos.json

Generado por `.github/workflows/dashboard-generator.yml`. **No editar manualmente.**

## Estructura raíz

```jsonc
{
  "generated_at": "2025-02-24T06:00:00Z",   // ISO 8601 UTC
  "organization": "NutrappDev",
  "jira_base_url": "https://nutrabiotics.atlassian.net/browse",
  "total_repos": 28,
  "repos": [ /* ver estructura de repo más abajo */ ]
}
```

## Estructura de cada repo

```jsonc
{
  "name": "fruto-web-nutra-co",
  "full_name": "NutrappDev/fruto-web-nutra-co",
  "description": "Tienda principal nutra.co",
  "url": "https://github.com/NutrappDev/fruto-web-nutra-co",
  "is_archived": false,
  "is_fork": false,
  "default_branch": "main",
  "last_push": "2025-02-20T09:00:00Z",

  // Topics de GitHub — base para filtros de fase y equipo en el dashboard
  "topics": ["fase-fruto", "team-roble"],

  // Último tag de producción (prod-YYYY-MM-DD o v* para repos legacy)
  // null si el repo nunca ha tenido tags de producción
  "production": {
    "version": "prod-2025-02-10",
    "sha": "abc1234",
    "date": "2025-02-10T14:30:00Z",
    "url": "https://github.com/NutrappDev/fruto-web-nutra-co/releases/tag/prod-2025-02-10",
    // Cuerpo del tag anotado en formato NutrappDev (null para tags ligeros)
    "body": "Release prod-2025-02-10\n\nFeatures (2):\nPR #101 by Alice - Login con Google [NUTRI-11]\n..."
  },

  // Historial de los 4 tags de producción anteriores al más reciente (puede ser [])
  "production_history": [
    {
      "version": "prod-2025-01-20",
      "sha": "bcd2345",
      "date": "2025-01-20T10:00:00Z",
      "url": "https://github.com/NutrappDev/fruto-web-nutra-co/releases/tag/prod-2025-01-20",
      "body": "..."
    }
    // ... hasta 4 entradas
  ],

  // Último tag de QA (qa-YYYY-MM-DD) — null si no tiene
  "qa": {
    "version": "qa-2025-02-18",
    "sha": "def5678",
    "date": "2025-02-18T10:00:00Z",
    "url": "https://github.com/NutrappDev/fruto-web-nutra-co/releases/tag/qa-2025-02-18",
    "body": "Release qa-2025-02-18\n\nFeatures (1):\n..."
  },

  // Historial de los 4 tags de QA anteriores al más reciente (puede ser [])
  "qa_history": [ /* misma estructura que production_history */ ],

  // Commits pendientes de promover
  "pending": {
    // Commits en develop que aún no están en qa
    // null si no existe alguna de las dos ramas
    "to_qa": {
      "count": 3,                  // total real (puede ser mayor que recent_commits)
      "recent_commits": [
        {
          "sha": "abc1234",        // abreviado a 7 chars
          "message": "feat(auth): agregar login con Google NUTRI-123",
          "date": "2025-02-20T09:00:00Z",
          "author": "Juan García",
          "tickets": [
            { "id": "NUTRI-123", "url": "https://nutrabiotics.atlassian.net/browse/NUTRI-123" }
          ]
        }
        // ... hasta PENDING_COMMITS_LIMIT (10) entradas
      ]
    },
    // Commits en qa que aún no están en main — null si no existen las ramas
    "to_production": { /* misma estructura */ }
  },

  // Estado del último workflow run en la rama principal
  // null si el repo no tiene workflows o el token no tiene scope actions:read
  "ci": {
    "status": "completed",        // "queued" | "in_progress" | "completed"
    "conclusion": "success",      // "success" | "failure" | "cancelled" | "skipped" |
                                  // "timed_out" | "action_required" | "neutral" | null
    "url": "https://github.com/NutrappDev/fruto-web-nutra-co/actions/runs/12345",
    "updated_at": "2025-02-20T10:30:00Z",
    "name": "CI/CD Pipeline"
  },

  // Solo presente si hubo errores al consultar este repo (no bloquea la generación)
  "_errors": {
    "production": null,
    "qa": null,
    "pending_to_qa": "Branch 'develop' not found",
    "pending_to_production": null,
    "ci": null
  }
}
```

## Notas para el frontend

- `production` y `qa` son `null` si el repo nunca ha tenido tags con ese formato.
- `production_history` y `qa_history` son arrays vacíos `[]` si solo hay un tag.
- El campo `body` en tags solo está presente en **tags anotados** (`git tag -a`). Para tags ligeros vale `null`.
- El formato esperado del `body` es el generado por el skill `/release-qa` y `/release-main`:
  ```
  Release prod-YYYY-MM-DD

  Features (N):
  PR #XXX by Autor Name - Resumen del cambio [TICKET-123]

  Fixes (N):
  PR #YYY by Autor Name - Resumen del fix
  ```
- `pending.to_qa` y `pending.to_production` son `null` si el repo no tiene las ramas `develop`, `qa` o `main`.
- `recent_commits` en `pending` está limitado a 10 entradas; `count` refleja el total real.
- `ci` es `null` si el repo no tiene workflow runs o si el token no tiene el scope necesario.
- El campo `_errors` permite al frontend mostrar indicadores de "datos parciales" sin ocultar el repo completo.
- El campo `topics` proviene directamente de la API de GitHub; puede incluir cualquier topic, no solo `fase-*` y `team-*`.

## Estados del dashboard derivados del JSON

| Estado | Color | Condición |
|---|---|---|
| `green` | Verde | Tiene producción + `pending.to_production.count === 0` |
| `pending` | Ámbar | Tiene producción + `pending.to_production.count > 0` o `pending.to_production === null` |
| `migrating` | Violeta | Sin producción + activo (push < 90 días o `pending.to_qa.count > 0`) |
| `gray` | Gris | Sin producción + inactivo (push ≥ 90 días y sin pendientes) |

Los repos se muestran ordenados por urgencia: `pending` → `migrating` → `green` → `gray`, con actividad reciente como criterio secundario.
