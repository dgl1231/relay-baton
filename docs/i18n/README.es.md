<div align="center">

# relay-baton

**Infraestructura portátil de continuación para agentes de codificación.**

Pasa estado de codificación comprimido entre Codex CLI, Claude Code y lo que venga después — sin volver a pegar el log de chat, el diff o el repositorio.

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · **Español**
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

```bash
# Codex se topa con un muro de cuota a mitad de tarea. relay-baton lo detecta,
# construye un handoff compacto a partir del estado real del repo, y Claude continúa.
$ relay-baton run "refactorizar el pipeline de upload" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Por qué existe

El trabajo de codificación con IA se está fragmentando entre herramientas. Una sesión real se ve así:

- Codex CLI para un lote de ediciones.
- Claude Code para otro.
- Un portátil por la mañana, otra máquina por la noche.
- Una context window que se llena, se rompe o trunca en silencio.

Hoy la forma por defecto de mover trabajo entre agentes es **copiar y pegar el log del chat** — o peor, volcar el repositorio entero en un prompt. Tiene tres problemas:

1. **Tokens.** Los logs de chat son mayormente ruido. Pagas por ese ruido en cada turno.
2. **Continuidad.** El siguiente agente no recibe *intención*; recibe transcripts.
3. **Fragilidad.** Un archivo perdido, un diff obsoleto, y el agente reinicia desde una premisa equivocada.

relay-baton es un **harness local** que se sitúa debajo de los agentes y transporta el *estado mínimo suficiente* a través del handoff: un resumen compacto, un repo map y referencias a archivos — no un transcript.

> **Gasta el mínimo posible de tokens mientras unificas Codex CLI y Claude Code CLI en un solo flujo.**

## La idea

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

Un baton-pass para agentes de codificación — primitiva en 4 pasos:

- **Detect** detecta cuándo el agente actual deja de ser útil (quota, context, rate, errors).
- **Capture** captura lo que importa (estado del repo, archivos cambiados, decisiones, próximo paso).
- **Compact** comprime bajo un presupuesto que el siguiente agente pueda consumir.
- **Hand off** entrega solo tras pasar los quality gates.

El handoff es un archivo pequeño (`.ai-session/handoff.md`) más referencias. Todo lo pesado (diff completo, log completo, repo map completo) queda en disco y se carga bajo demanda.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # login Codex + Claude
pnpm relay-baton doctor         # comprobación del entorno
pnpm relay-baton run "Arreglar el flujo de subida de adjuntos de correo" --diet balanced
```

## Flujo de trabajo

```bash
$ relay-baton init                  # crea .ai-session/
$ relay-baton run "arreglar el test inestable de upload" --diet balanced
... la salida de codex se transmite en vivo ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude retoma, edita archivos, termina ...

$ relay-baton status                # estado de la sesión
$ relay-baton budget                # uso del presupuesto del diet
```

Handoff manual sin fallback automático:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Cambio entre múltiples repos:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "conectar el nuevo metrics endpoint"
```

## Características

- **Fallback automático** — Detecta `quota exceeded`, `rate limit exceeded`, `maximum context length`, etc. en la salida del agente. Salta líneas tipo grep y prosa que explica los propios patrones (evita falsos positivos).
- **Token diet** — 5 profiles determinísticos (`off · lite · balanced · caveman · ultra`). Excluye lock/build/min, tail de logs, repo map en lugar de fuente.
- **Quality gates** — Verifica completitud y presupuesto *antes* de lanzar el agente fallback.
- **Auth-safe por defecto** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` se retiran de los subprocesos. Opt-in solo vía `--allow-api-key-env`. Nunca se guardan, imprimen ni registran.
- **Project registry** — Registra varios repos una vez, ejecuta comandos contra cualquiera con `--project` o `--path`.
- **Ink TUI** — Dashboard de project / sesión. Nunca lanza agentes.
- **Sin API propia** — relay-baton no llama a la API de OpenAI / Anthropic. Solo invoca subprocess locales de `codex` / `claude`.

## Comandos

| Comando | Descripción |
|---|---|
| `relay-baton init` | Crear `.ai-session/` en el repo actual |
| `relay-baton doctor` | Comprobar git / codex / claude / env / config (`--deep` para diagnóstico ampliado) |
| `relay-baton verify` | Comprobación end-to-end simulada — sin llamadas reales al modelo |
| `relay-baton login [agent]` | Flujos de login de Codex / Claude |
| `relay-baton run "<task>"` | Ejecutar agente primario + detectar fallback + handoff |
| `relay-baton handoff --to claude` | Handoff manual (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | Lista el handoff actual + los respaldos (solo metadatos) |
| `relay-baton plan "<task>"` | Plan-execute: el planificador escribe `plan.md` (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: el ejecutor implementa `plan.md` (`--with`, `--from`) |
| `relay-baton compress-context` | Comprime el contexto vivo (state.md / commands.log) (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | Regenerar compact-state / repo-map / full-diff |
| `relay-baton budget` | Mostrar uso del context budget |
| `relay-baton compress <file>` | Compresión determinística de markdown |
| `relay-baton status` | Estado de la sesión |
| `relay-baton project add/list/switch/current/doctor/remove` | Gestionar registry de proyectos |
| `relay-baton tui` | Dashboard Ink |

Los comandos sensibles a project aceptan `--project <name-or-id>` y `--path <repoPath>`. Prioridad: `--path` > `--project` > project activo > cwd.

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

Ruta por defecto: `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE` permite sobrescribir (CI, sandbox, tests). Un archivo corrupto se respalda como `projects.json.corrupt-<timestamp>.bak` y el registry se reinicia vacío — los comandos siguen funcionando.

## Token diet profiles

| Profile | Intención |
|---|---|
| `off` | Truncamiento mínimo |
| `lite` | Limpieza ligera |
| `balanced` *(por defecto)* | Uso diario |
| `caveman` | Mínimo agresivo |
| `ultra` | Compresión extrema |

> `caveman` **no es un tono jocoso** — significa *aggressive minimal-context*. La precisión técnica se preserva.

## Frente a las alternativas

| Enfoque | Qué se transfiere | Coste en tokens | Continuidad | Modo de fallo |
|---|---|---|---|---|
| v1.5.0-alpha.0 | [Read →](../../release-notes/v1.5.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.5.0-alpha.0.md) | Git tracking first cut: read-only `relay-baton git status --json`, non-git project fallback, desktop Git panel, and `/git` in Agent Room. |
| Export crudo del chat | Transcript completo | Alto (la mayor parte es ruido) | Frágil — el agente relee su propio razonamiento | Desbordamiento de context window |
| Copiar/pegar prompting | Lo que el humano recuerda | Variable | Frágil | Drift silencioso del estado real |
| Volcado del repo | Todo | Muy alto | Fuerte pero caro | El modelo trunca a mitad de archivo |
| **relay-baton** | Resumen compacto + repo map + referencias | **Bajo, acotado por profile** | Fuerte — guiado por el estado *real* del repo | Falla *de forma visible* vía quality gates |

## Filosofía

relay-baton es **herramientas pequeñas y afiladas para workflows de desarrollo AI-nativo**.

- **Local-first.** Todo vive en tu disco. Sin nube, sin daemon, sin telemetría, sin cuenta.
- **Composabilidad.** Un directorio `.ai-session/` son simplemente archivos. Léelos, grep, diff, adjúntalos a un PR.
- **Transferencia de estado ligera.** Un handoff es un archivo markdown, no una base de datos.
- **Determinista antes que listo.** Sin resumen LLM dentro del harness — si el modelo resume mal, el handoff miente. Solo presupuestos de caracteres, reglas estructurales y referencias explícitas.
- **El estado del repo es la fuente de verdad.** La conversación es interpretación; el repo es hecho.
- **La eficiencia en tokens es la función** — no una opción escondida en un menú.

### Principios de diseño

1. Es **work handoff**, no relay de chat.
2. El **estado actual del repositorio** prevalece sobre cualquier historial de conversación.
3. El handoff debe ser **legible por un humano**.
4. Cada UI es una capa fina sobre `core`.
5. **Token diet no es una función secundaria — es la función principal.**

## Dirección futura

relay-baton arranca como harness de fallback de dos agentes. La misma primitiva escala más allá:

- **Cadenas de relay multi-agente** — Codex → Claude → OpenCode → de vuelta a Codex.
- **Árboles de sesión con ramas** — Bifurca una tarea en intentos paralelos; reconcilia vía diffs.
- **Estado de relay remoto** — Push de `.ai-session/` a un remote compartido para que la siguiente máquina retome.
- **Workflows orquestados** — Modos `review`, `diagnose`, `continue` (autopilot acotado con checkpoints explícitos).
- **Más adapters** — OpenCode, Gemini CLI, Aider, cualquier cosa con una interfaz subprocess local razonable.

La forma del harness no cambia: detect, capture, compact, hand off.

## Requisitos

| Item | Versión / Nota |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | requerido |
| `codex` | **requiere suscripción ChatGPT Plus o superior** |
| `claude` | **requiere suscripción Claude Pro o superior** |

> relay-baton no llama directamente a la API de OpenAI / Anthropic. Usa la **autenticación por suscripción** de las CLIs locales `codex` / `claude`. La auth por API key es técnicamente posible pero **bloqueada por defecto** (opt-in con `--allow-api-key-env`).

## Login

```bash
pnpm relay-baton login           # ambos
pnpm relay-baton login codex
pnpm relay-baton login claude
```

Que `claude --version` funcione **no** significa estar logueado. Si ves "Not logged in", vuelve a ejecutar el comando anterior.

## Notas de versión

**Latest:** v1.5.0-alpha.0 — [English](../../release-notes/v1.5.0-alpha.0.md) · [한국어](../../release-notes/ko/v1.5.0-alpha.0.md)

| Versión | English | 한국어 | Resumen |
|---|---|---|---|
| v1.4.0-alpha.1 | [Read →](../../release-notes/v1.4.0-alpha.1.md) | [읽기 →](../../release-notes/ko/v1.4.0-alpha.1.md) | Distribution polish: one-line installers with SHA-256 verification, release SHA256SUMS/SBOM metadata, package-manager starter files, optional signing hooks, and a desktop Codex/Claude preview switcher. |
| v1.3.0-alpha.0 | [Read →](../../release-notes/v1.3.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.3.0-alpha.0.md) | Desktop conversation + project-scoped sessions: Agent Room composer, persisted conversation events via `conversation append`, visible project/session context, and confirmation-first slash actions. |
| v1.2.0-alpha.3 | [Read →](../../release-notes/v1.2.0-alpha.3.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.3.md) | Desktop project management + i18n: add projects with the folder picker, switch/remove projects in the GUI, register non-git project folders, and switch UI chrome between English/Korean/Japanese/Simplified Chinese. |
| v1.2.0-alpha.2 | [Read →](../../release-notes/v1.2.0-alpha.2.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.2.md) | Desktop sidecar fix: the GUI now actually reaches the bundled CLI (`withGlobalTauri` + `window.__TAURI__`), so status/budget/handoff/timeline panels populate. |
| v1.2.0-alpha.1 | [Read →](../../release-notes/v1.2.0-alpha.1.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.1.md) | Desktop prerelease completed: fixes the Windows `.msi` build and adds signing docs, window-state persistence, light/dark toggle, and TUI-mirrored keyboard shortcuts. |
| v1.2.0-alpha.0 | [Read →](../../release-notes/v1.2.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.0.md) | Desktop GUI prerelease: release job, deterministic icons, sidecar staging, read-only dashboard, and CLI JSON surface for desktop integration. |
| v1.1.3 | [Read →](../../release-notes/v1.1.3.md) | [읽기 →](../../release-notes/ko/v1.1.3.md) | Distributable release: per-OS standalone executables attached to GitHub Releases, automated release pipeline, README downloads, and Tauri desktop scaffold. |
| v1.0.0 | [Read →](../../release-notes/v1.0.0.md) | [읽기 →](../../release-notes/ko/v1.0.0.md) | Stable Local Release: frozen config/session contracts, .ai-session/ artifact validation (doctor --deep), full command reference (docs/COMMANDS.md EN+KO), finalized Agent Room set with read-only /diagnose. |
| v0.9.0 | [Read →](../../release-notes/v0.9.0.md) | [읽기 →](../../release-notes/ko/v0.9.0.md) | Automation & Runtime (bounded): LoopController, room /continue --max-steps N · /replan · /replay, relay-baton replay, adaptive per-agent compression thresholds. |
| v0.8.0 | [Read →](../../release-notes/v0.8.0.md) | [읽기 →](../../release-notes/ko/v0.8.0.md) | Adapter Expansion + Agent Room (first cut): OpenCode/Gemini/Aider adapter scaffolds, project-level fallback overrides, OS CI matrix, chat/room REPL. |
| v0.7.0 | [Read →](../../release-notes/v0.7.0.md) | [읽기 →](../../release-notes/ko/v0.7.0.md) | Review & Diagnose: review (deterministic diff-vs-plan), execution receipts, plan diffing, --json outputs, conversation event schema (draft). |
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify` (E2E simulado, sin llamadas al modelo), `doctor --deep`, panel de modo en la TUI, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | Modo plan-execute (`plan` / `execute`) + compresión de contexto (`compress-context`). |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | CI de GitHub Actions, tests, observabilidad de sesión, `handoff history`. |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` sin efectos secundarios, copia de seguridad/recuperación automática de `projects.json` corrupto, override por env `RELAY_BATON_PROJECTS_FILE`, limpieza de `lastError` en fallback. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Añade project registry, `--project` / `--path`, comandos de proyecto y dashboard TUI. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | MVP de handoff Codex-to-Claude con token diet, fallback detection y quality gates. |

## License

MIT. Detalles en [`LICENSE`](../../LICENSE).

> Documentación completa (detalles de quality gates, significado de los archivos de `.ai-session/`, schema de config, atajos del TUI, troubleshooting) está en [English README](../../README.md) y [`install/install.md`](../../install/install.md).
