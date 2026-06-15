# relay-baton — Automated Install Instructions

> 이 파일은 **사람용 install guide이자, Codex CLI / Claude Code 같은 coding agent에게 그대로 넘겨 자동 설치를 시킬 수 있는 instruction surface**다. 복사해서 agent에게 붙여넣거나, 아래 한 줄 명령으로 agent에게 이 파일을 읽고 실행하도록 시킬 수 있다.

## 0. Agent에게 한 줄로 시키는 방법

```text
이 링크의 내용을 읽고 그대로 따라 설치해줘:
https://github.com/dgl1231/relay-baton/blob/main/install/install.md

- 환경 점검 후 부족한 항목만 설치한다.
- 사용자의 OS(Windows / macOS / Linux)에 맞는 명령을 선택한다.
- API key는 절대 출력/저장하지 않는다.
- 모든 단계가 끝나면 `pnpm relay-baton doctor` 결과를 보여준다.
```

Codex CLI 예시:
```bash
codex exec --sandbox workspace-write "https://github.com/dgl1231/relay-baton/blob/main/install/install.md 를 읽고 그대로 설치해줘"
```

Claude Code 예시 (대화형 또는 headless):
```bash
claude --permission-mode acceptEdits -p "Read https://github.com/dgl1231/relay-baton/blob/main/install/install.md and follow it step by step to install relay-baton on this machine."
```

## 가장 빠른 길 — 빌드 없이 바이너리 받기 (v1.1+)

소스를 빌드하지 않고 바로 쓰려면 릴리즈에 첨부된 단일 실행파일을 받는다. Node 설치도 필요 없다.

- 최신: <https://github.com/dgl1231/relay-baton/releases/latest>
- 특정 버전: <https://github.com/dgl1231/relay-baton/releases> 에서 원하는 태그 선택

v1.4+ 릴리즈는 `SHA256SUMS`를 첨부하므로, 아래 one-line installer가 바이너리를
내려받고 SHA-256을 검증한 뒤 사용자 영역 PATH에 설치한다.

**macOS / Linux**:
```bash
curl -fsSL https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.sh | sh
```

**Windows PowerShell**:
```powershell
iwr https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.ps1 -UseB | iex
```

| OS | 파일 | 실행 |
|---|---|---|
| macOS (Apple Silicon) | `relay-baton-macos-arm64` | `chmod +x relay-baton-macos-arm64 && ./relay-baton-macos-arm64 --version` |
| Linux (x64) | `relay-baton-linux-x64` | `chmod +x relay-baton-linux-x64 && ./relay-baton-linux-x64 --version` |
| Windows (x64) | `relay-baton-windows-x64.exe` | `.\relay-baton-windows-x64.exe --version` |

> 바이너리는 relay-baton CLI만 포함한다. 실제 작업에는 여전히 로그인된 `codex` / `claude` CLI가 필요하다(아래 Step 2~3). 소스에서 직접 빌드하려면 다음 섹션을 따른다.

## 1. 사전 요구사항

| 항목 | 버전 | 비고 |
|---|---|---|
| OS | Windows 10/11, macOS, Linux | 모두 지원 |
| Node.js | **≥ 20** | 18에서도 build/test는 동작하지만 권장 X |
| pnpm | **≥ 9** | corepack로 활성화 |
| git | 최신 | 필수 |
| Codex CLI | 최신 | **ChatGPT Plus 이상 구독 필요** |
| Claude Code CLI | 최신 | **Claude Pro 이상 구독 필요** |

> relay-baton 자체는 OpenAI / Anthropic API를 호출하지 않는다. **로그인된 Codex/Claude CLI의 subscription quota**가 그대로 사용된다.

## 2. Step-by-step (agent 가이드)

### Step 1 — Node.js & pnpm

**Windows (PowerShell)**:
```powershell
# nvm-windows로 Node 20 설치
nvm install 20.18.0
nvm use 20.18.0

# pnpm은 corepack로
corepack enable
corepack prepare pnpm@9 --activate
```

**macOS / Linux**:
```bash
# nvm 사용 시
nvm install 20
nvm use 20

# 또는 fnm
fnm install 20 && fnm use 20

corepack enable
corepack prepare pnpm@9 --activate
```

확인:
```bash
node --version    # v20.x 이상
pnpm --version    # 9.x 이상
git --version
```

### Step 2 — Codex CLI 설치

Codex CLI는 npm으로 설치할 수 있다.

```bash
npm install -g @openai/codex
codex --version
```

설치 후 로그인:
```bash
codex login
```
브라우저가 열리면 **ChatGPT Plus 이상 계정**으로 인증한다.

### Step 3 — Claude Code 설치

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

설치 후 처음 한 번 대화형으로 실행해서 `/login`을 친다.

```bash
claude
# 프롬프트에서:
# /login
# (브라우저 인증 → Claude Pro 이상 계정)
# /exit
```

### Step 4 — relay-baton clone & build

```bash
git clone https://github.com/dgl1231/relay-baton.git
cd relay-baton
pnpm install
pnpm build
pnpm test
```

### Step 5 — 첫 실행 검증

```bash
pnpm relay-baton doctor
```

기대 결과:
- `git repository: yes`
- `git command: available`
- `codex command: available`
- `claude command: available`
- `OPENAI_API_KEY: not set` (또는 set일 때 blocked 안내)
- `ANTHROPIC_API_KEY: not set` (또는 set일 때 blocked 안내)
- `All checks passed.`

만약 codex/claude가 missing이면 Step 2/3을 다시 확인한다.

### Step 6 — Quick run

```bash
pnpm relay-baton init
pnpm relay-baton run "README의 오타를 찾아 고쳐줘" --diet balanced
```

Codex가 quota/context 한도에 닿으면 자동으로 Claude로 넘어간다. 진행은 TUI로도 볼 수 있다:

```bash
pnpm relay-baton tui
```

## 3. Agent에게 알려야 할 안전 규칙

설치를 agent에게 맡길 때 다음을 반드시 지키게 한다:

1. **API key를 출력하지 마라.**
2. **API key를 파일에 저장하지 마라.**
3. **`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`를 새로 set 하지 마라.** relay-baton은 CLI subscription 인증을 사용한다.
4. `sudo` / 관리자 권한이 필요한 단계는 사용자에게 먼저 확인을 받아라.
5. nvm/Node 버전 충돌이 의심되면 강제 덮어쓰지 말고 사용자에게 보고해라.
6. 자동 commit / push 하지 마라.

## 4. 트러블슈팅

| 증상 | 해결 |
|---|---|
| `pnpm: command not found` | `corepack enable && corepack prepare pnpm@9 --activate` |
| `codex login` 후에도 doctor에서 missing | 새 셸을 열어 PATH를 다시 로드 |
| Claude가 `Not logged in` | `claude` 단독 실행 → `/login` |
| build 실패: `error TS...` | `pnpm install` 다시, 그래도 실패면 `rm -rf node_modules dist && pnpm install && pnpm build` |
| `usage limit reached` 등으로 fallback 되지 않음 | `relay-baton.config.json`의 `fallbackPatterns`를 자신의 CLI 출력에 맞게 추가 |
| Windows에서 `LF will be replaced by CRLF` 경고 | 동작에는 영향 없음. 무시하거나 `.gitattributes`로 통일 |

## 5. 설치 완료 후 다음 할 일

- 루트의 [`README.md`](../README.md)에서 명령어와 token diet profile 설명을 확인한다.
- 자신의 프로젝트 디렉터리에서 `relay-baton init`을 실행해 `.ai-session/`을 만든다.
- `AGENTS.md` / `CLAUDE.md`가 있는 프로젝트라면 그대로 두면 된다. relay-baton은 그 내용을 inline하지 않고 참조만 한다.
