<div align="center">

# relay-baton

**コーディングエージェントのための可搬な継続インフラ**

Codex CLI、Claude Code、そして次に登場するツールへ ― チャットログ、diff、リポジトリを貼り直すことなく ― 圧縮されたコーディング状態を渡す。

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

```bash
# Codex が作業途中で quota の壁に当たる。relay-baton が検知し、リポジトリの
# 実際の状態から compact handoff を生成し、Claude が作業を引き継ぐ。
$ relay-baton run "upload pipeline をリファクタ" --diet caveman
● relay chain: codex → claude
▲ codex hit a limit — fallback pattern detected: "rate limit exceeded"
→ building a compact handoff for claude…
✓ claude resumed from .ai-session/handoff.md
```

---

## なぜ存在するか

AI コーディング作業は複数のツールに分散しつつある。実際のセッションはこうだ：

- ある一連の編集は Codex CLI で、別のものは Claude Code で。
- 朝はノートパソコン、夜は別のマシン。
- context window は埋まり、崩れ、あるいは静かに切り捨てられる。

現在エージェント間で作業を移す既定の方法は **チャットログのコピペ** ― ひどい場合はリポジトリ全体を prompt に放り込むこと。3 つの問題がある：

1. **トークン。** チャットログは大半がノイズ。毎ターン、そのノイズに課金される。
2. **継続性。** 次のエージェントに *意図* ではなく transcript が渡る。
3. **脆さ。** ファイル 1 つ抜け、diff 1 つが stale、エージェントは誤った前提から再起動する。

relay-baton はエージェントの下に敷くための **ローカルハーネス** だ。引き継ぎ越しに *最小十分な状態* だけを運ぶ ― compact 要約、repo map、ファイル参照。transcript ではない。

> **トークンを最小限に抑えつつ、Codex CLI と Claude Code CLI を一つの作業フローに統合する。**

## アイデア

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

コーディングエージェントのための baton-pass ― 4 段階の primitive：

- **Detect** 現エージェントが限界に達したかを検知 (quota、context、rate、errors)。
- **Capture** 重要なものだけ収集 (repo 状態、変更ファイル、決定、次の一手)。
- **Compact** 次のエージェントが実際に処理できる予算内に圧縮。
- **Hand off** quality gate を通った後にのみ渡す。

handoff は小さなファイル (`.ai-session/handoff.md`) と参照で構成される。大きな資料 (全 diff、全ログ、全 repo map) はディスクに置かれ、必要な時だけ読まれる。

## Quick Start

**インストール(ビルド不要)**

```bash
# npm (全 OS)
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

**ソースから(開発用)**

```bash
pnpm install
pnpm build
pnpm relay-baton login          # Codex + Claude にログイン
pnpm relay-baton doctor         # 環境チェック
pnpm relay-baton run "mail attachment upload flow を直して" --diet balanced
```

## ワークフロー

```bash
$ relay-baton init                  # .ai-session/ を作成
$ relay-baton run "flaky upload test を修正" --diet balanced
... codex の出力がストリームされる ...
▲ codex hit a limit — fallback pattern detected: "maximum context length"
→ building a compact handoff for claude…
✓ Handoff Quality Gate: ok · Token Diet Quality Gate: ok
... claude が引き継いでファイルを編集し終了 ...

$ relay-baton status                # セッション状態
$ relay-baton budget                # diet 予算の使用量
```

自動 fallback なし、手動 handoff のみ：

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

複数リポジトリの切り替え：

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "metrics endpoint を配線"
```

## 機能

- **自動 fallback** ― Codex 出力から `quota exceeded`、`rate limit exceeded`、`maximum context length` などを検知。grep 結果や、それらのパターンを説明する文章はスキップ (false positive 防止)。
- **Token diet** ― 5 つの決定的圧縮 profile (`off · lite · balanced · caveman · ultra`)。lock/build/min ファイルを除外、ログは tail、repo map で代替。
- **Quality gates** ― fallback 実行 *前* に handoff の完全性と予算を検証。
- **Auth-safe by default** ― `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` は子プロセスから除去。`--allow-api-key-env` で opt-in のみ。key を保存・出力・記録しない。
- **Project registry** ― 複数リポジトリを一度登録し、`--project` / `--path` でどこからでも実行。
- **Ink TUI** ― project/session dashboard。エージェントを起動しない。
- **API 呼び出しなし** ― OpenAI / Anthropic API を直接呼ばない。ローカル `codex` / `claude` CLI subprocess のみ。

## コマンド

| コマンド | 説明 |
|---|---|
| `relay-baton init` | `.ai-session/` 作成 |
| `relay-baton doctor` | 環境チェック（`--deep` で拡張診断） |
| `relay-baton verify` | シミュレートされたE2Eチェック — 実モデル呼び出しなし |
| `relay-baton login [agent]` | Codex / Claude ログインフロー |
| `relay-baton run "<task>"` | primary agent 実行 + fallback 検知 + handoff |
| `relay-baton route "<task>"` | advisory ルーティングヒントのプレビュー(読み取り専用, `--json`) |
| `relay-baton handoff --to claude` | 手動 handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | 現在 + バックアップの handoff 文書を一覧 (metadata のみ) |
| `relay-baton plan "<task>"` | Plan-execute: planner が `plan.md` を書く (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: executor が `plan.md` を実装 (`--with`, `--from`) |
| `relay-baton compress-context` | 進行中の context (state.md / commands.log) を圧縮 (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | compact-state / repo-map / full-diff 再生成 |
| `relay-baton budget` | context budget 使用量 |
| `relay-baton compress <file>` | markdown の決定的圧縮 |
| `relay-baton status` | セッション状態 |
| `relay-baton project add/list/switch/current/doctor/remove` | project registry 管理 |
| `relay-baton tui` | Ink dashboard |

Project 対応コマンドは `--project <name-or-id>` と `--path <repoPath>` を受け付ける。優先順位：`--path` > `--project` > active project > cwd。

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

デフォルトの保存先は `~/.relay-baton/projects.json`。`RELAY_BATON_PROJECTS_FILE` でパスを上書き可能 (CI、sandbox、テスト)。破損したファイルは `projects.json.corrupt-<timestamp>.bak` にバックアップされ、空の registry にリセットされる ― コマンドはそのまま動き続ける。

## Token diet profiles

| Profile | 意図 |
|---|---|
| `off` | truncation 最小 |
| `lite` | 軽い整理 |
| `balanced` *(既定)* | 通常運用 |
| `caveman` | aggressive minimal-context |
| `ultra` | 極端な圧縮 |

> `caveman` はふざけた口調ではなく **aggressive minimal-context** を意味する。技術的正確性は保たれる。

## 他の方式との比較

| 方式 | 渡る情報 | トークンコスト | 継続性 | 失敗モード |
|---|---|---|---|---|
| 生のチャット export | transcript 全部 | 高い (大半がノイズ) | 脆い ― エージェントが自分の思考を読み直す | context window 溢れ |
| コピペ prompting | 人が覚えていた分 | 可変 | 壊れやすい | 実状態との silent drift |
| repo 全体 dump | 全部 | 非常に高い | 強いが高コスト | モデルが途中で切る |
| **relay-baton** | compact 要約 + repo map + ファイル参照 | **低く、profile で上限** | 強い ― *実際の* repo 状態が駆動 | quality gate で *明示的に* 失敗 |

## 哲学

relay-baton は **AI ネイティブ開発ワークフロー向けの小さく鋭いツール** だ。

- **Local-first.** 全てディスク上。クラウド、デーモン、テレメトリ、アカウント不要。
- **Composability.** `.ai-session/` ディレクトリは単なるファイル群。読んで、grep して、diff して、PR に添付できる。
- **軽量な状態転送。** handoff は markdown ファイル。データベースではない。
- **賢さより決定性。** ハーネス内で LLM 要約をしない ― モデルが要約を間違えれば handoff が嘘になる。文字予算、構造ルール、明示参照のみ。
- **Repo 状態が真実の源。** 会話は解釈、repo は事実。
- **トークン効率は機能そのもの** ― メニューに隠れたオプションではない。

### 設計原則

1. chat relay ではなく **work handoff**。
2. 会話履歴より **現在のリポジトリ状態** を優先。
3. handoff は **人間が読める** こと。
4. 全 UI は core を呼ぶ薄い殻。
5. **Token diet は副機能ではなく中心機能**。

## 今後の方向

relay-baton は 2-agent fallback ハーネスとして出発する。同じ primitive はさらに広がる：

- **多エージェント relay chain** ― Codex → Claude → OpenCode → 再び Codex。
- **分岐するセッションツリー** ― 同じタスクを並列エージェントで試し、diff で和解。
- **リモート relay state** ― `.ai-session/` を共有 remote に push し、次のマシンが引き継ぐ。
- **オーケストレーションされたワークフロー** ― `review`、`diagnose`、`continue` モード (明示的チェックポイントを持つ bounded autopilot)。
- **追加 adapter** ― OpenCode、Gemini CLI、Aider など、まともなローカル subprocess インターフェイスを持つ全て。

ハーネスの形は変わらない：detect、capture、compact、hand off。

## 必要環境

| 項目 | バージョン / 備考 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 必須 |
| `codex` | **ChatGPT Plus 以上のサブスクリプションが必要** |
| `claude` | **Claude Pro 以上のサブスクリプションが必要** |

> relay-baton は OpenAI / Anthropic API を直接呼ばない。ローカル `codex` / `claude` CLI の **サブスクリプション認証** を使う。API key 認証は可能だが **デフォルトでブロック** (`--allow-api-key-env` で opt-in)。

## ログイン

```bash
pnpm relay-baton login           # 両方
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` が通ってもログイン済みではない。"Not logged in" が出たら上のコマンドを再実行。

## リリースノート

**最新: v1.5.1** — [English](../../release-notes/v1.5.1.md) · [한국어](../../release-notes/ko/v1.5.1.md) · [日本語](../../release-notes/ja/v1.5.1.md)

relay-baton は **v1.0.0 で正式リリース(GA)** され、現在の最新は **v1.5.1** です。

- 全バージョン履歴: [`CHANGELOG.md`](../../CHANGELOG.md)
- 各バージョンの詳細な変更点: [release-notes index](../../release-notes/README.md)

### インストール

```bash
npm i -g @relay-baton/cli   # -> relay-baton
brew tap dgl1231/relay-baton && brew install relay-baton            # macOS / Linux
scoop bucket add relay-baton https://github.com/dgl1231/scoop-relay-baton && scoop install relay-baton  # Windows
winget install dgl1231.relay-baton                                  # Windows
```

## License

MIT。詳細は [`LICENSE`](../../LICENSE)。

> 完全なドキュメント (quality gate の詳細、`.ai-session/` ファイルの意味、config schema、TUI キーバインド、トラブルシューティング等) は [English README](../../README.md) と [`install/install.md`](../../install/install.md) にある。
