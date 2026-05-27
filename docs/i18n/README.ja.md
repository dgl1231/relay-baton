<div align="center">

# ⚡ relay-baton

**Codex CLI ↔ Claude Code のトークン節約型ハンドオフ・ハーネス**

トークン予算をこぼさずに、コーディングエージェント間でバトンを渡す。

[English](../../README.md)
 · [한국어](./README.ko.md)
 · **日本語**
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

---

> **このプロジェクトのミッション**
>
> 💡 **トークン消費を最小限に抑えつつ、Codex CLI と Claude Code CLI を1つのワークフローに統合する。**
>
> 一方のエージェントが quota / context 上限に達したら、もう一方が同じリポジトリ状態からそのまま作業を引き継ぐ。ただしログ・diff・リポジトリ全体を貼り付けるのではなく、**コンパクトなハンドオフ + ファイル参照**だけを渡す。これが relay-baton が *token diet harness* である理由であり、おまけ機能ではなく **存在意義そのもの** だ。

`relay-baton` は **Codex CLI ↔ Claude Code CLI** の作業引き継ぎを自動化するローカル・ハーネス。usage / context / quota 上限を踏んだら次のエージェントが同じリポジトリ状態から再開する。全体ログ・diff・リポジトリを丸ごと渡す代わりに、**compact handoff + ファイル参照** を渡す **token diet harness**。

## ✨ 機能

- 🪄 **自動フォールバック** — Codex 出力から `quota exceeded` 等を検出し Claude Code へ自動引き継ぎ。
- 📉 **Token diet** — 5プロファイル (`off · lite · balanced · caveman · ultra`)、決定論的圧縮 (lock/build/min 除外、log tail、repo map)。
- 🛡️ **デフォルトで安全な認証** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` は子プロセスに **デフォルトで渡さない**。
- ✅ **Quality Gates** — handoff の完全性と token 予算を fallback 起動前に検証。
- 🧰 **One-shot login** — `relay-baton login` で Codex / Claude の認証フローをそのまま起動。
- 🎛️ **Ink TUI** — セッション状態・エージェントの可用性・予算を一目で確認。
- 🚫 **API 直接呼び出しなし** — ローカル CLI subprocess のみ。

## 🚀 Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "メール添付のアップロード処理を直して" --diet balanced
```

## 🤖 エージェントに一行でインストールさせる

[`install/install.md`](../../install/install.md) は **人間用ガイドであり、Codex / Claude Code がそのまま実行できる instruction surface** でもある。

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys. Run 'pnpm relay-baton doctor' at the end."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 必要条件

| 項目 | バージョン / 備考 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必須 |
| `codex` | **ChatGPT Plus 以上のサブスクリプション必須** |
| `claude` | **Claude Pro 以上のサブスクリプション必須** |

> ### 💳 サブスクリプションについて
>
> relay-baton は OpenAI / Anthropic API を直接呼び出さない。ローカル CLI の **サブスクリプション認証** をそのまま使う。
> - Codex CLI → ChatGPT **Plus / Pro / Team / Enterprise**
> - Claude Code CLI → Anthropic **Claude Pro / Max / Team / Enterprise**
> - 無料アカウントでは安定動作しない。
> - API キー認証は技術的には可能だが、**意図しない従量課金を防ぐためデフォルトでブロック** (`--allow-api-key-env` の明示的 opt-in が必要)。

## 🔑 ログイン

```bash
pnpm relay-baton login           # 両方
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` が通っていてもログインは別。"Not logged in" が出たら上記を再実行。

## 🧭 コマンド

| Command | 説明 |
|---|---|
| `relay-baton init` | `.ai-session/` 作成 |
| `relay-baton doctor` | 環境チェック |
| `relay-baton login [agent]` | Codex / Claude ログイン |
| `relay-baton run "<task>"` | Codex 実行 + フォールバック検知 + Claude 引き継ぎ |
| `relay-baton handoff --to claude` | 手動ハンドオフ |
| `relay-baton compact` | compact-state, repo-map, full-diff を再生成 |
| `relay-baton budget` | コンテキスト予算を表示 |
| `relay-baton compress <file>` | Markdown 決定論的圧縮 |
| `relay-baton status` | セッション状態 |
| `relay-baton tui` | Ink TUI |

## 📉 Diet profiles

`off` · `lite` · `balanced` *(デフォルト)* · `caveman` · `ultra`

> `caveman` はふざけた口調ではなく **aggressive minimal-context profile** を意味する。技術的正確さは維持される。

## 🛡️ 認証 / 課金の安全性

- API キーを **保存・出力・記録しない**。
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` はデフォルトで子プロセスから除去。
- `--allow-api-key-env` または `authPolicy.allowApiKeyEnv: true` のみ通過。

## 🎯 設計原則

1. チャットリレーではなく **作業引き継ぎ**。
2. 会話履歴より **現在のリポジトリ状態** を優先。
3. ハンドオフは **人間が読んで理解できる** こと。
4. すべての UI は core を呼び出す薄いシェルにすぎない。
5. **Token diet はおまけではなく中核機能。**

## 📄 ライセンス

MIT. 詳細は [`LICENSE`](../../LICENSE) を参照。

> ℹ️ 完全なドキュメント (設計原則、quality gate の詳細、`.ai-session/` ファイル仕様、トラブルシュート等) は [English README](../../README.md) と [`install/install.md`](../../install/install.md) を参照。
