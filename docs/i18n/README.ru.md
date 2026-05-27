<div align="center">

# ⚡ relay-baton

**Token-осознанный harness для передачи работы между Codex CLI ↔ Claude Code**

Передавайте эстафету от одного кодинг-агента к другому — без перерасхода токенов.

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

---

> **Миссия проекта**
>
> 💡 **Тратить как можно меньше токенов, объединяя Codex CLI и Claude Code CLI в единый рабочий процесс.**
>
> Когда один агент упирается в лимит quota / context, следующий продолжает работу из того же состояния репозитория — без повторной вставки логов, diff'а или всего репозитория. Передаётся только *компактный handoff* и *ссылки на файлы*. Поэтому relay-baton — это *token diet harness*: это не дополнительная фича, а причина существования проекта.

## ✨ Возможности

- 🪄 **Автоматический fallback** — Распознаёт фразы `quota exceeded`, `rate limit exceeded`, `maximum context length` в выводе Codex и автоматически передаёт работу Claude Code.
- 📉 **Диета токенов** — Пять профилей (`off · lite · balanced · caveman · ultra`) с детерминированной компакцией.
- 🛡️ **Безопасная аутентификация по умолчанию** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` по умолчанию **не передаются** в дочерние процессы.
- ✅ **Quality gates** — Проверяют полноту handoff и бюджет токенов *до* запуска fallback-агента.
- 🧰 **Login в один шаг** — `relay-baton login` запускает родные auth-флоу обоих CLI.
- 🎛️ **Ink TUI** — Состояние сессии, доступность агентов, бюджет — всё на одном экране.
- 🚫 **Никаких прямых вызовов API** — только subprocess'ы локальных CLI.

## 🚀 Быстрый старт

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "Почини флоу загрузки вложений в почте" --diet balanced
```

## 🤖 Установка через агента одной строкой

[`install/install.md`](../../install/install.md) — одновременно руководство для человека и *instruction surface*, который Codex / Claude Code могут выполнить как есть.

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 Требования

| Пункт | Версия / Примечание |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | обязательно |
| `codex` | **требуется подписка ChatGPT Plus или выше** |
| `claude` | **требуется подписка Claude Pro или выше** |

> ### 💳 О подписках
>
> relay-baton **никогда не вызывает** API OpenAI / Anthropic напрямую. Он использует **подписочную авторизацию** локальных CLI.
> - Бесплатные аккаунты не подойдут.
> - Авторизация через API-ключ технически возможна, но **по умолчанию заблокирована** за флагом `--allow-api-key-env`, чтобы избежать случайной поминутной оплаты.

## 🔑 Вход

```bash
pnpm relay-baton login           # оба
pnpm relay-baton login codex
pnpm relay-baton login claude
```

Успешный `claude --version` **не** означает, что вы залогинены. Если видите "Not logged in" — запустите команду повторно.

## 🧭 Команды

| Команда | Описание |
|---|---|
| `relay-baton init` | Создать `.ai-session/` |
| `relay-baton doctor` | Проверка окружения |
| `relay-baton login [agent]` | Логин Codex / Claude |
| `relay-baton run "<task>"` | Запуск Codex с автопередачей Claude при fallback |
| `relay-baton handoff --to claude` | Ручной handoff |
| `relay-baton compact` | Перегенерировать compact-state / repo-map / full-diff |
| `relay-baton budget` | Показать использование контекстного бюджета |
| `relay-baton compress <file>` | Детерминированная компакция Markdown |
| `relay-baton status` | Статус сессии |
| `relay-baton tui` | Ink TUI |

## 📉 Профили диеты

`off` · `lite` · `balanced` *(по умолчанию)* · `caveman` · `ultra`

> `caveman` — **не** шутливая тональность. Это *aggressive minimal-context*. Техническая точность сохраняется.

## 🛡️ Безопасность auth и биллинга

- API-ключи **никогда** не сохраняются, не печатаются, не логируются.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` удаляются из окружения дочерних процессов по умолчанию.

## 🎯 Принципы проектирования

1. Это **передача работы**, а не чат-реле.
2. **Актуальное состояние репозитория** важнее истории диалога.
3. Handoff должен быть **читаемым человеком**.
4. Любой UI — лишь тонкая обёртка над `core`.
5. **Диета токенов — не второстепенная фича, а суть проекта.**

## 📄 Лицензия

MIT. См. [`LICENSE`](../../LICENSE).

> ℹ️ Полная документация — в [English README](../../README.md) и [`install/install.md`](../../install/install.md).
