<div align="center">

# relay-baton

**Infrastructure portable de continuation pour agents de codage.**

Transmet un état de codage compressé entre Codex CLI, Claude Code et ce qui viendra ensuite — sans recoller le log de chat, le diff ou le dépôt.

[English](../../README.md)
 · [한국어](./README.ko.md)
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · **Français**
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

```bash
# Codex frappe un mur de quota au milieu d'une tâche. relay-baton détecte,
# construit un handoff compact à partir de l'état réel du dépôt, et Claude continue.
$ relay-baton run "refactoriser le pipeline d'upload" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Pourquoi ça existe

Le travail de codage IA se fragmente entre outils. Une vraie session ressemble à ça :

- Codex CLI pour un lot d'éditions.
- Claude Code pour un autre.
- Un portable le matin, une autre machine le soir.
- Une fenêtre de contexte qui se remplit, casse, ou tronque silencieusement.

La méthode par défaut aujourd'hui pour déplacer le travail entre agents est de **copier-coller le log de chat** — ou pire, vider le dépôt entier dans un prompt. Trois problèmes :

1. **Tokens.** Les logs de chat sont surtout du bruit. Tu paies ce bruit à chaque tour.
2. **Continuité.** L'agent suivant reçoit le *transcript*, pas l'*intention*.
3. **Fragilité.** Un fichier manqué, un diff périmé, et l'agent redémarre depuis une prémisse fausse.

relay-baton est un **harness local** qui se place sous les agents et transporte le *minimum d'état suffisant* à travers le handoff : un résumé compact, une carte du dépôt et des références fichiers — pas un transcript.

> **Dépense le moins de tokens possible tout en fusionnant Codex CLI et Claude Code CLI en un seul flux.**

## L'idée

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

Une passe de témoin pour agents de codage — primitive en 4 étapes :

- **Detect** détecter quand l'agent actuel n'est plus utile (quota, contexte, rate, errors).
- **Capture** capturer ce qui compte (état du dépôt, fichiers modifiés, décisions, étape suivante).
- **Compact** compresser sous un budget que l'agent suivant peut réellement consommer.
- **Hand off** passer la main seulement après les quality gates.

Le handoff est un petit fichier (`.ai-session/handoff.md`) + des références. Le lourd (diff complet, log complet, repo map complet) reste sur disque et n'est chargé qu'à la demande.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # connexion Codex + Claude
pnpm relay-baton doctor         # vérification de l'environnement
pnpm relay-baton run "Corriger le flux d'upload des pièces jointes" --diet balanced
```

## Flux de travail

```bash
$ relay-baton init                  # crée .ai-session/
$ relay-baton run "corriger le test d'upload flaky" --diet balanced
... la sortie de codex est diffusée en direct ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude reprend, modifie les fichiers, termine ...

$ relay-baton status                # état de la session
$ relay-baton budget                # consommation du budget diet
```

Handoff manuel sans fallback automatique :

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Bascule entre plusieurs dépôts :

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "câbler le nouveau endpoint metrics"
```

## Fonctionnalités

- **Fallback automatique** — Détecte `quota exceeded`, `rate limit exceeded`, `maximum context length`, etc. dans la sortie de l'agent. Les lignes de résultat grep et la prose qui explique les patterns sont ignorées (évite les faux positifs).
- **Token diet** — 5 profiles déterministes (`off · lite · balanced · caveman · ultra`). Lock/build/min exclus, tail des logs, repo map à la place du source.
- **Quality gates** — Complétude et budget vérifiés *avant* le lancement du fallback.
- **Auth-safe par défaut** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` retirés des subprocess. Opt-in seulement via `--allow-api-key-env`. Jamais stockés, imprimés, ou loggés.
- **Project registry** — Enregistre plusieurs dépôts une fois, exécute des commandes contre n'importe lequel avec `--project` ou `--path`.
- **Ink TUI** — Tableau de bord project/session. Ne lance jamais d'agents.
- **Pas d'API propre** — relay-baton n'appelle pas l'API OpenAI / Anthropic. Uniquement les subprocess locaux `codex` / `claude`.

## Commandes

| Commande | Description |
|---|---|
| `relay-baton init` | Crée `.ai-session/` dans le dépôt courant |
| `relay-baton doctor` | Vérifie git / codex / claude / env / config |
| `relay-baton login [agent]` | Flux de login Codex / Claude |
| `relay-baton run "<task>"` | Lance l'agent primaire + détecte fallback + handoff |
| `relay-baton handoff --to claude` | Handoff manuel (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | Liste le handoff courant + les sauvegardes (métadonnées seulement) |
| `relay-baton compact` / `squeeze` | Régénère compact-state / repo-map / full-diff |
| `relay-baton budget` | Affiche l'usage du context budget |
| `relay-baton compress <file>` | Compression déterministe d'un markdown |
| `relay-baton status` | État de la session |
| `relay-baton project add/list/switch/current/doctor/remove` | Gestion du registry de projets |
| `relay-baton tui` | Tableau de bord Ink |

Les commandes project-aware acceptent `--project <name-or-id>` et `--path <repoPath>`. Priorité : `--path` > `--project` > projet actif > cwd.

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

Emplacement par défaut : `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE` override le chemin (CI, sandbox, tests). Un fichier corrompu est sauvegardé en `projects.json.corrupt-<timestamp>.bak` et le registry est réinitialisé vide — les commandes continuent à fonctionner.

## Token diet profiles

| Profile | Intention |
|---|---|
| `off` | Troncature minimale |
| `lite` | Nettoyage léger |
| `balanced` *(par défaut)* | Usage quotidien |
| `caveman` | Minimal agressif |
| `ultra` | Compression extrême |

> `caveman` **n'est pas un ton humoristique** — il signifie *aggressive minimal-context*. La précision technique est préservée.

## Face aux alternatives

| Approche | Ce qui passe | Coût en tokens | Continuité | Mode d'échec |
|---|---|---|---|---|
| Export brut du chat | Transcript entier | Élevé (majoritairement du bruit) | Fragile — l'agent relit son propre raisonnement | Débordement de fenêtre de contexte |
| Copier-coller prompting | Ce dont l'humain se souvient | Variable | Cassant | Drift silencieux par rapport à l'état réel |
| Dump du dépôt entier | Tout | Très élevé | Fort mais cher | Le modèle tronque en plein milieu |
| **relay-baton** | Résumé compact + repo map + références fichiers | **Faible, plafonné par profile** | Fort — guidé par l'état *réel* du dépôt | Échoue *bruyamment* via quality gates |

## Philosophie

relay-baton est **un outillage petit et aiguisé pour les workflows AI-natifs**.

- **Local-first.** Tout vit sur ton disque. Pas de cloud, pas de daemon, pas de télémétrie, pas de compte.
- **Composabilité.** Un dossier `.ai-session/` n'est que des fichiers. Lis-les, grep, diff, mets-les dans une PR.
- **Transfert d'état léger.** Un handoff est un fichier markdown, pas une base de données.
- **Déterministe avant tout.** Pas de résumé LLM dans le harness — si le modèle résume mal, le handoff ment. Budgets de caractères, règles structurelles, références explicites uniquement.
- **L'état du dépôt est la source de vérité.** La conversation est interprétation ; le dépôt est fait.
- **L'efficience en tokens est la fonctionnalité** — pas un bouton caché dans un menu.

### Principes de conception

1. C'est du **work handoff**, pas du chat relay.
2. **L'état actuel du dépôt** prime sur tout historique de conversation.
3. Le handoff doit être **lisible par un humain**.
4. Chaque UI est une fine couche au-dessus de `core`.
5. **Le token diet n'est pas une option secondaire — c'est la fonctionnalité centrale.**

## Direction future

relay-baton démarre comme un harness de fallback à deux agents. La même primitive s'étend :

- **Chaînes de relay multi-agent** — Codex → Claude → OpenCode → retour à Codex.
- **Arbres de session ramifiés** — Forke une tâche en tentatives parallèles ; réconcilie via diffs.
- **État de relay distant** — Push de `.ai-session/` vers un remote partagé pour que la machine suivante reprenne.
- **Workflows orchestrés** — Modes `review`, `diagnose`, `continue` (autopilot borné avec checkpoints explicites).
- **Plus d'adapters** — OpenCode, Gemini CLI, Aider, tout ce qui a une interface subprocess locale propre.

La forme du harness ne change pas : detect, capture, compact, hand off.

## Prérequis

| Item | Version / Note |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | requis |
| `codex` | **requiert un abonnement ChatGPT Plus ou supérieur** |
| `claude` | **requiert un abonnement Claude Pro ou supérieur** |

> relay-baton n'appelle pas directement l'API OpenAI / Anthropic. Il utilise l'**auth par abonnement** des CLIs locales `codex` / `claude`. L'auth par API key est techniquement possible mais **bloquée par défaut** (opt-in via `--allow-api-key-env`).

## Login

```bash
pnpm relay-baton login           # les deux
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version` qui passe ne veut **pas** dire connecté. Si tu vois "Not logged in", relance la commande ci-dessus.

## Notes de version

**Dernière :** v0.3.0 — [English](../../release-notes/v0.3.0.md) · [한국어](../../release-notes/ko/v0.3.0.md)

| Version | English | 한국어 | Résumé |
|---|---|---|---|
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | `ProjectResolver` sans effets de bord, sauvegarde/récupération automatique d'un `projects.json` corrompu, override via env `RELAY_BATON_PROJECTS_FILE`, nettoyage de `lastError` en cas de fallback. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Ajoute project registry, `--project` / `--path`, commandes project et dashboard TUI. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | MVP Codex-to-Claude handoff avec token diet, fallback detection et quality gates. |

## License

MIT. Détails dans [`LICENSE`](../../LICENSE).

> Documentation complète (détails des quality gates, sémantique des fichiers `.ai-session/`, schéma de config, raccourcis du TUI, troubleshooting) dans [English README](../../README.md) et [`install/install.md`](../../install/install.md).
