<div align="center">

# ⚡ relay-baton

**Harnais de transfert sobre en tokens entre Codex CLI ↔ Claude Code**

Passe le témoin d'un agent de codage à l'autre — sans gaspiller ton budget de tokens.

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

---

> **Mission du projet**
>
> 💡 **Dépenser le moins de tokens possible tout en fusionnant Codex CLI et Claude Code CLI dans un seul flux de travail.**
>
> Lorsqu'un agent atteint une limite de quota / contexte, le suivant reprend exactement depuis le même état du dépôt — sans recoller les logs, le diff ou le repo entier. Le transfert ne porte qu'un *résumé compact* et des *références de fichiers*. Voilà pourquoi relay-baton est un *token diet harness* : ce n'est pas une fonctionnalité bonus, c'est la raison d'être du projet.

## ✨ Fonctionnalités

- 🪄 **Fallback automatique** — Détecte `quota exceeded`, `rate limit exceeded`, `maximum context length` dans la sortie Codex et bascule vers Claude Code.
- 📉 **Régime de tokens** — Cinq profils (`off · lite · balanced · caveman · ultra`), compaction déterministe (exclusion des fichiers lock / build / `*.min.js`, log tail, repo map).
- 🛡️ **Authentification sûre par défaut** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` **ne sont pas** transmises aux processus enfants par défaut.
- ✅ **Quality gates** — Vérifient la complétude du transfert et le budget de tokens avant le lancement de l'agent fallback.
- 🧰 **Login en un coup** — `relay-baton login` ouvre les flux d'auth Codex / Claude.
- 🎛️ **TUI Ink** — État de session, disponibilité des agents et budget en un coup d'œil.
- 🚫 **Aucun appel API direct** — uniquement des sous-processus CLI locaux.

## 🚀 Démarrage rapide

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "Corrige le flux d'upload des pièces jointes" --diet balanced
```

## 📝 Notes de version

| Version | English | 한국어 | Résumé |
|---|---|---|---|
| v0.2.0 | [notes](../../release-notes/v0.2.0.md) | [릴리즈 노트](../../release-notes/ko/v0.2.0.md) | Ajoute project registry, `--project` / `--path`, commandes project et dashboard TUI. |
| v0.1.0 | [notes](../../release-notes/v0.1.0.md) | [릴리즈 노트](../../release-notes/ko/v0.1.0.md) | MVP Codex-to-Claude handoff avec token diet, fallback detection et quality gates. |

## 🧭 Utilisation

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "tache" --diet balanced
pnpm relay-baton handoff --to claude --no-run --diet caveman
```

Enregistrer et utiliser un projet:

```bash
pnpm relay-baton project add /path/to/repo --name relay-baton --diet caveman --primary codex --fallback claude
pnpm relay-baton project switch relay-baton
pnpm relay-baton status --project relay-baton
pnpm relay-baton budget --project relay-baton
pnpm relay-baton tui --project relay-baton
```

## 🤖 Installation en une ligne via un agent

[`install/install.md`](../../install/install.md) est à la fois un guide humain et un *instruction surface* directement exécutable par Codex / Claude Code.

```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton. Do not print or store API keys."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step."
```

## 📋 Prérequis

| Élément | Version / Note |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | requis |
| `codex` | **abonnement ChatGPT Plus ou supérieur requis** |
| `claude` | **abonnement Claude Pro ou supérieur requis** |

> ### 💳 À propos des abonnements
>
> relay-baton **n'appelle jamais directement** l'API OpenAI / Anthropic. Il utilise l'**authentification par abonnement** des CLIs locaux.
> - Les comptes gratuits ne fonctionneront pas de manière fiable.
> - L'auth par clé API est techniquement possible mais **bloquée par défaut** derrière `--allow-api-key-env`, pour éviter une facturation à l'usage non intentionnelle.

## 🔑 Connexion

```bash
pnpm relay-baton login           # les deux
pnpm relay-baton login codex
pnpm relay-baton login claude
```

Si `claude --version` répond, ça ne veut **pas** dire que tu es connecté. En cas de "Not logged in", relance la commande.

## 🧭 Commandes

| Commande | Description |
|---|---|
| `relay-baton init` | Créer `.ai-session/` |
| `relay-baton doctor` | Diagnostic de l'environnement |
| `relay-baton login [agent]` | Login Codex / Claude |
| `relay-baton run "<tâche>"` | Lancer Codex, détecter le fallback, passer à Claude |
| `relay-baton handoff --to claude` | Transfert manuel |
| `relay-baton compact` | Reconstruire compact-state / repo-map / full-diff |
| `relay-baton budget` | Affiche le budget de contexte |
| `relay-baton compress <fichier>` | Compaction déterministe de Markdown |
| `relay-baton status` | Statut de session |
| `relay-baton tui` | TUI Ink |

## 📉 Profils de régime

`off` · `lite` · `balanced` *(défaut)* · `caveman` · `ultra`

> `caveman` n'est **pas** un ton plaisantin — cela signifie *aggressive minimal-context*. La précision technique est conservée.

## 🛡️ Sécurité auth & facturation

- **Jamais** de stockage, d'affichage ou de log de clés API.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` sont supprimées de l'environnement des processus enfants par défaut.

## 🎯 Principes de conception

1. C'est un **transfert de travail**, pas un relais de chat.
2. L'**état actuel du dépôt** prime sur l'historique de conversation.
3. Le transfert doit être **lisible par un humain**.
4. Toute UI n'est qu'une coquille fine sur `core`.
5. **Le régime de tokens n'est pas une option secondaire — c'est le cœur du produit.**

## 📄 Licence

MIT. Voir [`LICENSE`](../../LICENSE).

> ℹ️ Documentation complète : [English README](../../README.md) et [`install/install.md`](../../install/install.md).
