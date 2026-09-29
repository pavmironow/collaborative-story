# Collaborative Story ✍️ — PragVue Hackathon 2026

> A multiplayer writing game where your group writes a short story together in timed rounds. In **Chaos Mode**, everyone writes at the same time and AI combines the pieces into one chapter.

**Looking for teammates (up to 5 total).** If you like Vue, real-time apps, or AI prompting, come and join.

## Goal

**Problem:** Group creative activities, such as icebreakers, team exercises and writing warm-ups, need setup and a moderator. They usually end with a pile of disconnected ideas instead of one shared result.

**Goal:** Let a group of people on their own devices go from a shared link to a finished, shareable story in about 10 minutes. Everyone's contribution should be visible, and AI should turn the parallel ideas into one story without dropping anyone's part.

**Hackathon objectives:** the demo is judged against these.
1. A new player opens the link on a phone or laptop and joins **without verbal instructions**.
2. Every player always knows **whose turn it is, how much time is left and how many rounds remain**.
3. Every player gets **exactly one fair chance to contribute per round**. Missed turns are skipped, not rewritten by AI.
4. In Chaos Mode, **nobody can see another player's draft** before the round closes. The AI chapter visibly includes the key ideas of **every** submitted fragment, shown next to the originals.
5. The group ends with a **finished story that credits its authors** and can be opened through a link.
6. The demo is **a real group playing live** on separate devices, not a walkthrough of screens.

## What must never break

These rules hold during every game. If a change breaks one of them, it's a bug, even if the UI looks fine. The ones marked 🧪 are enforced in `shared/game.ts` and covered by unit tests.

**Fairness**
- 🧪 Each player gets **exactly one** turn per round: never zero (unless skipped), never two.
- 🧪 In random order, nobody is picked twice before everyone has written in that round.
- 🧪 The player list and rules are **locked once the game starts**. Players can't join or change settings mid-game.
- 🧪 A missed turn is marked **skipped**. AI never writes on a player's behalf, and the player stays in later rounds.

**Game flow**
- 🧪 The game only moves forward: `lobby → writing → (merging → reveal) → … → finished`. It never goes back or skips a step.
- 🧪 A round closes **only** when everyone has submitted or the deadline has passed, and it closes **exactly once**, even if several clients ask at the same time.
- 🧪 The game **always finishes** after `rounds_total` rounds, even if some or all turns were skipped.
- Every client shows the same state: the same round, turn and deadline.

**Contributions**
- 🧪 A submission longer than the character limit is rejected. Text is never silently cut.
- A submitted fragment is **never lost or changed**. The original text is kept exactly as written.
- In Chaos Mode, **nobody can read another player's draft** before the round closes. The database (RLS) enforces this, not the UI.

**Resilience**
- A page refresh or reconnect brings the player back to **their own seat** in the current phase.
- If the AI fails or is slow, **the game continues**: the reveal screen shows the original fragments and the next round can start.
- The finished story stays readable through its link **without a cover image or any AI output**.

## The idea in 30 seconds

1. The host creates a room, types a theme (*"A Prague tram stops at a station that is not on any map"*), and picks the rules.
2. The host shares a link. Friends join from their phones or laptops by entering a name. No accounts needed.
3. Everyone writes in short, timed rounds with a character limit.
4. At the end there is a finished story page that credits every author, and you can share its link.

### Game modes

| Mode | How it works |
| --- | --- |
| **Fixed order** | Players take turns in a known order. Everyone can read the story so far. |
| **Random order** | Same as fixed, but the next writer is picked at random (each player writes once per round). |
| **Chaos Mode** ⭐ | Everyone writes at once and can't see anyone else's draft. When the round ends, **AI combines all fragments into one chapter**. The original fragments stay visible next to the chapter, so you can see how your idea was used. |

The AI may reorder the fragments, add transitions, and smooth the style. It **must keep every contributor's key ideas**. If two fragments contradict each other, the contradiction becomes part of the plot.

## Hackathon scope (5 h)

**Must have:** invite link → lobby → at least 2 real players on separate devices → timed rounds with character limits → **one complete Chaos Mode round** (fragments + AI chapter side by side) → finished story page with a share link. It also has to work on mobile.

**Nice to have:** fixed and random modes, AI expansion of the theme, an AI-generated cover image, visual polish.

## Tech stack

- **Nuxt 4 + Nuxt UI** for the frontend, plus Nuxt server routes for anything that needs a secret key.
- **Supabase** for the backend:
  - **Anonymous sign-in**: each player gets a real user ID with no signup, and a page refresh brings them back to their seat.
  - **Postgres**: stores rooms, players, fragments and chapters.
  - **Realtime Postgres Changes**: all clients update live when the room row changes (phase, round, turn, deadline).
  - **Presence**: shows who is online in the lobby.
  - **Row Level Security**: in Chaos Mode, players cannot read other players' drafts until the round closes. The database enforces this, not the UI.
- **AI:** an LLM (Claude) merges the Chaos Mode fragments into a chapter. It runs in a Nuxt server route, so the API key never reaches the browser.
- **Deploy:** a public URL, so judges and the audience can join from their phones during the demo.

### How it works

```
rooms      id, code, host_id, theme, mode, rounds_total, char_limit, time_limit_s,
           status (lobby | writing | merging | reveal | finished),
           current_round, turn_player_id, phase_ends_at
players    user_id, room_id, name, seat, joined_at
fragments  room_id, round, player_id, text          -- RLS: read own, or all once the round has closed
chapters   room_id, round, text, source_fragment_ids
```

- **Timers:** the server stores the deadline as `phase_ends_at`, and each client counts down to it locally. No timer runs on the server.
- **Closing a round:** once everyone has submitted or the deadline passes, any client calls `POST /api/rooms/:id/close-round`. The route closes the round with a conditional `UPDATE ... WHERE status = 'writing' AND current_round = N`, so only one call wins. The winner calls the AI, saves the chapter and moves the room to `reveal`.
- **If the AI fails:** the reveal screen shows the raw fragments, so the game never gets stuck.

## How we verify

We only write unit tests, using **Vitest**. All game rules are pure functions in `shared/game.ts`, with no Supabase or Vue imports, so they are fast and easy to test. Components and server routes call these functions and don't reimplement the rules.

The tests cover:
- **Turn order:** fixed order, and random order with no repeats within a round (everyone writes once per round).
- **Closing a round:** a round can close when everyone has submitted or the deadline has passed, and not before.
- **Missed turns:** a missed turn is marked as skipped, and the player still takes part in later rounds.
- **End of the game:** the game finishes after `rounds_total`, even if some turns were skipped.
- **Validation:** the character limit, the minimum of 2 rounds, and allowed settings ranges.
- Every 🧪 rule in [What must never break](#what-must-never-break).

```bash
pnpm test        # vitest run
```

Run `pnpm test` before every push. Nothing else is automated. Everything else (realtime, RLS, AI merge, UI) is checked by hand on real devices.

## Setup

_Coming soon; this will be filled in during the hackathon._

```bash
pnpm install
cp .env.example .env   # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server only), AI API key
pnpm dev
```

## AI usage

- **In the product:** merging Chaos Mode chapters (core feature), optional theme expansion, optional cover image.
- **In development:** AI coding assistants (Claude Code etc.). Disclosed as required by the rules.

## Known limitations

_To be filled in at the end of the hackathon._
