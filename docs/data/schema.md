# Schema de repos.json

Generado por `.github/workflows/dashboard-generator.yml`. **No editar manualmente.**

## Estructura raíz

```jsonc
{
  "generated_at": "2025-01-15T06:00:00Z",   // ISO 8601 UTC
  "organization": "NutrappDev",
  "jira_base_url": "https://nutrabiotics.atlassian.net/browse",
  "total_repos": 28,
  "repos": [ /* ver estructura de repo */ ]
}
```

## Estructura de cada repo

```jsonc
{
  "name": "alivia-backend",
  "full_name": "NutrappDev/alivia-backend",
  "description": "Backend principal de Alivia",
  "url": "https://github.com/NutrappDev/alivia-backend",
  "is_archived": false,
  "is_fork": false,
  "default_branch": "main",
  "last_push": "2025-01-15T09:00:00Z",

  // Último tag v* en main — null si no tiene releases de producción
  "production": {
    "version": "v1.2.3",
    "sha": "abc1234",
    "date": "2025-01-10T14:30:00Z",
    "url": "https://github.com/NutrappDev/alivia-backend/releases/tag/v1.2.3"
  },

  // Último tag qa-YYYY-MM-DD — null si no tiene releases de QA
  "qa": {
    "version": "qa-2025-01-14",
    "sha": "def5678",
    "date": "2025-01-14T10:00:00Z",
    "url": "https://github.com/NutrappDev/alivia-backend/releases/tag/qa-2025-01-14"
  },

  // Cambios pendientes de promover
  "pending": {
    // Commits en develop que aún no están en qa — null si no existe alguna de las ramas
    "to_qa": {
      "count": 3,
      "recent_commits": [
        {
          "sha": "abc1234",
          "message": "feat(auth): agregar login con Google NUTRI-123",
          "date": "2025-01-15T09:00:00Z",
          "author": "Juan García",
          "tickets": [
            { "id": "NUTRI-123", "url": "https://nutrabiotics.atlassian.net/browse/NUTRI-123" }
          ]
        }
      ]
    },
    // Commits en qa que aún no están en main
    "to_production": {
      "count": 5,
      "recent_commits": [ /* misma estructura */ ]
    }
  },

  // Últimas 5 GitHub Releases (no solo tags anotados)
  "recent_releases": [
    {
      "tag": "v1.2.3",
      "name": "Release v1.2.3",
      "date": "2025-01-10T14:30:00Z",
      "url": "https://github.com/NutrappDev/alivia-backend/releases/tag/v1.2.3",
      "is_prerelease": false,
      "tickets": [
        { "id": "NUTRI-100", "url": "..." },
        { "id": "NUTRI-101", "url": "..." }
      ],
      "body": "Release qa-2025-01-14\n\nFeatures (2):\n..." // max 2000 chars
    }
  ],

  // Solo presente si hubo errores al consultar este repo (no bloquea la generación)
  "_errors": {
    "production": null,
    "qa": null,
    "pending_to_qa": "Branch 'develop' not found",
    "pending_to_production": null,
    "recent_releases": null
  }
}
```

## Notas para el frontend

- `pending.to_qa` o `pending.to_production` pueden ser `null` si el repo no tiene
  las ramas `develop`, `qa` o `main`.
- `production` y `qa` son `null` si el repo nunca ha tenido tags con ese formato.
- Los tickets Jira se extraen del mensaje del commit y del body del release.
- Los `recent_commits` en `pending` están limitados a los 10 más recientes;
  `count` refleja el total real (puede ser mayor).
- El campo `_errors` permite al frontend mostrar indicadores de "datos parciales"
  sin ocultar el repo completo.
