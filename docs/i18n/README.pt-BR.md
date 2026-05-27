<div align="center">

# ⚡ relay-baton

**Harness de handoff consciente de tokens entre Codex CLI ↔ Claude Code**

Passe o bastão de um agente de codificação para o próximo — sem desperdiçar seu orçamento de tokens.

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

---

> **Missão do projeto**
>
> 💡 **Gastar o mínimo possível de tokens ao mesclar Codex CLI e Claude Code CLI em um único fluxo de trabalho.**
>
> Quando um agente atinge um limite de quota / contexto, o próximo retoma exatamente no mesmo estado do repositório — sem recolar log, diff ou repo inteiros. O handoff carrega apenas um *resumo compacto* e *referências de arquivo*. Por isso o relay-baton é um *token diet harness*: não é um recurso extra, é a razão de existir do projeto.

## ✨ Recursos

- 🪄 **Fallback automático** — Detecta frases como `quota exceeded`, `rate limit exceeded`, `maximum context length` na saída do Codex e transfere para o Claude Code.
- 📉 **Dieta de tokens** — Cinco perfis (`off · lite · balanced · caveman · ultra`) com compactação determinística.
- 🛡️ **Auth segura por padrão** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` **não são repassadas** a processos filhos por padrão.
- ✅ **Quality gates** — Verificam completude do handoff e orçamento de tokens antes de lançar o agente fallback.
- 🧰 **Login em um comando** — `relay-baton login` executa o fluxo de auth de cada CLI.
- 🎛️ **TUI Ink** — Estado da sessão, disponibilidade de agentes e orçamento em uma única tela.
- 🚫 **Sem chamadas de API próprias** — apenas subprocessos de CLIs locais.

## 🚀 Início rápido

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "Conserte o fluxo de upload de anexos de email" --diet balanced
```

## 📝 Notas de versão

| Versão | English | 한국어 | Resumo |
|---|---|---|---|
| v0.3.0 | [notes](../../release-notes/v0.3.0.md) | [릴리즈 노트](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` sem efeitos colaterais, backup/recuperação automática de `projects.json` corrompido, override via env `RELAY_BATON_PROJECTS_FILE`, limpeza de `lastError` em fallback. |
| v0.2.0 | [notes](../../release-notes/v0.2.0.md) | [릴리즈 노트](../../release-notes/ko/v0.2.0.md) | Adiciona project registry, `--project` / `--path`, comandos de project e dashboard TUI. |
| v0.1.0 | [notes](../../release-notes/v0.1.0.md) | [릴리즈 노트](../../release-notes/ko/v0.1.0.md) | MVP de handoff Codex-to-Claude com token diet, fallback detection e quality gates. |

## 🧭 Uso

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "tarefa" --diet balanced
pnpm relay-baton handoff --to claude --no-run --diet caveman
```

Registrar e usar um projeto:

```bash
pnpm relay-baton project add /path/to/repo --name relay-baton --diet caveman --primary codex --fallback claude
pnpm relay-baton project switch relay-baton
pnpm relay-baton status --project relay-baton
pnpm relay-baton budget --project relay-baton
pnpm relay-baton tui --project relay-baton
```

## 🤖 Instalação via agente em uma linha

[`install/install.md`](../../install/install.md) é tanto um guia para humanos quanto um *instruction surface* que Codex / Claude Code seguem diretamente.

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 Requisitos

| Item | Versão / Nota |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | obrigatório |
| `codex` | **assinatura ChatGPT Plus ou superior necessária** |
| `claude` | **assinatura Claude Pro ou superior necessária** |

> ### 💳 Aviso de assinatura
>
> relay-baton **não chama** diretamente a API da OpenAI / Anthropic. Usa a **autenticação por assinatura** dos CLIs locais.
> - Contas gratuitas não funcionam de forma confiável.
> - Auth por API key é tecnicamente possível, mas **bloqueada por padrão** atrás de `--allow-api-key-env`, para evitar faturamento por uso não intencional.

## 🔑 Login

```bash
pnpm relay-baton login           # ambos
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` passar **não** significa que você está logado. Se aparecer "Not logged in", rode o comando novamente.

## 🧭 Comandos

| Comando | Descrição |
|---|---|
| `relay-baton init` | Criar `.ai-session/` |
| `relay-baton doctor` | Diagnóstico de ambiente |
| `relay-baton login [agent]` | Login Codex / Claude |
| `relay-baton run "<tarefa>"` | Roda Codex, detecta fallback, transfere para Claude |
| `relay-baton handoff --to claude` | Handoff manual |
| `relay-baton compact` | Recria compact-state / repo-map / full-diff |
| `relay-baton budget` | Mostra orçamento de contexto |
| `relay-baton compress <arquivo>` | Compactação determinística de Markdown |
| `relay-baton status` | Status da sessão |
| `relay-baton tui` | TUI Ink |

## 📉 Perfis de dieta

`off` · `lite` · `balanced` *(padrão)* · `caveman` · `ultra`

> `caveman` **não** é um tom brincalhão — significa *aggressive minimal-context*. Precisão técnica é preservada.

## 🛡️ Segurança de auth & cobrança

- API keys **nunca** são armazenadas, impressas ou logadas.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` são removidas do ambiente de processos filhos por padrão.

## 🎯 Princípios de design

1. É **handoff de trabalho**, não chat relay.
2. O **estado atual do repositório** prevalece sobre histórico de conversa.
3. O handoff deve ser **legível por humanos**.
4. Toda UI é apenas uma casca fina sobre `core`.
5. **A dieta de tokens não é um recurso secundário — é o recurso central.**

## 📄 Licença

MIT. Veja [`LICENSE`](../../LICENSE).

> ℹ️ Documentação completa em [English README](../../README.md) e [`install/install.md`](../../install/install.md).
