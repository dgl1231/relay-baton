<div align="center">

# ⚡ relay-baton

**Token-bewusster Handoff-Harness für Codex CLI ↔ Claude Code**

Reiche den Staffelstab von einem Coding-Agent an den nächsten — ohne dein Token-Budget zu verschwenden.

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · **Deutsch**
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

---

> **Die Mission dieses Projekts**
>
> 💡 **So wenige Tokens wie möglich verbrauchen, während Codex CLI und Claude Code CLI in einen einzigen Workflow zusammengeführt werden.**
>
> Wenn ein Agent ein Quota- / Context-Limit erreicht, übernimmt der nächste exakt im selben Repository-Zustand — ohne Log, Diff oder Repo erneut komplett einzufügen. Übergeben werden nur ein *kompakter Handoff* und *Dateiverweise*. Deshalb ist relay-baton ein *Token-Diet-Harness* — kein Bonus-Feature, sondern der eigentliche Daseinsgrund.

## ✨ Features

- 🪄 **Automatischer Fallback** — Erkennt `quota exceeded`, `rate limit exceeded`, `maximum context length` in der Codex-Ausgabe und übergibt automatisch an Claude Code.
- 📉 **Token-Diet** — Fünf Profile (`off · lite · balanced · caveman · ultra`) mit deterministischer Kompaktierung.
- 🛡️ **Sichere Auth per Default** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` werden **standardmäßig nicht** an Kindprozesse weitergegeben.
- ✅ **Quality Gates** — Prüfen Handoff-Vollständigkeit und Token-Budget vor dem Start des Fallback-Agents.
- 🧰 **One-Shot-Login** — `relay-baton login` startet die Auth-Flows der CLIs.
- 🎛️ **Ink TUI** — Sitzungsstatus, Agent-Verfügbarkeit, Budget auf einen Blick.
- 🚫 **Keine eigenen API-Aufrufe** — ausschließlich lokale CLI-Subprozesse.

## 🚀 Schnellstart

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "Fix den Upload-Flow für E-Mail-Anhänge" --diet balanced
```

## 📝 Release Notes

| Version | English | 한국어 | Kurzfassung |
|---|---|---|---|
| v0.3.0 | [notes](../../release-notes/v0.3.0.md) | [릴리즈 노트](../../release-notes/ko/v0.3.0.md) | Nebenwirkungsfreier `ProjectResolver`, automatisches Backup/Recovery bei beschädigter `projects.json`, `RELAY_BATON_PROJECTS_FILE`-Env-Override, `lastError`-Cleanup bei Fallback. |
| v0.2.0 | [notes](../../release-notes/v0.2.0.md) | [릴리즈 노트](../../release-notes/ko/v0.2.0.md) | Fügt Project Registry, `--project` / `--path`, Project-CLI und TUI-Dashboard hinzu. |
| v0.1.0 | [notes](../../release-notes/v0.1.0.md) | [릴리즈 노트](../../release-notes/ko/v0.1.0.md) | Codex-to-Claude handoff MVP mit token diet, fallback detection und quality gates. |

## 🧭 Nutzung

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "Aufgabe" --diet balanced
pnpm relay-baton handoff --to claude --no-run --diet caveman
```

Projekt registrieren und verwenden:

```bash
pnpm relay-baton project add /path/to/repo --name relay-baton --diet caveman --primary codex --fallback claude
pnpm relay-baton project switch relay-baton
pnpm relay-baton status --project relay-baton
pnpm relay-baton budget --project relay-baton
pnpm relay-baton tui --project relay-baton
```

## 🤖 Ein-Zeilen-Installation via Agent

[`install/install.md`](../../install/install.md) ist sowohl ein menschenlesbarer Installationsleitfaden als auch eine Anleitung, die Codex / Claude Code direkt ausführen können.

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 Voraussetzungen

| Punkt | Version / Hinweis |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | erforderlich |
| `codex` | **ChatGPT Plus-Abo oder höher erforderlich** |
| `claude` | **Claude Pro-Abo oder höher erforderlich** |

> ### 💳 Hinweis zu Abos
>
> relay-baton **ruft die OpenAI-/Anthropic-API nicht direkt auf**. Es nutzt die **Abonnement-Authentifizierung** der lokalen CLIs.
> - Kostenlose Accounts funktionieren nicht zuverlässig.
> - API-Key-Auth ist technisch möglich, aber **standardmäßig blockiert** (`--allow-api-key-env` ist explizit notwendig), um versehentliche nutzungsbasierte Abrechnung zu verhindern.

## 🔑 Login

```bash
pnpm relay-baton login           # beide
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` zu erhalten bedeutet **nicht**, dass du eingeloggt bist. Bei "Not logged in" das Kommando erneut ausführen.

## 🧭 Befehle

| Befehl | Beschreibung |
|---|---|
| `relay-baton init` | `.ai-session/` anlegen |
| `relay-baton doctor` | Umgebungs-Check |
| `relay-baton login [agent]` | Codex / Claude Login |
| `relay-baton run "<task>"` | Codex starten, Fallback erkennen, an Claude übergeben |
| `relay-baton handoff --to claude` | Manueller Handoff |
| `relay-baton compact` | compact-state / repo-map / full-diff neu erzeugen |
| `relay-baton budget` | Kontext-Budget anzeigen |
| `relay-baton compress <datei>` | Deterministische Markdown-Kompaktierung |
| `relay-baton status` | Sitzungs-Status |
| `relay-baton tui` | Ink TUI |

## 📉 Diet-Profile

`off` · `lite` · `balanced` *(Default)* · `caveman` · `ultra`

> `caveman` ist **kein** alberner Tonfall — sondern *aggressive minimal-context*. Technische Genauigkeit bleibt erhalten.

## 🛡️ Auth & Abrechnungssicherheit

- API-Keys werden **nie** gespeichert, ausgegeben oder geloggt.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` werden per Default aus Kindprozess-Umgebungen entfernt.

## 🎯 Designprinzipien

1. Es ist **Work-Handoff**, kein Chat-Relay.
2. Der **aktuelle Repository-Zustand** schlägt jede Konversationshistorie.
3. Der Handoff muss **menschenlesbar** sein.
4. Jede UI ist nur eine dünne Hülle über `core`.
5. **Token-Diet ist kein Side-Feature — es ist das Kern-Feature.**

## 📄 Lizenz

MIT. Siehe [`LICENSE`](../../LICENSE).

> ℹ️ Vollständige Dokumentation in [English README](../../README.md) und [`install/install.md`](../../install/install.md).
