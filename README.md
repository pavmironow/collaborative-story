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

## Tech stack (proposed)

- **Nuxt 4 + Nuxt UI** for the frontend and server routes. The event requires Vue.
- **Real-time:** Nitro WebSockets, or a hosted service (Supabase Realtime, PartyKit, Liveblocks). The team decides at kickoff.
- **State:** the server owns the room state (players, rounds, timers). A room lives in memory or in one small DB table.
- **AI:** an LLM API (e.g. Claude) that merges the Chaos Mode fragments. The prompt is strict about keeping each contributor's ideas.
- **Deploy:** a public URL, so judges and the audience can join from their phones during the demo.

## Possible task split

| Person | Focus |
| --- | --- |
| 1 | Real-time room server: join, lobby, round/turn state machine, timers |
| 2 | Create/join/lobby screens (mobile-first, Nuxt UI) |
| 3 | Writing/waiting screens, timer and character counter, reconnect after refresh |
| 4 | AI chapter merge: prompt, streaming, reveal screen with the fragments |
| 5 | Finished story page, sharing, deploy, demo script |

## Setup

_Coming soon; this will be filled in during the hackathon._

```bash
pnpm install
cp .env.example .env   # add AI API key
pnpm dev
```

## AI usage

- **In the product:** merging Chaos Mode chapters (core feature), optional theme expansion, optional cover image.
- **In development:** AI coding assistants (Claude Code etc.). Disclosed as required by the rules.

## Known limitations

_To be filled in at the end of the hackathon._
