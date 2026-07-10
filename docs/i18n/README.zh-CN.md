<div align="center">

# relay-baton

**面向编码代理的可移植连续性基础设施**

在 Codex CLI、Claude Code 和未来出现的工具之间 ― 无需重新粘贴聊天记录、diff 或仓库 ― 传递压缩后的编码状态。

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

```bash
# Codex 在任务中途撞上 quota 墙。relay-baton 检测到后,根据仓库的实际状态
# 构建一个 compact handoff,Claude 接手继续。
$ relay-baton run "重构 upload pipeline" --diet caveman
● relay chain: codex → claude
▲ codex hit a limit — fallback pattern detected: "rate limit exceeded"
→ building a compact handoff for claude…
✓ claude resumed from .ai-session/handoff.md
```

---

## 为什么存在

AI 编码工作正在多个工具间碎片化。真实的会话是这样的:

- 一批编辑用 Codex CLI,另一批用 Claude Code。
- 早上用笔记本,晚上换另一台机器。
- context window 被填满、崩溃,或者悄悄被截断。

目前在代理间转移工作的默认方式是 **复制粘贴聊天日志** ― 更糟的是把整个仓库丢进 prompt。这种做法有三个问题:

1. **Token。** 聊天日志大部分是噪音。你为这些噪音每轮都付费。
2. **连续性。** 下一个代理拿到的不是 *意图*,而是 transcript。
3. **脆弱性。** 漏一个文件、diff 过时,代理就从错误前提重新开始。

relay-baton 是一个铺在代理底下的 **本地 harness**。在交接之间只搬运 *最小必要状态* ― compact 摘要、repo map、文件引用,不是 transcript。

> **在最少 token 消耗下,把 Codex CLI 和 Claude Code CLI 合并成单一工作流。**

## 核心思路

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

为编码代理设计的 baton-pass ― 4 步 primitive:

- **Detect** 检测当前代理是否触顶 (quota、context、rate、errors)。
- **Capture** 仅收集要紧的 (repo 状态、变更文件、决策、下一步)。
- **Compact** 压缩到下一个代理实际能消化的预算内。
- **Hand off** 通过 quality gate 后才交付。

handoff 是一个小文件 (`.ai-session/handoff.md`) 加引用。重量级内容 (完整 diff、完整日志、完整 repo map) 留在磁盘上,按需加载。

## Quick Start

**安装(无需构建)**

```bash
# npm (所有系统)
npm i -g @relay-baton/cli        # -> relay-baton

# macOS / Linux — Homebrew
brew tap dgl1231/relay-baton && brew install relay-baton

# Windows — Scoop / Winget
scoop bucket add relay-baton https://github.com/dgl1231/scoop-relay-baton && scoop install relay-baton
winget install dgl1231.relay-baton
```

```bash
relay-baton doctor
relay-baton login
relay-baton run "..." --diet balanced
```

**从源码(开发用)**

```bash
pnpm install
pnpm build
pnpm relay-baton login          # 登录 Codex + Claude
pnpm relay-baton doctor         # 环境检查
pnpm relay-baton run "修复邮件附件上传流程" --diet balanced
```

## 工作流

```bash
$ relay-baton init                  # 创建 .ai-session/
$ relay-baton run "修复 flaky upload test" --diet balanced
... codex 输出实时流式打印 ...
▲ codex hit a limit — fallback pattern detected: "maximum context length"
→ building a compact handoff for claude…
✓ Handoff Quality Gate: ok · Token Diet Quality Gate: ok
... claude 接手编辑文件并完成 ...

$ relay-baton status                # 会话状态
$ relay-baton budget                # diet 预算用量
```

只生成 handoff,不自动 fallback:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

多仓库切换:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "接入新的 metrics endpoint"
```

## 特性

- **自动 fallback** ― 从 Codex 输出中检测 `quota exceeded`、`rate limit exceeded`、`maximum context length` 等。跳过 grep 结果行和解释这些模式的散文 (避免误报)。
- **Token diet** ― 5 个确定性压缩 profile (`off · lite · balanced · caveman · ultra`)。排除 lock/build/min 文件,日志取 tail,用 repo map 替代源码。
- **Quality gates** ― 在 fallback 启动 *之前* 验证 handoff 完整性和预算。
- **Auth-safe by default** ― `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 默认从子进程剥离,只能通过 `--allow-api-key-env` opt-in。密钥从不存储、打印、记录。
- **Project registry** ― 注册多个仓库一次,任意位置用 `--project` 或 `--path` 调用。
- **Ink TUI** ― project / session dashboard。从不启动代理。
- **没有自己的 API 调用** ― relay-baton 不直接调用 OpenAI / Anthropic API。仅通过 subprocess 调用本地 `codex` / `claude` CLI。

## 命令

| 命令 | 说明 |
|---|---|
| `relay-baton init` | 在当前仓库创建 `.ai-session/` |
| `relay-baton doctor` | 检查 git / codex / claude / env / config（`--deep` 进行扩展诊断） |
| `relay-baton verify` | 模拟端到端检查 — 不进行真实模型调用 |
| `relay-baton login [agent]` | Codex / Claude 登录流程 |
| `relay-baton run "<task>"` | 主代理执行 + fallback 检测 + handoff |
| `relay-baton route "<task>"` | 建议性路由提示预览(只读, `--json`) |
| `relay-baton handoff --to claude` | 手动 handoff (`--diet`、`--no-run`、`--force`) |
| `relay-baton handoff history` | 列出当前 + 备份的 handoff 文档 (仅 metadata) |
| `relay-baton plan "<task>"` | Plan-execute：planner 写出 `plan.md`（`--with`、`--no-run`、`--then-execute`） |
| `relay-baton execute` | Plan-execute：executor 实现 `plan.md`（`--with`、`--from`） |
| `relay-baton compress-context` | 压缩进行中的 context（state.md / commands.log）（`--dry-run`、`--threshold`） |
| `relay-baton compact` / `squeeze` | 重建 compact-state / repo-map / full-diff |
| `relay-baton budget` | 显示 context budget 用量 |
| `relay-baton compress <file>` | markdown 文件的确定性压缩 |
| `relay-baton status` | 会话状态 |
| `relay-baton project add/list/switch/current/doctor/remove` | project registry 管理 |
| `relay-baton tui` | Ink dashboard |

支持 project 的命令接受 `--project <name-or-id>` 和 `--path <repoPath>`。优先级:`--path` > `--project` > active project > cwd。

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

默认存储路径为 `~/.relay-baton/projects.json`。可用 `RELAY_BATON_PROJECTS_FILE` 覆盖路径 (CI、sandbox、测试)。损坏的文件会备份为 `projects.json.corrupt-<timestamp>.bak` 并重置为空 registry ― 命令继续工作。

## Token diet profiles

| Profile | 意图 |
|---|---|
| `off` | 最小截断 |
| `lite` | 轻量整理 |
| `balanced` *(默认)* | 日常使用 |
| `caveman` | aggressive minimal-context |
| `ultra` | 极端压缩 |

> `caveman` 不是搞笑语气,而是 **aggressive minimal-context**。技术准确性保留。

## 与替代方案对比

| 方案 | 携带内容 | Token 成本 | 连续性 | 失败模式 |
|---|---|---|---|---|
| 原始聊天 export | 全部 transcript | 高 (大部分是噪音) | 脆弱 ― 代理重读自己的思考 | context window 溢出 |
| 复制粘贴 prompting | 人记得的部分 | 可变 | 易碎 | 与实际状态 silent drift |
| 整仓库 dump | 全部 | 极高 | 强但昂贵 | 模型中途截断 |
| **relay-baton** | compact 摘要 + repo map + 文件引用 | **低,profile 限定上限** | 强 ― 由 *实际* repo 状态驱动 | 通过 quality gate *显式* 失败 |

## 哲学

relay-baton 是 **面向 AI 原生开发工作流的小而锋利的工具**。

- **Local-first.** 一切都在本地磁盘上。无云、无 daemon、无遥测、无账号。
- **可组合性。** `.ai-session/` 目录就是一堆文件。可读、可 grep、可 diff、可放进 PR。
- **轻量状态转移。** handoff 是 markdown 文件,不是数据库。
- **确定性优于聪明。** harness 内部不做 LLM 总结 ― 如果模型总结错了,handoff 就是谎言。只用字符预算、结构规则、显式引用。
- **Repo 状态是真相之源。** 对话是诠释,repo 是事实。
- **Token 效率本身就是功能** ― 不是埋在菜单里的开关。

### 设计原则

1. 不是 chat relay,是 **work handoff**。
2. **当前仓库状态** 优先于会话历史。
3. handoff 必须 **人类可读**。
4. 所有 UI 都是 core 之上的薄壳。
5. **Token diet 不是附加功能,而是核心功能**。

## 未来方向

relay-baton 起步于双代理 fallback harness。同一 primitive 可以延伸:

- **多代理 relay 链** ― Codex → Claude → OpenCode → 回到 Codex。
- **分叉的会话树** ― 同一任务用并行代理尝试,通过 diff 调和。
- **远程 relay state** ― 把 `.ai-session/` push 到共享 remote,下一台机器接力。
- **编排工作流** ― `review`、`diagnose`、`continue` 模式 (带显式 checkpoint 的 bounded autopilot)。
- **更多 adapter** ― OpenCode、Gemini CLI、Aider,任何有合理本地 subprocess 接口的工具。

harness 的形状不变:detect、capture、compact、hand off。

## 依赖要求

| 项 | 版本 / 备注 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必需 |
| `codex` | **需要 ChatGPT Plus 或更高订阅** |
| `claude` | **需要 Claude Pro 或更高订阅** |

> relay-baton 不直接调用 OpenAI / Anthropic API,使用本地 `codex` / `claude` CLI 的 **订阅认证**。API key 认证技术上可行但 **默认阻断** (需 `--allow-api-key-env` opt-in)。

## 登录

```bash
pnpm relay-baton login           # 两者
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` 通过 **不代表** 已登录。看到 "Not logged in" 就重新跑上面的命令。

## 发布说明

**最新: v1.3.0** — [English](../../release-notes/v1.3.0.md) · [한국어](../../release-notes/ko/v1.3.0.md) · [简体中文](../../release-notes/zh-CN/v1.3.0.md)

relay-baton 已 **正式发布(GA)v1.0.0**,当前最新为 **v1.3.0**。

- 完整版本历史: [`CHANGELOG.md`](../../CHANGELOG.md)
- 各版本详细补丁说明: [release-notes index](../../release-notes/README.md)

### 安装

```bash
npm i -g @relay-baton/cli   # -> relay-baton
brew tap dgl1231/relay-baton && brew install relay-baton            # macOS / Linux
scoop bucket add relay-baton https://github.com/dgl1231/scoop-relay-baton && scoop install relay-baton  # Windows
winget install dgl1231.relay-baton                                  # Windows
```

## License

MIT。详见 [`LICENSE`](../../LICENSE)。

> 完整文档 (quality gate 细节、`.ai-session/` 文件含义、config schema、TUI 键位、故障排查等) 见 [English README](../../README.md) 与 [`install/install.md`](../../install/install.md)。
