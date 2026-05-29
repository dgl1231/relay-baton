<div align="center">

# relay-baton

**Portable Fortsetzungs-Infrastruktur für Coding-Agents.**

Übergibt komprimierten Coding-State zwischen Codex CLI, Claude Code und allem, was als Nächstes kommt — ohne Chat-Log, Diff oder Repo erneut einzufügen.

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

```bash
# Codex läuft mitten in der Aufgabe gegen eine Quota-Wand. relay-baton erkennt das,
# baut aus dem tatsächlichen Repo-State einen compacten Handoff, Claude übernimmt.
$ relay-baton run "Upload-Pipeline refactoren" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Warum es existiert

KI-Coding-Arbeit fragmentiert sich über Tools hinweg. Eine echte Session sieht so aus:

- Codex CLI für eine Reihe von Edits.
- Claude Code für eine andere.
- Morgens am Laptop, abends an einer anderen Maschine.
- Ein Context-Window, das vollläuft, kippt oder lautlos abschneidet.

Heute ist die Standard-Methode, Arbeit zwischen Agents zu verschieben, **das Chat-Log copy-pasten** — oder schlimmer, das ganze Repo in einen Prompt zu kippen. Drei Probleme:

1. **Tokens.** Chat-Logs sind größtenteils Rauschen. Du zahlst dieses Rauschen pro Turn.
2. **Kontinuität.** Der nächste Agent bekommt *kein Intent*; er bekommt Transcripts.
3. **Fragilität.** Eine vergessene Datei, ein veralteter Diff, und der Agent startet von falscher Prämisse neu.

relay-baton ist ein **lokaler Harness**, der unter den Agents sitzt und nur den *minimal hinreichenden State* über den Handoff trägt: ein compacter Summary, eine Repo-Map und File-Referenzen — keinen Transcript.

> **Verbrauche so wenig Tokens wie möglich, während du Codex CLI und Claude Code CLI in einen einzigen Workflow fusionierst.**

## Die Idee

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

Eine Staffelstabübergabe für Coding-Agents — Primitive in 4 Schritten:

- **Detect** erkennt, wenn der aktuelle Agent nicht mehr nützlich ist (Quota, Context, Rate, Errors).
- **Capture** sammelt nur das Wichtige (Repo-State, geänderte Dateien, Entscheidungen, nächster Schritt).
- **Compact** komprimiert in ein Budget, das der nächste Agent tatsächlich verarbeiten kann.
- **Hand off** übergibt nur nach bestandenen Quality Gates.

Der Handoff ist eine kleine Datei (`.ai-session/handoff.md`) plus Referenzen. Alles Schwere (kompletter Diff, komplettes Log, komplette Repo-Map) bleibt auf Disk und wird on-demand geladen.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # Codex + Claude einloggen
pnpm relay-baton doctor         # Umgebungs-Check
pnpm relay-baton run "Den Mail-Anhang-Upload-Flow reparieren" --diet balanced
```

## Workflow

```bash
$ relay-baton init                  # .ai-session/ anlegen
$ relay-baton run "flaky upload test fixen" --diet balanced
... codex-Output streamt live ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude übernimmt, editiert Dateien, beendet ...

$ relay-baton status                # Session-Status
$ relay-baton budget                # Diet-Budget-Nutzung
```

Manueller Handoff ohne Auto-Fallback:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Zwischen mehreren Repos wechseln:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "neuen metrics-endpoint verdrahten"
```

## Features

- **Automatischer Fallback** — Erkennt `quota exceeded`, `rate limit exceeded`, `maximum context length` etc. im Agent-Output. Grep-Result-Zeilen und erklärender Fließtext zu den Patterns werden übersprungen (False-Positive-Schutz).
- **Token Diet** — 5 deterministische Compaction-Profile (`off · lite · balanced · caveman · ultra`). Lock/Build/Min-Dateien ausgeschlossen, Log-Tails, Repo-Map statt Source.
- **Quality Gates** — Vollständigkeit und Budget werden *vor* dem Fallback-Launch verifiziert.
- **Auth-safe by default** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` werden aus Child-Processes entfernt. Opt-in nur via `--allow-api-key-env`. Keys werden nie gespeichert, ausgegeben oder geloggt.
- **Project Registry** — Mehrere Repos einmal registrieren, mit `--project` oder `--path` überall ausführen.
- **Ink TUI** — Project/Session-Dashboard. Startet niemals Agents.
- **Keine eigene API** — relay-baton ruft die OpenAI- / Anthropic-API nicht direkt auf. Nur lokale `codex`/`claude`-CLI-Subprocesses.

## Befehle

| Befehl | Beschreibung |
|---|---|
| `relay-baton init` | `.ai-session/` im aktuellen Repo anlegen |
| `relay-baton doctor` | git / codex / claude / env / config prüfen (`--deep` für erweiterte Diagnose) |
| `relay-baton verify` | Simulierter End-to-End-Check — keine echten Modellaufrufe |
| `relay-baton login [agent]` | Codex / Claude Login-Flows |
| `relay-baton run "<task>"` | Primärer Agent + Fallback-Erkennung + Handoff |
| `relay-baton handoff --to claude` | Manueller Handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | Aktuelles + gesicherte Handoff-Dokumente auflisten (nur Metadaten) |
| `relay-baton plan "<task>"` | Plan-execute: Planner schreibt `plan.md` (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: Executor setzt `plan.md` um (`--with`, `--from`) |
| `relay-baton compress-context` | Laufenden Kontext (state.md / commands.log) komprimieren (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | compact-state / repo-map / full-diff neu bauen |
| `relay-baton budget` | Context-Budget-Nutzung zeigen |
| `relay-baton compress <file>` | Deterministische Markdown-Komprimierung |
| `relay-baton status` | Session-Status |
| `relay-baton project add/list/switch/current/doctor/remove` | Project-Registry verwalten |
| `relay-baton tui` | Ink-Dashboard |

Project-Aware-Befehle akzeptieren `--project <name-or-id>` und `--path <repoPath>`. Priorität: `--path` > `--project` > aktives Projekt > cwd.

## Project Registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

Default-Pfad: `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE` überschreibt den Pfad (CI, Sandbox, Tests). Eine korrupte Datei wird als `projects.json.corrupt-<timestamp>.bak` gesichert und das Registry auf leer zurückgesetzt — Befehle laufen weiter.

## Token-Diet-Profile

| Profile | Intention |
|---|---|
| `off` | Minimale Truncation |
| `lite` | Leichte Bereinigung |
| `balanced` *(Standard)* | Alltag |
| `caveman` | Aggressiv minimal |
| `ultra` | Extrem |

> `caveman` ist **kein scherzhafter Ton** — es bedeutet *aggressive minimal-context*. Technische Genauigkeit bleibt erhalten.

## Vergleich

| Ansatz | Was übergeben wird | Token-Kosten | Kontinuität | Failure-Mode |
|---|---|---|---|---|
| Roher Chat-Export | Kompletter Transcript | Hoch (meist Rauschen) | Brüchig — Agent liest sein eigenes Denken erneut | Context-Window-Überlauf |
| Copy-Paste-Prompting | Was der Mensch erinnert | Variabel | Zerbrechlich | Silent Drift vom realen State |
| Komplettes Repo-Dump | Alles | Sehr hoch | Stark, aber teuer | Modell schneidet mittendrin ab |
| **relay-baton** | Compacter Summary + Repo-Map + File-Referenzen | **Niedrig, durch Profile begrenzt** | Stark — getrieben vom *realen* Repo-State | Schlägt *laut* fehl via Quality Gates |

## Philosophie

relay-baton ist **kleines, scharfes Tooling für AI-native Entwicklungs-Workflows**.

- **Local-first.** Alles liegt auf deiner Disk. Keine Cloud, kein Daemon, keine Telemetrie, kein Account.
- **Composability.** Ein `.ai-session/`-Ordner ist nur Dateien. Lies sie, grep sie, diff sie, häng sie an einen PR.
- **Leichter State-Transfer.** Ein Handoff ist eine Markdown-Datei, keine Datenbank.
- **Deterministisch vor clever.** Keine LLM-Zusammenfassung im Harness — wenn das Modell falsch zusammenfasst, lügt der Handoff. Nur Zeichen-Budgets, strukturelle Regeln, explizite Referenzen.
- **Repo-State ist die Quelle der Wahrheit.** Konversation ist Interpretation; das Repo ist Fakt.
- **Token-Effizienz ist das Feature** — kein verstecktes Menü-Setting.

### Design-Prinzipien

1. Es ist **Work-Handoff**, kein Chat-Relay.
2. Der **aktuelle Repository-State** schlägt jede Konversationshistorie.
3. Der Handoff muss **für Menschen lesbar** sein.
4. Jedes UI ist eine dünne Schale über `core`.
5. **Token-Diet ist kein Neben-Feature — es ist das Kern-Feature.**

## Zukunftsrichtung

relay-baton startet als Two-Agent-Fallback-Harness. Dieselbe Primitive skaliert weiter:

- **Multi-Agent-Relay-Ketten** — Codex → Claude → OpenCode → zurück zu Codex.
- **Verzweigte Session-Bäume** — Forke eine Aufgabe in parallele Agent-Versuche; mische via Diffs.
- **Remote-Relay-State** — Push von `.ai-session/` auf ein geteiltes Remote, damit die nächste Maschine übernehmen kann.
- **Orchestrierte Workflows** — `review`, `diagnose`, `continue` Modi (bounded autopilot mit expliziten Checkpoints).
- **Mehr Adapters** — OpenCode, Gemini CLI, Aider, alles mit sauberem lokalen Subprocess-Interface.

Die Form des Harness bleibt: detect, capture, compact, hand off.

## Voraussetzungen

| Item | Version / Hinweis |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | erforderlich |
| `codex` | **erfordert ChatGPT-Plus-Abo oder höher** |
| `claude` | **erfordert Claude-Pro-Abo oder höher** |

> relay-baton ruft die OpenAI/Anthropic-API nicht direkt auf. Es nutzt die **Abo-Auth** der lokalen `codex`/`claude`-CLIs. API-Key-Auth ist technisch möglich, aber **standardmäßig blockiert** (Opt-in via `--allow-api-key-env`).

## Login

```bash
pnpm relay-baton login           # beide
pnpm relay-baton login codex
pnpm relay-baton login claude
```

Dass `claude --version` durchläuft, heißt **nicht**, dass du eingeloggt bist. Bei "Not logged in" den obigen Befehl erneut ausführen.

## Release-Notes

**Aktuell** v0.9.0 — [English](../../release-notes/v0.9.0.md) · [한국어](../../release-notes/ko/v0.9.0.md)

| Version | English | 한국어 | Kurzfassung |
|---|---|---|---|
| v0.9.0 | [Read →](../../release-notes/v0.9.0.md) | [읽기 →](../../release-notes/ko/v0.9.0.md) | Automation & Runtime (bounded): LoopController, room /continue --max-steps N · /replan · /replay, relay-baton replay, adaptive per-agent compression thresholds. |
| v0.8.0 | [Read →](../../release-notes/v0.8.0.md) | [읽기 →](../../release-notes/ko/v0.8.0.md) | Adapter Expansion + Agent Room (first cut): OpenCode/Gemini/Aider adapter scaffolds, project-level fallback overrides, OS CI matrix, chat/room REPL. |
| v0.7.0 | [Read →](../../release-notes/v0.7.0.md) | [읽기 →](../../release-notes/ko/v0.7.0.md) | Review & Diagnose: review (deterministic diff-vs-plan), execution receipts, plan diffing, --json outputs, conversation event schema (draft). |
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify` (simulierter E2E, keine Modellaufrufe), `doctor --deep`, TUI-Mode-Panel, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | Plan-execute-Modus (`plan` / `execute`) + Kontextkompression (`compress-context`). |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | GitHub-Actions-CI, Tests, Session-Observability, `handoff history`. |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | Nebenwirkungsfreier `ProjectResolver`, automatisches Backup/Recovery bei beschädigter `projects.json`, `RELAY_BATON_PROJECTS_FILE`-Env-Override, `lastError`-Cleanup bei Fallback. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Fügt Project Registry, `--project` / `--path`, Project-CLI und TUI-Dashboard hinzu. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | Codex-to-Claude handoff MVP mit token diet, fallback detection und quality gates. |

## License

MIT. Details in [`LICENSE`](../../LICENSE).

> Vollständige Dokumentation (Quality-Gates-Details, Bedeutung der `.ai-session/`-Dateien, Config-Schema, TUI-Shortcuts, Troubleshooting) in [English README](../../README.md) und [`install/install.md`](../../install/install.md).
