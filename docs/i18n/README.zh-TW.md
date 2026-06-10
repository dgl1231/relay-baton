<div align="center">

# relay-baton

**為編碼代理打造的可攜式延續性基礎設施**

在 Codex CLI、Claude Code 與未來出現的工具之間 ― 不需要重新貼上聊天紀錄、diff 或整個倉庫 ― 傳遞壓縮後的編碼狀態。

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · **繁體中文**
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

```bash
# Codex 在任務途中撞上 quota 牆。relay-baton 偵測到後,根據倉庫的實際狀態
# 建立 compact handoff,Claude 接手繼續。
$ relay-baton run "重構 upload pipeline" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## 為何存在

AI 編碼工作正在多個工具間碎片化。真實的工作階段是這樣的:

- 一批編輯用 Codex CLI,另一批用 Claude Code。
- 早上用筆電,晚上換另一台機器。
- context window 被填滿、崩潰,或者悄悄被截斷。

目前在代理間轉移工作的預設方法是 **複製貼上聊天紀錄** ― 更糟的是把整個倉庫丟進 prompt。這種方式有三個問題:

1. **Token。** 聊天紀錄大部分是雜訊。你為這些雜訊每輪都付費。
2. **延續性。** 下一個代理拿到的不是 *意圖*,而是 transcript。
3. **脆弱性。** 漏一個檔案、diff 過時,代理就從錯誤前提重新開始。

relay-baton 是鋪在代理底下的 **本地 harness**。在交接之間只搬運 *最小必要狀態* ― compact 摘要、repo map、檔案參照,不是 transcript。

> **在最少 token 消耗下,把 Codex CLI 和 Claude Code CLI 合併成單一工作流。**

## 核心構想

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

為編碼代理設計的 baton-pass ― 4 步 primitive:

- **Detect** 偵測目前代理是否觸頂 (quota、context、rate、errors)。
- **Capture** 只收集要緊的 (repo 狀態、變更檔案、決策、下一步)。
- **Compact** 壓縮到下一個代理實際能消化的預算內。
- **Hand off** 通過 quality gate 後才交付。

handoff 是一個小檔案 (`.ai-session/handoff.md`) 加參照。重量級內容 (完整 diff、完整日誌、完整 repo map) 留在磁碟上,按需載入。

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # 登入 Codex + Claude
pnpm relay-baton doctor         # 環境檢查
pnpm relay-baton run "修復郵件附件上傳流程" --diet balanced
```

## 工作流

```bash
$ relay-baton init                  # 建立 .ai-session/
$ relay-baton run "修復 flaky upload test" --diet balanced
... codex 輸出即時串流 ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude 接手編輯檔案並完成 ...

$ relay-baton status                # 工作階段狀態
$ relay-baton budget                # diet 預算用量
```

只生成 handoff,不自動 fallback:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

多倉庫切換:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "接上新的 metrics endpoint"
```

## 特性

- **自動 fallback** ― 從 Codex 輸出偵測 `quota exceeded`、`rate limit exceeded`、`maximum context length` 等。跳過 grep 結果行與解釋這些 pattern 的散文 (避免誤判)。
- **Token diet** ― 5 個確定性壓縮 profile (`off · lite · balanced · caveman · ultra`)。排除 lock/build/min 檔案,日誌取 tail,以 repo map 取代原始碼。
- **Quality gates** ― 在 fallback 啟動 *之前* 驗證 handoff 完整性與預算。
- **Auth-safe by default** ― `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 預設從子行程剝除,只能透過 `--allow-api-key-env` opt-in。金鑰從不儲存、列印、紀錄。
- **Project registry** ― 註冊多個倉庫一次,任意位置以 `--project` 或 `--path` 呼叫。
- **Ink TUI** ― project / session dashboard。從不啟動代理。
- **沒有自家的 API 呼叫** ― relay-baton 不直接呼叫 OpenAI / Anthropic API。只以 subprocess 呼叫本地 `codex` / `claude` CLI。

## 指令

| 指令 | 說明 |
|---|---|
| `relay-baton init` | 在目前倉庫建立 `.ai-session/` |
| `relay-baton doctor` | 檢查 git / codex / claude / env / config（`--deep` 進行擴充診斷） |
| `relay-baton verify` | 模擬端到端檢查 — 不進行真實模型呼叫 |
| `relay-baton login [agent]` | Codex / Claude 登入流程 |
| `relay-baton run "<task>"` | 主代理執行 + fallback 偵測 + handoff |
| `relay-baton handoff --to claude` | 手動 handoff (`--diet`、`--no-run`、`--force`) |
| `relay-baton handoff history` | 列出目前 + 備份的 handoff 文件 (僅 metadata) |
| `relay-baton plan "<task>"` | Plan-execute：planner 寫出 `plan.md`（`--with`、`--no-run`、`--then-execute`） |
| `relay-baton execute` | Plan-execute：executor 實作 `plan.md`（`--with`、`--from`） |
| `relay-baton compress-context` | 壓縮進行中的 context（state.md / commands.log）（`--dry-run`、`--threshold`） |
| `relay-baton compact` / `squeeze` | 重建 compact-state / repo-map / full-diff |
| `relay-baton budget` | 顯示 context budget 用量 |
| `relay-baton compress <file>` | markdown 檔案的確定性壓縮 |
| `relay-baton status` | 工作階段狀態 |
| `relay-baton project add/list/switch/current/doctor/remove` | project registry 管理 |
| `relay-baton tui` | Ink dashboard |

支援 project 的指令接受 `--project <name-or-id>` 與 `--path <repoPath>`。優先順序:`--path` > `--project` > active project > cwd。

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

預設儲存路徑為 `~/.relay-baton/projects.json`。可用 `RELAY_BATON_PROJECTS_FILE` 覆蓋路徑 (CI、sandbox、測試)。損壞的檔案會備份為 `projects.json.corrupt-<timestamp>.bak` 並重設為空 registry ― 指令繼續運作。

## Token diet profiles

| Profile | 意圖 |
|---|---|
| `off` | 最小截斷 |
| `lite` | 輕量整理 |
| `balanced` *(預設)* | 日常使用 |
| `caveman` | aggressive minimal-context |
| `ultra` | 極端壓縮 |

> `caveman` 不是搞笑語氣,而是 **aggressive minimal-context**。技術準確性保留。

## 與其他方案比較

| 方案 | 攜帶內容 | Token 成本 | 延續性 | 失敗模式 |
|---|---|---|---|---|
| 原始聊天 export | 整段 transcript | 高 (大部分是雜訊) | 脆弱 ― 代理重讀自己的思考 | context window 溢出 |
| 複製貼上 prompting | 人記得的部分 | 浮動 | 易碎 | 與實際狀態 silent drift |
| 整倉庫 dump | 全部 | 極高 | 強但昂貴 | 模型中途截斷 |
| **relay-baton** | compact 摘要 + repo map + 檔案參照 | **低,以 profile 設上限** | 強 ― 由 *實際* repo 狀態驅動 | 經 quality gate *明確* 失敗 |

## 哲學

relay-baton 是 **針對 AI 原生開發工作流的小而銳利工具**。

- **Local-first.** 一切都在本地磁碟。無雲端、無 daemon、無遙測、無帳號。
- **可組合性。** `.ai-session/` 目錄就是一堆檔案。可讀、可 grep、可 diff、可放進 PR。
- **輕量狀態轉移。** handoff 是 markdown 檔案,不是資料庫。
- **確定性優於聰明。** harness 內部不做 LLM 摘要 ― 模型若摘要錯誤,handoff 就是謊言。只用字元預算、結構規則、明確參照。
- **Repo 狀態是真相之源。** 對話是詮釋,repo 是事實。
- **Token 效率本身就是功能** ― 不是藏在選單裡的開關。

### 設計原則

1. 不是 chat relay,是 **work handoff**。
2. **目前倉庫狀態** 優先於對話歷史。
3. handoff 必須 **人類可讀**。
4. 所有 UI 都是 core 之上的薄殼。
5. **Token diet 不是附加功能,而是核心功能**。

## 未來方向

relay-baton 從雙代理 fallback harness 起步。同一 primitive 可以延伸:

- **多代理 relay 鏈** ― Codex → Claude → OpenCode → 回到 Codex。
- **分支工作階段樹** ― 同一任務以並行代理嘗試,經 diff 調和。
- **遠端 relay state** ― 將 `.ai-session/` push 到共享 remote,下一台機器接續。
- **編排式工作流** ― `review`、`diagnose`、`continue` 模式 (帶明確 checkpoint 的 bounded autopilot)。
- **更多 adapter** ― OpenCode、Gemini CLI、Aider,任何有合理本地 subprocess 介面的工具。

harness 的形狀不變:detect、capture、compact、hand off。

## 需求

| 項目 | 版本 / 備註 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必需 |
| `codex` | **需要 ChatGPT Plus 以上訂閱** |
| `claude` | **需要 Claude Pro 以上訂閱** |

> relay-baton 不直接呼叫 OpenAI / Anthropic API,使用本地 `codex` / `claude` CLI 的 **訂閱驗證**。API key 驗證技術上可行但 **預設封鎖** (需 `--allow-api-key-env` opt-in)。

## 登入

```bash
pnpm relay-baton login           # 兩者
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` 通過 **不代表** 已登入。看到 "Not logged in" 就重新執行上面的指令。

## 發布說明

**最新:** v1.3.0-alpha.0 — [English](../../release-notes/v1.3.0-alpha.0.md) · [한국어](../../release-notes/ko/v1.3.0-alpha.0.md)

| 版本 | English | 한국어 | 一句話摘要 |
|---|---|---|---|
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
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify：`relay-baton verify`（模擬 E2E，無模型呼叫）、`doctor --deep`、TUI 模式面板、`docs/ROADMAP.md`。 |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | plan-execute 模式（`plan` / `execute`）+ 上下文壓縮（`compress-context`）。 |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | GitHub Actions CI、測試、工作階段可觀測性、`handoff history`。 |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | 無副作用的 `ProjectResolver`、損壞的 `projects.json` 自動備份/還原、`RELAY_BATON_PROJECTS_FILE` 環境變數覆蓋、fallback 時清理 `lastError`。 |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | 新增 project registry、`--project` / `--path`、project CLI 和 TUI dashboard。 |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | Codex-to-Claude handoff MVP、token diet、fallback detection、quality gates。 |

## License

MIT。詳見 [`LICENSE`](../../LICENSE)。

> 完整文件 (quality gate 細節、`.ai-session/` 檔案含義、config schema、TUI 鍵位、疑難排解等) 見 [English README](../../README.md) 與 [`install/install.md`](../../install/install.md)。
