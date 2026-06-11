<div align="center">

# relay-baton

**Infraestrutura portátil de continuação para agentes de codificação.**

Passa estado de codificação comprimido entre Codex CLI, Claude Code e o que vier a seguir — sem recolar o log do chat, o diff ou o repositório.

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · **Português**
 · [Русский](./README.ru.md)

</div>

```bash
# Codex bate num muro de quota no meio da tarefa. relay-baton detecta,
# constrói um handoff compacto a partir do estado real do repo, e Claude continua.
$ relay-baton run "refatorar o pipeline de upload" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Por que existe

O trabalho de codificação com IA está se fragmentando entre ferramentas. Uma sessão real fica assim:

- Codex CLI para um lote de edições.
- Claude Code para outro.
- Um laptop pela manhã, outra máquina à noite.
- Uma context window que enche, quebra ou trunca em silêncio.

A forma padrão hoje de mover trabalho entre agentes é **copiar e colar o log do chat** — ou pior, despejar o repo inteiro num prompt. Três problemas:

1. **Tokens.** Logs de chat são em sua maioria ruído. Você paga por esse ruído a cada turno.
2. **Continuidade.** O próximo agente recebe transcript, não *intenção*.
3. **Fragilidade.** Um arquivo perdido, um diff defasado, e o agente reinicia de uma premissa errada.

relay-baton é um **harness local** que fica sob os agentes e transporta o *estado mínimo suficiente* através do handoff: um resumo compacto, um repo map e referências de arquivo — não um transcript.

> **Gaste o mínimo de tokens possível enquanto unifica Codex CLI e Claude Code CLI num único fluxo.**

## A ideia

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

Um baton-pass para agentes de codificação — primitiva em 4 passos:

- **Detect** detecta quando o agente atual deixa de ser útil (quota, context, rate, errors).
- **Capture** captura só o que importa (estado do repo, arquivos alterados, decisões, próximo passo).
- **Compact** comprime dentro de um orçamento que o próximo agente consegue consumir.
- **Hand off** entrega apenas depois dos quality gates.

O handoff é um arquivo pequeno (`.ai-session/handoff.md`) mais referências. Tudo pesado (diff completo, log completo, repo map completo) fica em disco e é carregado sob demanda.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # login Codex + Claude
pnpm relay-baton doctor         # checagem de ambiente
pnpm relay-baton run "Corrigir o fluxo de upload de anexos de e-mail" --diet balanced
```

## Fluxo de trabalho

```bash
$ relay-baton init                  # cria .ai-session/
$ relay-baton run "corrigir teste flaky de upload" --diet balanced
... a saída do codex flui ao vivo ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude retoma, edita arquivos, termina ...

$ relay-baton status                # estado da sessão
$ relay-baton budget                # uso do budget do diet
```

Handoff manual sem fallback automático:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Troca entre múltiplos repositórios:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "conectar o novo metrics endpoint"
```

## Recursos

- **Fallback automático** — Detecta `quota exceeded`, `rate limit exceeded`, `maximum context length` etc. na saída do agente. Pula linhas tipo grep e prosa que explica esses padrões (evita falsos positivos).
- **Token diet** — 5 profiles determinísticos (`off · lite · balanced · caveman · ultra`). Lock/build/min excluídos, tail de logs, repo map no lugar do fonte.
- **Quality gates** — Completude e budget verificados *antes* do lançamento do fallback.
- **Auth-safe por padrão** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` removidos dos subprocesses. Opt-in só via `--allow-api-key-env`. Nunca armazenados, impressos ou logados.
- **Project registry** — Registre múltiplos repos uma vez, execute em qualquer um com `--project` ou `--path`.
- **Ink TUI** — Dashboard de project / sessão. Nunca lança agentes.
- **Sem API própria** — relay-baton não chama a API da OpenAI / Anthropic. Só subprocess locais `codex` / `claude`.

## Comandos

| Comando | Descrição |
|---|---|
| `relay-baton init` | Cria `.ai-session/` no repo atual |
| `relay-baton doctor` | Checa git / codex / claude / env / config (`--deep` para diagnóstico estendido) |
| `relay-baton verify` | Verificação end-to-end simulada — sem chamadas reais ao modelo |
| `relay-baton login [agent]` | Fluxos de login Codex / Claude |
| `relay-baton run "<task>"` | Roda agente primário + detecta fallback + handoff |
| `relay-baton handoff --to claude` | Handoff manual (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | Lista o handoff atual + backups (apenas metadados) |
| `relay-baton plan "<task>"` | Plan-execute: o planejador escreve `plan.md` (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: o executor implementa `plan.md` (`--with`, `--from`) |
| `relay-baton compress-context` | Comprime o contexto vivo (state.md / commands.log) (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | Regera compact-state / repo-map / full-diff |
| `relay-baton budget` | Mostra uso do context budget |
| `relay-baton compress <file>` | Compressão determinística de markdown |
| `relay-baton status` | Estado da sessão |
| `relay-baton project add/list/switch/current/doctor/remove` | Gerencia registry de projects |
| `relay-baton tui` | Dashboard Ink |

Comandos com awareness de project aceitam `--project <name-or-id>` e `--path <repoPath>`. Prioridade: `--path` > `--project` > project ativo > cwd.

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

Caminho padrão: `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE` faz override (CI, sandbox, testes). Arquivo corrompido é salvo como `projects.json.corrupt-<timestamp>.bak` e o registry é resetado vazio — comandos continuam funcionando.

## Token diet profiles

| Profile | Intenção |
|---|---|
| `off` | Truncamento mínimo |
| `lite` | Limpeza leve |
| `balanced` *(padrão)* | Uso diário |
| `caveman` | Mínimo agressivo |
| `ultra` | Compressão extrema |

> `caveman` **não é tom jocoso** — significa *aggressive minimal-context*. Precisão técnica é preservada.

## Frente às alternativas

| Abordagem | O que é levado | Custo em tokens | Continuidade | Modo de falha |
|---|---|---|---|---|
| v1.5.0-alpha.0 | [Read →](../../release-notes/v1.5.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.5.0-alpha.0.md) | Git tracking first cut: read-only `relay-baton git status --json`, non-git project fallback, desktop Git panel, and `/git` in Agent Room. |
| Export bruto do chat | Transcript inteiro | Alto (a maior parte é ruído) | Frágil — agente relê seu próprio raciocínio | Estouro da context window |
| Copy-paste prompting | O que o humano lembrou | Variável | Quebradiço | Drift silencioso do estado real |
| Dump do repo inteiro | Tudo | Muito alto | Forte mas caro | Modelo trunca no meio do arquivo |
| **relay-baton** | Resumo compacto + repo map + referências | **Baixo, limitado por profile** | Forte — guiado pelo estado *real* do repo | Falha *de forma ruidosa* via quality gates |

## Filosofia

relay-baton é **ferramental pequeno e afiado para workflows de desenvolvimento AI-native**.

- **Local-first.** Tudo vive no seu disco. Sem nuvem, sem daemon, sem telemetria, sem conta.
- **Composabilidade.** Um diretório `.ai-session/` são só arquivos. Leia, grep, diff, anexe num PR.
- **Transferência de estado leve.** Um handoff é um arquivo markdown, não um banco de dados.
- **Determinístico antes de esperto.** Sem sumarização LLM dentro do harness — se o modelo erra o resumo, o handoff mente. Só budgets de caractere, regras estruturais e referências explícitas.
- **Estado do repo é a fonte da verdade.** Conversa é interpretação; repo é fato.
- **Eficiência de tokens é a feature** — não um botão escondido num menu.

### Princípios de design

1. É **work handoff**, não chat relay.
2. **Estado atual do repositório** vence qualquer histórico de conversa.
3. O handoff precisa ser **legível por humano**.
4. Cada UI é uma casca fina sobre `core`.
5. **Token diet não é feature secundária — é a feature principal.**

## Direção futura

relay-baton começa como harness de fallback de dois agentes. A mesma primitiva escala mais longe:

- **Cadeias de relay multi-agente** — Codex → Claude → OpenCode → de volta a Codex.
- **Árvores de sessão com bifurcação** — Forka uma tarefa em tentativas paralelas; reconcilia via diffs.
- **Estado de relay remoto** — Push de `.ai-session/` para um remote compartilhado para a próxima máquina retomar.
- **Workflows orquestrados** — Modos `review`, `diagnose`, `continue` (autopilot limitado com checkpoints explícitos).
- **Mais adapters** — OpenCode, Gemini CLI, Aider, qualquer coisa com interface subprocess local sã.

A forma do harness não muda: detect, capture, compact, hand off.

## Requisitos

| Item | Versão / Nota |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | obrigatório |
| `codex` | **requer assinatura ChatGPT Plus ou superior** |
| `claude` | **requer assinatura Claude Pro ou superior** |

> relay-baton não chama diretamente a API da OpenAI / Anthropic. Usa a **autenticação por assinatura** das CLIs locais `codex` / `claude`. Auth por API key é tecnicamente possível, mas **bloqueada por padrão** (opt-in via `--allow-api-key-env`).

## Login

```bash
pnpm relay-baton login           # ambos
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` passar **não** significa que você está logado. Se aparecer "Not logged in", rode novamente o comando acima.

## Notas de versão

**Latest:** v1.5.0-alpha.0 — [English](../../release-notes/v1.5.0-alpha.0.md) · [한국어](../../release-notes/ko/v1.5.0-alpha.0.md)

| Versão | English | 한국어 | Resumo |
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
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify` (E2E simulado, sem chamadas ao modelo), `doctor --deep`, painel de modo na TUI, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | Modo plan-execute (`plan` / `execute`) + compressão de contexto (`compress-context`). |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | CI do GitHub Actions, testes, observabilidade de sessão, `handoff history`. |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` sem efeitos colaterais, backup/recuperação automática de `projects.json` corrompido, override via env `RELAY_BATON_PROJECTS_FILE`, limpeza de `lastError` em fallback. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Adiciona project registry, `--project` / `--path`, comandos de project e dashboard TUI. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | MVP de handoff Codex-to-Claude com token diet, fallback detection e quality gates. |

## License

MIT. Detalhes em [`LICENSE`](../../LICENSE).

> Documentação completa (detalhes dos quality gates, semântica dos arquivos `.ai-session/`, schema de config, atalhos do TUI, troubleshooting) em [English README](../../README.md) e [`install/install.md`](../../install/install.md).
