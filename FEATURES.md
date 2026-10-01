# Features & workflow

## Rule: one feature = one branch = one PR

1. Branch from the latest `master` and name it `feat/<name>` from the table below.
2. Keep the PR small and focused on one feature. Open it as a normal PR (not a draft) once the feature works.
3. Before you ask for review, run `pnpm test` and make sure it passes.
4. In the PR description, name the [objectives](README.md#goal) the PR delivers and the [must-never-break rules](README.md#what-must-never-break) it touches.
5. Review the diff, then **squash-merge** and delete the branch.
6. Merge often. Rebase on `master` whenever a PR your feature depends on has been merged. Don't let a branch live longer than about 1.5 hours.

## Feature list

Features are listed in build order. **Blocks** means the feature can't start until those PRs are merged.

### Must have (the demo path)

| # | Branch | What's included | Blocks | Est. |
| --- | --- | --- | --- | --- |
| F0 | `feat/scaffold` | Nuxt 4 + Nuxt UI, Vitest, Supabase client, `.env.example`, first deploy to a public URL | none | 30 min |
| F1 | `feat/game-rules` | Pure functions in `shared/game.ts` for turns, round close, skips, game end and validation, plus all 🧪 unit tests | F0 | 45 min |
| F2 | `feat/supabase-schema` | Migrations for `rooms`, `players`, `fragments`, `chapters`; RLS (drafts hidden until the round closes); anonymous auth; realtime publication | F0 | 45 min |
| F3 | `feat/create-room` | Host screen: theme, mode, rounds, character limit, timer; server-side validation; room code and invite link | F1, F2 | 40 min |
| F4 | `feat/join-lobby` | Join by link and name; lobby with the Presence list, rules summary and copy-link button; host starts the game (players and rules lock) | F2, F3 | 45 min |
| F5 | `feat/chaos-round` | Writing screen with countdown and character counter; submit; waiting screen; `POST /close-round` that closes only once; advancing to the next round | F1, F2, F4 | 60 min |
| F6 | `feat/ai-merge` | AI merge prompt in `close-round`; reveal screen with the chapter next to the credited fragments; fallback to raw fragments if the AI fails | F5 | 45 min |
| F7 | `feat/finished-story` | Story page with the full text and author credits, readable on a phone, opened by a share link | F5 | 30 min |
| F8 | `feat/reconnect` | Refresh or reconnect puts the player back in their seat and phase; clear connection and error labels | F4, F5 | 30 min |

### Nice to have (only once the must-haves are merged and the demo works)

| # | Branch | What's included | Blocks |
| --- | --- | --- | --- |
| F9 | `feat/ordered-modes` | Fixed and random turn order (the rules already exist in F1) | F5 |
| F10 | `feat/theme-expansion` | AI turns the host's theme into an opening premise that the host can edit | F3 |
| F11 | `feat/cover-image` | AI cover for the finished story, optional and never blocking | F7 |
| F12 | `feat/polish` | Visual polish, accessibility checks, PWA manifest | any time |

## Parallel tracks

F0 must be merged first, by about 0:30. After that, several features can be built in parallel:

```
F0 ─┬─ F1 ─────────┐
    └─ F2 ── F3 ── F4 ── F5 ─┬─ F6
                             ├─ F7
                             └─ F8      then F9 / F10 / F11 / F12
```

- **Track A (game rules and flow):** F1 → F5 → F9
- **Track B (Supabase):** F2 → F4 → F8
- **Track C (screens):** F3 → F7 → F12
- **Track D (AI):** prototype the merge prompt with fake fragments from 0:30, then build F6 once F5 is merged; F10 and F11 after that

Critical path: **F0 → F2 → F3 → F4 → F5 → F6**, about 4.5 h if each feature is built only after the one before it. This path needs the most attention. Tracks A, C and D must prepare their parts in advance so they don't wait on it.
