<div align="center">

# ⚡ relay-baton

**面向 Codex CLI ↔ Claude Code 的 Token 感知交接框架**

在不浪费 token 预算的前提下,把"接力棒"从一个 coding agent 传给另一个。

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · **简体中文**
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

---

> **项目核心使命**
>
> 💡 **以最少的 token 消耗,把 Codex CLI 与 Claude Code CLI 合并到同一条工作流中。**
>
> 当一个 agent 触发 quota / context 限制时,下一个 agent 在完全相同的仓库状态下接手继续。但不会把完整日志、diff、整个 repo 重新粘贴一次 —— 只传 **紧凑交接文档 + 文件引用**。这就是 relay-baton 之所以是 *token diet harness* 的原因,这不是附加功能,而是项目存在的根本理由。

`relay-baton` 是一个本地框架,自动化 **Codex CLI ↔ Claude Code CLI** 之间的工作交接。遇到 usage / context / quota 限制时,下一个 agent 从相同的仓库状态恢复工作,只传送 **紧凑交接 + 文件引用**。

## ✨ 特性

- 🪄 **自动 fallback** — 检测 Codex 输出中的 `quota exceeded`、`rate limit exceeded`、`maximum context length` 等短语,自动交给 Claude Code。
- 📉 **Token diet** — 5 个 profile (`off · lite · balanced · caveman · ultra`),确定性压缩(排除 lock/build/min,日志取尾、生成 repo map)。
- 🛡️ **默认安全的认证策略** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` **默认从子进程剥离**,需显式 opt-in。
- ✅ **Quality Gates** — 在启动 fallback agent 前校验 handoff 完整性与 token 预算。
- 🧰 **一键登录** — `relay-baton login` 调起 Codex / Claude CLI 自身的认证流程。
- 🎛️ **Ink TUI** — 一眼看到会话状态、agent 可用性、预算。
- 🚫 **本工具不直接调用 API** — 仅 spawn 本地 CLI。

## 🚀 快速开始

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "修复邮件附件上传流程" --diet balanced
```

## 🤖 让 agent 一句话装好

[`install/install.md`](../../install/install.md) 既是给人看的安装指南,也是给 Codex / Claude Code 直接执行的指令书。

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys. End by running 'pnpm relay-baton doctor'."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 环境要求

| 项 | 版本 / 备注 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必需 |
| `codex` | **需 ChatGPT Plus 或更高订阅** |
| `claude` | **需 Claude Pro 或更高订阅** |

> ### 💳 订阅说明
>
> relay-baton **不会直接调用** OpenAI / Anthropic API,而是直接使用本地 `codex` / `claude` CLI 的 **订阅认证**。
> - Codex CLI → ChatGPT **Plus / Pro / Team / Enterprise**
> - Claude Code CLI → Anthropic **Claude Pro / Max / Team / Enterprise**
> - 免费账户无法稳定使用。
> - 也支持 API key 认证,但**默认被拦截**(避免意外按量计费),需 `--allow-api-key-env`。

## 🔑 登录

```bash
pnpm relay-baton login           # 同时
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` 通过 **不代表** 已登录。如果看到 "Not logged in",重新执行上面的命令即可。

## 🧭 命令

| Command | 说明 |
|---|---|
| `relay-baton init` | 创建 `.ai-session/` |
| `relay-baton doctor` | 环境检查 |
| `relay-baton login [agent]` | Codex / Claude 登录 |
| `relay-baton run "<task>"` | 跑 Codex + fallback 检测 + 移交 Claude |
| `relay-baton handoff --to claude` | 手动交接 |
| `relay-baton compact` | 重建 compact-state / repo-map / full-diff |
| `relay-baton budget` | 当前 context 预算 |
| `relay-baton compress <file>` | Markdown 确定性压缩 |
| `relay-baton status` | 会话状态 |
| `relay-baton tui` | Ink TUI |

## 📉 Diet profiles

`off` · `lite` · `balanced` *(默认)* · `caveman` · `ultra`

> `caveman` **不是搞笑口吻**,而是 *aggressive minimal-context* 的简写。技术准确度保持不变。

## 🛡️ 认证 / 账单安全

- **不存储、不打印、不写入** API key。
- 默认从子进程剥离 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。
- 仅在显式 opt-in 时通过。

## 🎯 设计原则

1. 这是 **work handoff**,不是 chat relay。
2. 比起对话历史,**当前仓库状态** 优先。
3. handoff 必须 **人也能读懂**。
4. 所有 UI 都只是 core 的薄壳。
5. **Token diet 不是附加功能,是核心功能。**

## 📄 许可证

MIT。详见 [`LICENSE`](../../LICENSE)。

> ℹ️ 完整文档(设计原则、quality gates 细节、`.ai-session/` 文件含义、troubleshooting 等)请见 [English README](../../README.md) 与 [`install/install.md`](../../install/install.md)。
