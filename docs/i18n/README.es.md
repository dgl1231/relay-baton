<div align="center">

# ⚡ relay-baton

**Arnés de traspaso consciente del consumo de tokens entre Codex CLI ↔ Claude Code**

Pasa el testigo de un agente de programación al siguiente — sin desperdiciar tu presupuesto de tokens.

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

---

> **Misión de este proyecto**
>
> 💡 **Gastar la menor cantidad posible de tokens mientras se fusionan Codex CLI y Claude Code CLI en un único flujo de trabajo.**
>
> Cuando un agente alcanza un límite de cuota / contexto, el siguiente retoma desde el mismo estado del repositorio — sin volver a pegar el log, diff o repo entero. El traspaso lleva sólo un *resumen compacto* y *referencias a archivos*. Por eso relay-baton es un *token diet harness*: no es una función extra, es la razón por la que el proyecto existe.

## ✨ Características

- 🪄 **Fallback automático** — Detecta frases como `quota exceeded`, `rate limit exceeded` o `maximum context length` en la salida de Codex y traspasa el trabajo a Claude Code.
- 📉 **Dieta de tokens** — Cinco perfiles (`off · lite · balanced · caveman · ultra`) con compactación determinista.
- 🛡️ **Autenticación segura por defecto** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` **no se pasan** a procesos hijos por defecto.
- ✅ **Quality gates** — Verifican completitud del traspaso y presupuesto de tokens antes de lanzar el agente fallback.
- 🧰 **Login en un comando** — `relay-baton login` ejecuta los flujos de auth de cada CLI.
- 🎛️ **TUI con Ink** — Estado de sesión, disponibilidad de agentes y presupuesto a la vista.
- 🚫 **Sin llamadas API propias** — sólo subprocesos de los CLIs locales.

## 🚀 Inicio rápido

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "Arregla el flujo de subida de adjuntos del correo" --diet balanced
```

## 📝 Notas de versión

| Versión | English | 한국어 | Resumen |
|---|---|---|---|
| v0.3.0 | [notes](../../release-notes/v0.3.0.md) | [릴리즈 노트](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` sin efectos secundarios, copia de seguridad/recuperación automática de `projects.json` corrupto, override por env `RELAY_BATON_PROJECTS_FILE`, limpieza de `lastError` en fallback. |
| v0.2.0 | [notes](../../release-notes/v0.2.0.md) | [릴리즈 노트](../../release-notes/ko/v0.2.0.md) | Añade project registry, `--project` / `--path`, comandos de proyecto y dashboard TUI. |
| v0.1.0 | [notes](../../release-notes/v0.1.0.md) | [릴리즈 노트](../../release-notes/ko/v0.1.0.md) | MVP de handoff Codex-to-Claude con token diet, fallback detection y quality gates. |

## 🧭 Uso

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "tarea" --diet balanced
pnpm relay-baton handoff --to claude --no-run --diet caveman
```

Registrar y usar un proyecto:

```bash
pnpm relay-baton project add /path/to/repo --name relay-baton --diet caveman --primary codex --fallback claude
pnpm relay-baton project switch relay-baton
pnpm relay-baton status --project relay-baton
pnpm relay-baton budget --project relay-baton
pnpm relay-baton tui --project relay-baton
```

## 🤖 Instalación con una sola línea vía un agente

[`install/install.md`](../../install/install.md) es a la vez una guía para humanos y un *instruction surface* que Codex / Claude Code pueden seguir tal cual.

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 Requisitos

| Ítem | Versión / Nota |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | requerido |
| `codex` | **requiere suscripción ChatGPT Plus o superior** |
| `claude` | **requiere suscripción Claude Pro o superior** |

> ### 💳 Aviso de suscripción
>
> relay-baton **no llama directamente** a la API de OpenAI / Anthropic. Utiliza la **autenticación por suscripción** de los CLIs locales.
> - Las cuentas gratuitas no funcionarán de forma fiable.
> - La autenticación por API key está **bloqueada por defecto** detrás de `--allow-api-key-env` para evitar facturación accidental por uso.

## 🔑 Inicio de sesión

```bash
pnpm relay-baton login           # ambos
pnpm relay-baton login codex
pnpm relay-baton login claude
```

Que `claude --version` funcione **no** significa que estés logueado. Si ves "Not logged in", vuelve a ejecutar el comando.

## 🧭 Comandos

| Comando | Descripción |
|---|---|
| `relay-baton init` | Crear `.ai-session/` |
| `relay-baton doctor` | Diagnóstico del entorno |
| `relay-baton login [agent]` | Login a Codex / Claude |
| `relay-baton run "<tarea>"` | Ejecuta Codex, detecta fallback, traspasa a Claude |
| `relay-baton handoff --to claude` | Traspaso manual |
| `relay-baton compact` | Reconstruye compact-state, repo-map, full-diff |
| `relay-baton budget` | Muestra el presupuesto de contexto |
| `relay-baton compress <archivo>` | Compactación determinista de Markdown |
| `relay-baton status` | Estado de la sesión |
| `relay-baton tui` | TUI con Ink |

## 📉 Perfiles de dieta

`off` · `lite` · `balanced` *(por defecto)* · `caveman` · `ultra`

> `caveman` **no** es un tono jocoso — significa *aggressive minimal-context*. La precisión técnica se conserva.

## 🛡️ Seguridad de auth & facturación

- **Nunca** almacena, imprime ni registra API keys.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` se eliminan del entorno de procesos hijos por defecto.

## 🎯 Principios de diseño

1. Es **traspaso de trabajo**, no chat relay.
2. El **estado actual del repositorio** prevalece sobre el historial de conversación.
3. El traspaso debe ser **legible por humanos**.
4. Toda UI es una capa fina sobre `core`.
5. **La dieta de tokens no es una función secundaria — es la función central.**

## 📄 Licencia

MIT. Ver [`LICENSE`](../../LICENSE).

> ℹ️ Documentación completa en [English README](../../README.md) y [`install/install.md`](../../install/install.md).
