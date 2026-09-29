# Collaborative Story ✍️ — PragVue Hackathon 2026

> A multiplayer writing game where your group writes a short story together in timed rounds. In **Chaos Mode**, everyone writes at the same time and AI combines the pieces into one chapter.

**Looking for teammates (up to 5 total).** If you like Vue, real-time apps, or AI prompting, come and join.

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
