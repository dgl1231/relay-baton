<div align="center">

# relay-baton

**Переносимая инфраструктура продолжения для кодирующих агентов.**

Передаёт сжатое состояние кодинга между Codex CLI, Claude Code и тем, что появится дальше — без повторной вставки чат-лога, диффа или репозитория.

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · **Русский**

</div>

```bash
# Codex упирается в стену квоты посреди задачи. relay-baton замечает,
# собирает компактный handoff из реального состояния репо, Claude продолжает.
$ relay-baton run "рефакторинг upload-пайплайна" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Зачем это существует

AI-кодинг фрагментируется между инструментами. Реальная сессия выглядит так:

- Codex CLI для одной пачки правок.
- Claude Code для другой.
- Ноутбук утром, другая машина вечером.
- Context window, которое переполняется, ломается или молча обрезается.

Сегодняшний способ по умолчанию переносить работу между агентами — **копипастить чат-лог** — или, ещё хуже, заливать в prompt весь репозиторий. Три проблемы:

1. **Токены.** Чат-логи — это в основном шум. Ты платишь за этот шум каждый ход.
2. **Непрерывность.** Следующий агент получает не *намерение*, а транскрипт.
3. **Хрупкость.** Один пропущенный файл, один устаревший дифф, и агент стартует с неверной предпосылки.

relay-baton — **локальный harness**, который ложится под агентов и переносит через передачу только *минимально достаточное состояние*: компактное саммари, repo map и ссылки на файлы — а не транскрипт.

> **Тратить как можно меньше токенов, объединяя Codex CLI и Claude Code CLI в один рабочий процесс.**

## Идея

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

Передача эстафеты для кодирующих агентов — примитив из 4 шагов:

- **Detect** определить, когда текущий агент перестал быть полезным (quota, context, rate, errors).
- **Capture** собрать только важное (состояние репо, изменённые файлы, решения, следующий шаг).
- **Compact** сжать в бюджет, который следующий агент реально потянет.
- **Hand off** передать только после прохождения quality gates.

Handoff — небольшой файл (`.ai-session/handoff.md`) плюс ссылки. Всё тяжёлое (полный дифф, полный лог, полный repo map) лежит на диске и подгружается по запросу.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # войти в Codex + Claude
pnpm relay-baton doctor         # проверка окружения
pnpm relay-baton run "Починить поток загрузки вложений" --diet balanced
```

## Рабочий процесс

```bash
$ relay-baton init                  # создать .ai-session/
$ relay-baton run "починить нестабильный upload-тест" --diet balanced
... вывод codex стримится вживую ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude подхватывает, редактирует файлы, завершает ...

$ relay-baton status                # состояние сессии
$ relay-baton budget                # расход бюджета diet
```

Ручной handoff без авто-fallback:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Переключение между репозиториями:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "подключить новый metrics endpoint"
```

## Возможности

- **Автоматический fallback** — Ловит `quota exceeded`, `rate limit exceeded`, `maximum context length` и т. п. в выводе агента. Строки в стиле grep и проза, объясняющая сами паттерны, пропускаются (защита от ложных срабатываний).
- **Token diet** — 5 детерминированных профилей сжатия (`off · lite · balanced · caveman · ultra`). Lock/build/min исключены, tail логов, repo map вместо исходников.
- **Quality gates** — Полнота и бюджет проверяются *до* запуска fallback-агента.
- **Auth-safe по умолчанию** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` срезаются с child-процессов. Opt-in только через `--allow-api-key-env`. Ключи никогда не хранятся, не печатаются, не пишутся в лог.
- **Project registry** — Зарегистрируй несколько репо один раз, выполняй команды против любого через `--project` или `--path`.
- **Ink TUI** — Дашборд project / session. Никогда не запускает агентов.
- **Никаких собственных API** — relay-baton не зовёт OpenAI / Anthropic API напрямую. Только локальные subprocess `codex` / `claude`.

## Команды

| Команда | Описание |
|---|---|
| `relay-baton init` | Создать `.ai-session/` в текущем репо |
| `relay-baton doctor` | Проверка git / codex / claude / env / config (`--deep` для расширенной диагностики) |
| `relay-baton verify` | Симулированная сквозная проверка — без реальных вызовов модели |
| `relay-baton login [agent]` | Логин-флоу Codex / Claude |
| `relay-baton run "<task>"` | Запустить основного агента + детект fallback + handoff |
| `relay-baton handoff --to claude` | Ручной handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | Список текущего + резервных handoff-документов (только метаданные) |
| `relay-baton plan "<task>"` | Plan-execute: планировщик пишет `plan.md` (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: исполнитель реализует `plan.md` (`--with`, `--from`) |
| `relay-baton compress-context` | Сжать текущий контекст (state.md / commands.log) (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | Пересобрать compact-state / repo-map / full-diff |
| `relay-baton budget` | Показать расход context budget |
| `relay-baton compress <file>` | Детерминированное сжатие markdown |
| `relay-baton status` | Статус сессии |
| `relay-baton project add/list/switch/current/doctor/remove` | Управление project registry |
| `relay-baton tui` | Ink dashboard |

Project-aware команды принимают `--project <name-or-id>` и `--path <repoPath>`. Приоритет: `--path` > `--project` > активный project > cwd.

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

Путь по умолчанию: `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE` переопределяет путь (CI, sandbox, тесты). Повреждённый файл сохраняется как `projects.json.corrupt-<timestamp>.bak`, registry сбрасывается в пустой — команды продолжают работать.

## Token diet profiles

| Profile | Назначение |
|---|---|
| `off` | Минимум обрезок |
| `lite` | Лёгкая чистка |
| `balanced` *(по умолчанию)* | Повседневное использование |
| `caveman` | Агрессивный минимум |
| `ultra` | Экстремальное сжатие |

> `caveman` — **не шутливый тон**, а *aggressive minimal-context*. Техническая точность сохраняется.

## Сравнение

| Подход | Что переносится | Стоимость в токенах | Непрерывность | Режим отказа |
|---|---|---|---|---|
| v1.5.0-alpha.0 | [Read →](../../release-notes/v1.5.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.5.0-alpha.0.md) | Git tracking first cut: read-only `relay-baton git status --json`, non-git project fallback, desktop Git panel, and `/git` in Agent Room. |
| Сырой chat export | Весь транскрипт | Высокая (в основном шум) | Хрупкая — агент перечитывает собственное мышление | Переполнение context window |
| Копипаст prompting | Что запомнил человек | Переменная | Ломкая | Тихий дрифт от реального состояния |
| Дамп всего репо | Всё | Очень высокая | Сильная, но дорогая | Модель обрезает посреди файла |
| **relay-baton** | Компактное саммари + repo map + ссылки на файлы | **Низкая, ограничена профилем** | Сильная — двигается *реальным* состоянием репо | Падает *явно* через quality gates |

## Философия

relay-baton — **маленький острый инструментарий для AI-native workflow разработки**.

- **Local-first.** Всё живёт у тебя на диске. Никакого облака, демона, телеметрии, аккаунта.
- **Композируемость.** Директория `.ai-session/` — это просто файлы. Читай, grep, diff, прикладывай в PR.
- **Лёгкая передача состояния.** Handoff — markdown-файл, не база данных.
- **Детерминированность важнее ума.** Никакой LLM-сумаризации внутри harness — если модель ошибётся в выжимке, handoff соврёт. Только бюджеты символов, структурные правила и явные ссылки.
- **Состояние репо — источник истины.** Разговор — интерпретация; репо — факт.
- **Эффективность по токенам — это и есть фича** — а не переключатель, спрятанный в меню.

### Принципы дизайна

1. Это **work handoff**, а не chat relay.
2. **Текущее состояние репо** важнее любой истории разговора.
3. Handoff обязан быть **читаемым человеком**.
4. Любой UI — тонкая оболочка над `core`.
5. **Token diet — не сбоку, а в центре.**

## Куда дальше

relay-baton стартует как двухагентный fallback-harness. Тот же примитив масштабируется дальше:

- **Многоагентные relay-цепочки** — Codex → Claude → OpenCode → обратно к Codex.
- **Ветвящиеся деревья сессий** — Форкаем задачу в параллельные попытки агентов; примиряем через дифы.
- **Удалённое relay state** — Push `.ai-session/` в общий remote, чтобы следующая машина подхватила.
- **Оркестрированные workflow** — Режимы `review`, `diagnose`, `continue` (ограниченный autopilot с явными чекпойнтами).
- **Больше adapter'ов** — OpenCode, Gemini CLI, Aider, что угодно с вменяемым локальным subprocess-интерфейсом.

Форма harness не меняется: detect, capture, compact, hand off.

## Требования

| Item | Версия / Замечание |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | обязательно |
| `codex` | **требуется подписка ChatGPT Plus или выше** |
| `claude` | **требуется подписка Claude Pro или выше** |

> relay-baton не зовёт OpenAI / Anthropic API напрямую. Использует **аутентификацию по подписке** локальных CLI `codex` / `claude`. Аутентификация по API key технически возможна, но **по умолчанию заблокирована** (opt-in через `--allow-api-key-env`).

## Логин

```bash
pnpm relay-baton login           # оба
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` отрабатывает — это **не** значит, что ты залогинен. Если видишь "Not logged in", запусти команду выше снова.

## Заметки о релизах

**Latest:** v1.5.0-alpha.1 — [English](../../release-notes/v1.5.0-alpha.1.md) · [한국어](../../release-notes/ko/v1.5.0-alpha.1.md)

| Версия | English | 한국어 | Кратко |
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
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify` (симулированный E2E, без вызовов модели), `doctor --deep`, панель режима в TUI, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | Режим plan-execute (`plan` / `execute`) + сжатие контекста (`compress-context`). |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | CI на GitHub Actions, тесты, наблюдаемость сессии, `handoff history`. |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` без побочных эффектов, автоматический бэкап/восстановление повреждённого `projects.json`, переопределение через env `RELAY_BATON_PROJECTS_FILE`, очистка `lastError` при fallback. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Добавляет project registry, `--project` / `--path`, project CLI и TUI dashboard. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | MVP Codex-to-Claude handoff с token diet, fallback detection и quality gates. |

## License

MIT. Подробности в [`LICENSE`](../../LICENSE).

> Полная документация (детали quality gate, семантика файлов `.ai-session/`, схема config, горячие клавиши TUI, troubleshooting) — в [English README](../../README.md) и [`install/install.md`](../../install/install.md).
