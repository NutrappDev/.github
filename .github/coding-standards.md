# Estándares de código — NutrappDev

Principios que aplican a todos los repositorios de la organización, independientemente del lenguaje o framework. Las convenciones específicas por stack (naming, estructura de archivos, patrones de framework) se documentan en el `.ai-context.md` de cada repo.

---

## Stacks activos en la organización

| Stack | Contexto |
|---|---|
| **Next.js / React** | Mayoría de frontends (fruto, ramas) |
| **Node.js / NestJS** | Backends y APIs (raiz, tronco) |
| **Java / Keycloak** | SSO e identidad |
| **n8n** | Automatizaciones (nodos) |
| **MCP servers** | Integraciones con modelos de IA |

Cada stack sigue sus propias convenciones idiomáticas. Lo que está en este documento aplica a todos por igual.

---

## Claridad sobre inteligencia

- El código se lee muchas más veces de las que se escribe. Priorizar legibilidad.
- Nombres descriptivos siempre. Un nombre largo y claro es mejor que uno corto y ambiguo.
- Si una función necesita un comentario para explicar *qué* hace (no *por qué*), probablemente debe renombrarse o dividirse.
- Sin lógica innecesariamente compleja. La solución más simple que resuelve el problema es la correcta.

---

## Responsabilidad única

- Cada función, módulo o componente hace una sola cosa.
- Si describir lo que hace requiere la palabra "y", es señal de que debe dividirse.
- Las capas de presentación no contienen lógica de negocio, y viceversa.

---

## Manejo de errores

- **Sin errores silenciados.** Un `catch` vacío o que solo retorna `null` sin logging es un bug latente.
- **Errores descriptivos.** El mensaje debe indicar qué falló y con qué contexto, no solo "Error" o el mensaje crudo de la excepción.
- **Sin logs de debug en producción.** Statements de logging para desarrollo (print, console.log, System.out) se eliminan antes del merge. El logging de errores reales sí es obligatorio.
- **Fallar explícitamente.** Es mejor lanzar un error claro que continuar con estado inválido.

---

## Seguridad

- **Sin secretos en código.** Credenciales, tokens, API keys y contraseñas siempre en variables de entorno o secret managers. Nunca en commits, aunque sean "temporales" o en ramas de feature.
- **Validar en el boundary.** Los inputs externos (usuario, API, webhook, evento) se validan al entrar al sistema, no dentro de la lógica interna.
- **Principio de mínimo privilegio.** Los servicios y usuarios solo tienen los permisos estrictamente necesarios.
- **Sin lógica de autorización en el cliente.** Las decisiones de acceso ocurren en el servidor o servicio backend.

---

## Testing

- Los tests cubren comportamiento observable, no detalles de implementación interna.
- Un test por escenario. Evitar tests que validan múltiples casos en uno.
- Mocks solo para dependencias externas reales (red, base de datos, servicios de terceros).
- Los tests deben poder ejecutarse en cualquier orden y de forma aislada.

---

## Control de versiones

El flujo de ramas, formato de commits y proceso de releases está definido en [`CONTRIBUTING.md`](../CONTRIBUTING.md). Aplica a todos los repos sin excepción.

---

## Qué evalúa el review automático de IA

Cada PR recibe un análisis automático que revisa las siguientes dimensiones. El resultado se publica como comentario en el PR y es informativo — no bloquea el merge.

- **Seguridad** — secretos en código, validación de inputs, autorización en el lugar correcto
- **Manejo de errores** — catch vacíos, errores silenciados, logs de debug en producción
- **Claridad y responsabilidad** — nombres descriptivos, funciones con propósito único, lógica en la capa correcta
- **Cobertura** — si los cambios introducidos tienen tests correspondientes
- **Cumplimiento de estándares** — adherencia a los principios de este documento y a las convenciones del stack definidas en `.ai-context.md`

---

## Convenciones específicas por stack

Cada repo puede (y debe) tener un `.ai-context.md` en su raíz con:

- Stack y versiones principales
- Patrones de naming propios del lenguaje/framework
- Estructura de carpetas y convenciones del proyecto
- Patrones arquitectónicos usados
- Excepciones o extensiones a estos estándares generales

Si el archivo no existe, aplican solo estos principios generales.
