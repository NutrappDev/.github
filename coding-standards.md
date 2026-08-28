# Estándares de código — NutrappDev

> Versión 2 · Actualizado 2026-08-12

Principios y convenciones que aplican a todos los repositorios de la organización.
Las convenciones específicas de cada repo (dominios, migraciones activas, anti-patrones locales)
se documentan en el `.ai-context.md` de cada repo.

Este documento es la **referencia narrativa** para desarrolladores. El bot review automático
(sección "Qué evalúa el review automático" abajo) linkea aquí en cada comentario para que se
pueda consultar el contexto detrás de cada calificación. Los pesos exactos, bloqueantes y
snippets ejecutables viven en el prompt del workflow del bot, no en este documento.

---

## Stacks activos

| Stack                | Repos principales                                                                 |
| -------------------- | --------------------------------------------------------------------------------- |
| **NestJS / Node.js** | monorepo-alivia-backend, microservice_payments, nutrabiotics-certificates-backend |
| **Next.js / React**  | alivia, portal-nutrabiotics, nutrabiotics-empresas, fruto-web-visita-digital      |
| **C# / Epicor**      | tronco-api-erp                                                                    |
| **n8n**              | tronco-automatizacion-interna                                                     |

---

## Principios generales (todos los stacks)

### Claridad sobre inteligencia

- El código se lee muchas más veces de las que se escribe. Priorizar legibilidad.
- Nombres descriptivos siempre. Un nombre largo y claro es mejor que uno corto y ambiguo.
- Si una función necesita un comentario para explicar *qué* hace, debe renombrarse o dividirse.
- La solución más simple que resuelve el problema es la correcta.

### Responsabilidad única

- Cada función, módulo o componente hace una sola cosa.
- Si describir lo que hace requiere la palabra "y", es señal de que debe dividirse.
- Las capas de presentación no contienen lógica de negocio, y viceversa.

### Manejo de errores

- **Sin errores silenciados.** Un `catch` vacío o que solo retorna `null` sin logging es un bug latente.
- **Errores descriptivos.** El mensaje debe indicar qué falló y con qué contexto.
- **Sin logs de debug en producción.** `console.log`, `print`, `System.out` se eliminan antes del merge.
- **Fallar explícitamente.** Es mejor lanzar o retornar un error claro que continuar con estado inválido.

### Seguridad

- **Sin secretos en código.** Credenciales, tokens y API keys siempre en variables de entorno o secret managers.
- **Validar en el boundary.** Los inputs externos se validan al entrar al sistema, no en lógica interna.
- **Mínimo privilegio.** Los servicios y usuarios solo tienen los permisos estrictamente necesarios.
- **Sin lógica de autorización en el cliente.** Las decisiones de acceso ocurren en el servidor.

#### PII y datos sensibles hardcoded

- **Sin datos personales identificables en constantes de código.** Documentos de identidad,
  correos, teléfonos y URLs con UUIDs identificables deben venir de variables de entorno o BD.
  Aunque el repo sea privado, exposición por filtrado, cambio de visibilidad o rotación del
  dato requiere cambio de código en lugar de solo actualizar variables.
- **Patrón correcto:** fallback con valor vacío (`?? ''`) más lectura de env var; si falta la
  variable, el sistema falla explícito en lugar de exponer datos.

#### Endpoints públicos y exposición de datos sensibles

- **Un endpoint sin `@UseGuards` es endpoint público.** Si retorna correos, teléfonos,
  documentos, direcciones o cualquier PII, hay que evaluar si el consumidor real es efectivamente
  público-público o si es interno con contrato mal declarado.
- **Naming honesto:** un controller con path `public/*` debe ser genuinamente público. Si el
  consumidor es "el portal interno", mover a controller privado con guard es más claro que
  confiar en oscuridad de URL.
- **Sanitizar por default** al construir respuestas — mostrar solo los campos que el consumidor
  necesita, no todos los del modelo. Documento en el body del PR qué se sanitiza y por qué.
- **Coordinar con Ops** cuando el endpoint deba estar detrás de authorizer, WAF o IP whitelist.
  La responsabilidad no puede quedar solo en "esperamos que nadie descubra la URL".

### Testing

- Los tests cubren comportamiento observable, no detalles de implementación interna.
- Un test por escenario. Evitar tests que validan múltiples casos en uno.
- Mocks solo para dependencias externas reales (red, base de datos, servicios de terceros).
- Los tests deben poder ejecutarse en cualquier orden y de forma aislada.

### Control de versiones

El flujo de ramas, formato de commits y proceso de releases está definido en [`CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## NestJS / Node.js

### Estructura de módulos

Un módulo por dominio de negocio, no por capa técnica. Cada módulo sigue esta estructura:

```
src/
  interfaces/rest/      ← Controllers, DTOs (capa HTTP — NestJS permitido)
  application/          ← Use cases, Commands, Queries (TypeScript puro)
  domain/               ← Entities, Value Objects, Repository interfaces (TypeScript puro)
  infrastructure/       ← Prisma, clientes externos, adapters (NestJS permitido)
  main.ts               ← Bootstrap (NestJS permitido)
```

**Regla crítica:** `domain/` y `application/` no importan nada de `@nestjs/*`.
Los `libs/` compartidos siguen la misma regla — ver anti-patrón en `.ai-context.md` de cada repo.

### Controllers

- **Thin controllers:** solo reciben el request, mapean DTO → Command, llaman al use case, devuelven respuesta.
- Sin acceso directo a repositorios o Prisma desde controllers.

### DTOs y validación

- DTOs separados por operación: `CreateXDto`, `UpdateXDto`, `XResponseDto`. Nunca reusar una entity como DTO.
- **Objetivo:** `ValidationPipe` global en `main.ts` con `whitelist: true` y `transform: true`.
  `forbidNonWhitelisted: true` en proyectos nuevos o al refactorizar hacia arquitectura DDD.
- **Estado actual:** el `ValidationPipe` global aún no está habilitado en todos los MSs — los
  decoradores de los DTOs están declarados pero no se ejecutan automáticamente. Como puente,
  aplicar `@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))` a nivel de
  controller cuando se añaden endpoints públicos con input externo.
- Validar en el boundary HTTP — los use cases reciben datos ya validados y transformados.

### Manejo de errores — Result pattern *(objetivo, en migración)*

- **Estado actual:** los use cases lanzan excepciones de NestJS (`NotFoundException`,
  `BadRequestException`, etc.) desde `application/`. El `GlobalExceptionFilter` las traduce
  a la respuesta HTTP estándar.
- **Objetivo:** cuando `neverthrow` esté disponible como lib compartida, migrar a
  `Result<T, DomainError>` para que los use cases nunca lancen excepciones de negocio.
  Los controllers serán el único punto de conversión `Result` → `HttpException`.
  **No instalar `neverthrow` sin coordinar con el equipo** — la migración es cross-servicio.

```typescript
// Objetivo — no anticipar, ilustrativo del patrón
async execute(cmd: CreateOrderCommand): Promise<Result<OrderId, OrderNotFoundError | InsufficientStockError>>

const result = await this.useCase.execute(command);
if (result.isErr()) throw new NotFoundException(result.error.message);
return result.value;
```

### Formato estándar de respuesta HTTP

- `errorCode` es un enum por dominio (`ORDER_NOT_FOUND`, `INSUFFICIENT_STOCK`). El cliente siempre usa `errorCode`, nunca parsea `message`.

```typescript
// Éxito
{ data: T, meta?: { page: number, pageSize: number, total: number } }

// Error (normalizado por GlobalExceptionFilter)
{ statusCode: number, errorCode: string, message: string }
```

### Acceso a datos (Prisma)

- Los services nunca importan `PrismaClient` directamente. Solo los repositorios de `infrastructure/` lo hacen.
- Operaciones multi-tabla siempre dentro de `prisma.$transaction([...])`.
- `select` explícito en queries de listado — prohibir retornar `*` con relaciones anidadas.
- Migraciones revisadas en PR. Nunca `prisma db push` en repos compartidos.

### Configuración y variables de entorno

- **`ConfigService` de NestJS** es el estándar cuando hay múltiples servicios que comparten la
  misma config o cuando la config requiere DI (mockear en tests, integración con SSM/secrets).
- **Alternativa liviana:** para config simple (feature flags booleanos, umbrales numéricos,
  URLs con default), usar función pura en `src/config/<feature>.config.ts` con firma
  `resolveXxx(env: NodeJS.ProcessEnv = process.env): T`. Ventajas:
  - Testeable sin `jest.spyOn(process.env)` — pasas el env como parámetro con default.
  - Sin estado global, sin side effects.
  - Sin acoplar el service a `@nestjs/config`.
  - Vive fuera de `application/` (satisface la regla "no `process.env` directo en la capa de aplicación").

```typescript
// src/config/cart-abandonment.config.ts
const DEFAULT_THRESHOLD_MINUTES = 40;

export function resolveCartAbandonmentThresholdMinutes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.CART_ABANDONMENT_THRESHOLD_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_THRESHOLD_MINUTES;
}
```

- **Cuándo NO usar este patrón:** cuando la config requiere DI (múltiples servicios la
  comparten y quieren mockearla), cuando hay lookup dinámico por key, o cuando se necesita
  integración con `@nestjs/config` (SSM, secrets manager). En esos casos, `ConfigService`
  sigue siendo lo correcto.

### Logging *(objetivo, en migración)*

- **Estado actual:** la mayoría de servicios usan `Logger` de `@nestjs/common` instanciado
  como propiedad de clase (`private readonly logger = new Logger(ServiceName.name)`). Esta
  es la práctica extendida hoy en el monorepo — al añadir código nuevo, seguir el patrón
  vigente del MS donde estás trabajando.
- **Objetivo:** migrar a `LoggerService` de `libs/shared/loggers` inyectado por constructor.
  Logs estructurados en JSON con `correlationId`, `awsRequestId`, `service`, `level`,
  `timestamp`. Patrón **Wide Events**: un evento estructurado por request con contexto de
  negocio relevante. `correlationId` se inyecta automáticamente vía middleware.
- **Reglas que aplican HOY** (independiente de qué logger uses):
  - Nunca `console.log`, `console.error`, etc. en código nuevo fuera de `main.ts` bootstrap.
  - Solo `error` para errores que requieren acción. `warn` para anomalías recuperables.
  - Sin `debug` en producción.
- **No migrar servicios existentes de `Logger` a `LoggerService` fuera del scope del PR** —
  la migración cross-servicio se coordina en un track infra dedicado.

### API y paginación

- Versionado por URI en proyectos nuevos y refactorizados: `/v1/recursos`.
- Status codes correctos: `201` en create, `204` en delete sin body, `409` en conflicto.
- Paginación obligatoria en endpoints de listado — ver formato en "Formato estándar de respuesta HTTP".
- Naming de rutas: kebab-case, sustantivos en plural (`/v1/orders`, `/v1/order-items`).

### Async

- Solo `async/await`. No Observables salvo en streams reales.
- `Promise.all([...])` para operaciones independientes que pueden correr en paralelo.

### Testing

| Tipo        | Herramienta                                     | Qué cubre                    |
| ----------- | ----------------------------------------------- | ---------------------------- |
| API / E2E   | **Bruno** (archivos `.bru` en `tests/bruno/`)   | Flujos completos via HTTP    |
| Unit        | **Jest** con repos mockeados (`jest.Mocked<T>`) | Use cases, domain logic      |
| Integration | **Jest** con DB de test                         | Repositorios, queries Prisma |

- Patrón AAA obligatorio en todos los tests.
- Nombres: `should_<comportamiento>_when_<condición>`.
- Cobertura mínima: lógica de dominio y use cases. Controllers e infraestructura son opcionales.

---

## Next.js / React

### Router

- **Proyectos nuevos:** App Router (estructura `app/`).
- **Proyectos existentes:** Pages Router hasta refactorización. No migrar forzadamente.
- Repo de referencia App Router: `nutrabiotics-empresas`.

### Componentes (App Router)

- Server Components por defecto.
- `'use client'` solo cuando hay interactividad, event listeners o hooks de React.
- `error.tsx` y `loading.tsx` por cada segmento de ruta.

### Data fetching

- **Server components:** `fetch` nativo con cache tags de Next.js.
- **Client components:** TanStack Query v5.
- No mezclar SWR con TanStack Query en el mismo proyecto.

### Estado

- **Repos existentes:** Redux Toolkit (ya adoptado, no reemplazar).
- **Repos nuevos:** TanStack Query maneja server state. React primitivos (`useState`, `useReducer`, Context) para client state. Sin Redux.
- Escalado de client state: `useState` → `useReducer` → Context → Zustand (solo si hay estado cross-feature complejo sin server state).

### Formularios y validación

- **Estándar:** react-hook-form + Zod.
- Migrar Formik progresivamente en repos que lo usan.
- Zod reemplaza Yup como librería de validación. Un schema Zod puede usarse en client y server.

### TypeScript

- `strict: true` en `tsconfig.json` — obligatorio.
- Prohibir `any`. Usar `unknown` con narrowing cuando el tipo no se conoce.
- Tipar explícitamente props de componentes — no inferir desde el uso.

### HTTP client

- Axios como cliente HTTP estándar en todos los repos.
- Sin URLs de API hardcoded en componentes — leer de `process.env.NEXT_PUBLIC_*` o de config layer equivalente.
- Interceptor único para auth headers y manejo de 401 (redirigir a login).

### Testing

- **Unit:** Vitest + Testing Library. Cubrir hooks custom, lógica de utilidades, componentes con lógica no trivial.
- **E2E:** Playwright para flujos críticos (login, checkout, formularios de conversión).
- No testear detalles de implementación (nombres de clases CSS, estructura interna del DOM) — testear comportamiento visible al usuario.
- Mocks solo para APIs externas (MSW para simular HTTP). No mockear componentes propios en tests unitarios.

### Manejo de errores

- **Error boundaries** por segmento de ruta (App Router: `error.tsx`; Pages Router: `ErrorBoundary` component).
- **Fallar visible pero elegante:** mostrar mensaje al usuario + botón de reintentar. Nunca dejar la pantalla en blanco.
- **No swallow errors en `.catch()`** — al menos loggear (Sentry, Datadog o consola en dev).
- Errores de fetch/mutation: TanStack Query maneja retry + error state — usar `error` del hook, no try/catch manual.

### Seguridad

- **Sin secretos en el cliente.** Todo lo que empiece con `NEXT_PUBLIC_*` es público — expuesto en el bundle. API keys, tokens de servicios, credenciales van en backend/Edge functions.
- **XSS:** React escapa por default con `{}`. Nunca usar `dangerouslySetInnerHTML` con contenido de usuario sin sanitizar (DOMPurify).
- **Validación de forms en cliente + servidor.** Cliente para UX (feedback inmediato), servidor para seguridad (nunca confiar solo en cliente).
- **Autenticación:** cookies `HttpOnly` + `Secure` + `SameSite=Strict`. Nunca `localStorage` para tokens.

### Performance

- **Bundle size:** monitorear con `@next/bundle-analyzer`. Alerta si un feature agrega >50KB gzipped.
- **Lazy loading:** `dynamic()` de Next.js para componentes pesados no-críticos (modales, editors, gráficas).
- **Imágenes:** `next/image` obligatorio. Definir `width`/`height` para evitar CLS.
- **Core Web Vitals:** LCP <2.5s, CLS <0.1, INP <200ms. Verificar en Lighthouse antes de deploy.

### Accesibilidad

- Elementos semánticos: `<button>` para acciones, `<a>` para navegación. No `<div onClick>`.
- Formularios con `<label htmlFor>` explícito. Sin placeholders como único label.
- Contraste WCAG AA mínimo (4.5:1 texto normal, 3:1 texto grande).
- Testear con teclado — todo debe ser accesible sin mouse.

---

## AI-assisted development

- **Tipos explícitos en boundaries**: parámetros, retornos y DTOs tipados siempre. La IA genera mejor código con contratos claros.
- **Un archivo, un propósito**: facilita que la IA edite sin romper contexto de otros módulos.
- **JSDoc en funciones públicas de libs**: mejora autocompletado y generación de código que consume la lib.
- **Path aliases**: usar `@nutra-core/...` en vez de rutas relativas. La IA pierde menos al referenciar imports.
- **Sin comentarios obvios**: prohibir comentarios que describen lo que el código hace (`// increment counter`, `// return result`). Solo comentar el *por qué* cuando no es obvio.
- **Tests existentes como spec viva**: la IA los usa como contexto para generar features similares — mantenerlos actualizados.

---

## Qué evalúa el review automático de IA

Cada PR a `develop`, `qa` y `main` en repos con el workflow activo recibe un análisis
automático del bot review. Aplica tanto a repos de backend (NestJS/Node.js) como de
frontend (Next.js/React) — las reglas conceptuales son las mismas; el bot adapta los
ejemplos al stack del repo actual leyendo su `.ai-context.md` local.

El resultado se publica como comentario en el PR con una **calificación de 0 a 10** y una
lista de issues accionables. El comentario es informativo por default; el bot puede
recomendar Request Changes cuando hay bloqueantes (ver "Bloqueantes" abajo), pero la
decisión final de merge queda con el autor y los reviewers humanos.

El bot lee:
- El diff del PR (solo comenta líneas del diff — nunca sobre código legacy no tocado)
- El `.ai-context.md` local del repo (dominios, arquitectura, migraciones activas, anti-patrones específicos del stack)
- El prompt hard-coded del workflow YAML (define los criterios de calificación exactos)

**El bot NO consulta otros repos en runtime** (incluido este `.github` org). Este documento
es referencia narrativa para consultar cuando llegues desde el link del comment del bot.

### Cómo se calcula la calificación

Cada PR arranca en **10.0/10** y baja según los issues detectados, con posibles bonus. Los
pesos exactos viven en el prompt del workflow; aquí explicamos las categorías conceptualmente.

**Umbral progresivo:** durante las primeras semanas de rollout el umbral de Approve empieza
bajo (~5.0) y sube progresivamente hasta 8.5 a lo largo de ~11 semanas. Esto da margen de
adaptación al equipo sin bajar la vara estructural.

### Bloqueantes (impiden Approve, con descuentos altos)

Son reglas duras: no se suavizan por benevolencia, no se agrupan bajo descuento menor, no se
convierten en nota informativa. Si detectás alguno en tu PR, arreglalo antes de merge:

- **`console.log` (o equivalentes)** en código nuevo fuera de `main.ts` bootstrap. Usar
  el logger estructurado del proyecto.
- **`eslint-disable*` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` sin comentario justificatorio.**
  Cada regla deshabilitada cuenta por separado. Un `/* eslint-disable A, B */` son 2 disables.
- **Desactivar reglas ESLint globalmente** o aflojar `tsconfig` (`strict: false`, etc).

**Downgrade de disable sin justificación → con justificación** (descuento reducido): añadir
el motivo junto al disable (comentario en línea previa o sufijo `-- razón` en la misma directiva).
Cuando el pattern es raro y no obvio, el comment del bot te dará el snippet exacto.

### Descuentos por calidad de código nuevo

Menos severos que bloqueantes, se acumulan si aparecen múltiples:

- **Sin tests para lógica no trivial** (dinero, race conditions, estados con casos edge,
  sanitización de PII, cálculos derivados). Backend: `jest.Mocked<T>` sobre repos.
  Frontend: Testing Library sobre hooks/componentes con lógica no trivial.
- **`as any` propagado a código nuevo** — usar tipos concretos o `unknown` con narrowing (aplica a ambos stacks).
- **`process.env` directo en la capa incorrecta.**
  Backend: en `application/` o `domain/` — extraer a config layer.
  Frontend: valores sensibles con prefijo `NEXT_PUBLIC_*` (expuestos en el bundle).
- **Excepciones de negocio lanzadas desde la capa incorrecta.**
  Backend: desde `application/` (objetivo Result pattern — ver sección "Manejo de errores").
  Frontend: sin error boundaries en componentes que hacen fetch/mutation.
- **Workarounds que ocultan problemas de origen** — arreglar la causa, no el síntoma.
- **`catch` vacíos o silencio de errores con `.catch(() => null)` sin log** (aplica a ambos stacks).

### Bonus (suma capada en +0.5)

Aplican solo cuando se cumplen los criterios estrictos (no auto-generación por checklist):

- **Body del PR con "por qué"** — motivación real + alternativas descartadas.
- **Migración Prisma idempotente + backfill documentado** en el body (`ON CONFLICT DO NOTHING`,
  guards `WHERE NOT EXISTS`, unique parcial). Migraciones puras `CREATE TABLE` sin backfill no
  cuentan — es el mínimo esperado.
- **Runbook operativo pin al PR** — orden de deploy multi-paso, smoke tests obligatorios,
  qué hacer si falla.
- **Docs públicas actualizadas** en `docs/` (README de módulo, arquitectura, decisión).
- **Artefactos de testing versionados.**
  Backend: `api-test/monorepo/` (Bruno con `docs { }` por endpoint nuevo).
  Frontend: specs de Playwright (`e2e/`) para flujos críticos nuevos.
- **Respuesta al review anterior con acción concreta** — refactor de responsabilidad, reversión
  de scope creep, comentario extensivo en el body/commit que aborda cada punto, adopción
  de reference implementations existentes del monorepo.

### Merge de urgencia (excepción documentada)

Cuando hay un deadline externo real (demo cliente, evento de negocio, hotfix crítico) y el PR
tiene issues no bloqueantes pendientes, es aceptable mergear con follow-up. Convención:

- El body del PR debe declarar explícitamente **"Merge de urgencia por <razón>; issues #A #B
  pendientes de resolver en PR follow-up NCR-XXX (deadline YYYY-MM-DD)"**.
- Crear el ticket follow-up **antes** del merge, no después.
- **Bloqueantes formales no se saltan por urgencia** — se arreglan en el momento.
- **Issues de seguridad activa** requieren mitigación paralela (WAF/authorizer/IP whitelist)
  antes del merge.

### Cuándo el bot no comenta un issue

- Cuando el pattern es sistémico preexistente en el MS (≥3 ocurrencias en archivos que el
  PR no modifica) — se registra como nota informativa sin descuento, no como issue del autor.
  Es deuda a resolver en un track infra cross-servicio, no en cada PR.
- Cuando el issue fue abordado explícitamente en el body del PR (aunque no requiera cambio
  de código) — se reconoce en el bloque "Corregido/abordado desde el review anterior".
- Cuando el pattern responde a una regla que aún no está formalmente exigida — se marca como
  `[Dirección futura]` con `-0.1` educativo y nota "hoy no requiere cambio".

### Checks adicionales que solo el bot puede hacer

Además de los principios y convenciones anteriores, el bot verifica algunos aspectos que
requieren visión transversal del repo o memoria histórica:

- **Anti-patrones de libs**: imports de `@nestjs/*` o `process.env` directo en libs
  compartidas (`libs/{dominio}/`), que rompen framework-agnostic.
- **Compatibilidad con roadmap**: si el código dificulta migraciones activas definidas en
  el `.ai-context.md` (SSM, DDD hexagonal, Result pattern, etc.).
- **Coherencia de `affected.txt`**: si el archivo lista MSs no afectados o omite MSs que sí
  se tocan (especialmente cuando el PR modifica `libs/` con consumers transitivos).

---

## Convenciones específicas por repo

Cada repo tiene un `.ai-context.md` en su raíz con:

- Stack y versiones principales
- Tabla de dominios: qué posee cada módulo o microservicio
- Anti-patrones específicos del proyecto
- Migraciones activas y su dirección
- Naming conventions objetivo
- Excepciones o extensiones a estos estándares

Si el archivo no existe, aplican solo los principios de este documento.
