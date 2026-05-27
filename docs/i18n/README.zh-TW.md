<div align="center">

# ⚡ relay-baton

**Codex CLI ↔ Claude Code 的 Token 感知交接框架**

在不浪費 token 預算的前提下,把「接力棒」從一個 coding agent 傳給另一個。

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

---

> **本專案的核心使命**
>
> 💡 **以最少的 token 消耗,把 Codex CLI 與 Claude Code CLI 合併到同一個工作流。**
>
> 當一個 agent 觸發 quota / context 限制時,下一個 agent 從完全相同的儲存庫狀態接手。但不會把完整日誌、diff、整個 repo 重新貼上 —— 只傳 **精簡交接文件 + 檔案參考**。這就是 relay-baton 之所以是 *token diet harness* 的原因,這不是附加功能,而是專案存在的本身理由。

## ✨ 功能

- 🪄 **自動 fallback** — 偵測 Codex 輸出中的 `quota exceeded` 等短語,自動交給 Claude Code。
- 📉 **Token diet** — 5 個 profile (`off · lite · balanced · caveman · ultra`),確定性壓縮。
- 🛡️ **預設安全的驗證策略** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 預設從子行程剝離。
- ✅ **Quality Gates** — fallback agent 啟動前驗證 handoff 完整性與 token 預算。
- 🧰 **一鍵登入** — `relay-baton login`。
- 🎛️ **Ink TUI**。
- 🚫 **本工具不直接呼叫 API**。

## 🚀 快速開始

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "修正郵件附件上傳流程" --diet balanced
```

## 🤖 讓 agent 一句話裝好

[`install/install.md`](../../install/install.md) 既是給人看的安裝指南,也是給 Codex / Claude Code 直接執行的指令書。

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 環境要求

| 項 | 版本 / 備註 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必需 |
| `codex` | **需 ChatGPT Plus 或更高訂閱** |
| `claude` | **需 Claude Pro 或更高訂閱** |

> ### 💳 訂閱說明
>
> relay-baton **不會直接呼叫** OpenAI / Anthropic API,而是直接使用本地 `codex` / `claude` CLI 的 **訂閱驗證**。
> - 免費帳戶無法穩定使用。
> - API key 驗證雖技術上可行,但 **預設被攔截**(避免意外按量計費),需 `--allow-api-key-env`。

## 🔑 登入

```bash
pnpm relay-baton login           # 同時
pnpm relay-baton login codex
pnpm relay-baton login claude
```

## 🧭 命令

| Command | 說明 |
|---|---|
| `relay-baton init` | 建立 `.ai-session/` |
| `relay-baton doctor` | 環境檢查 |
| `relay-baton login [agent]` | Codex / Claude 登入 |
| `relay-baton run "<task>"` | Codex 執行 + fallback 偵測 + 移交 Claude |
| `relay-baton handoff --to claude` | 手動交接 |
| `relay-baton compact` | 重建 compact-state / repo-map / full-diff |
| `relay-baton budget` | 當前 context 預算 |
| `relay-baton compress <file>` | Markdown 確定性壓縮 |
| `relay-baton status` | Session 狀態 |
| `relay-baton tui` | Ink TUI |

## 📉 Diet profiles

`off` · `lite` · `balanced` *(預設)* · `caveman` · `ultra`

> `caveman` **不是搞笑口吻**,而是 *aggressive minimal-context*。技術準確度保持不變。

## 🛡️ 驗證 / 帳單安全

- **不儲存、不列印、不寫入** API key。
- 預設從子行程剝離 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。

## 🎯 設計原則

1. **work handoff**,不是 chat relay。
2. **當前儲存庫狀態** 優先於對話歷史。
3. handoff 必須 **人也能讀懂**。
4. 所有 UI 都只是 core 的薄殼。
5. **Token diet 不是附加功能,是核心功能。**

## 📄 授權

MIT。詳見 [`LICENSE`](../../LICENSE)。

> ℹ️ 完整文件請見 [English README](../../README.md) 與 [`install/install.md`](../../install/install.md)。
