# Tally — build plan

A one-screen habit tracker. Portfolio piece: the craft is in how it feels. Keep scope exactly as written; don't add features.

You (the main agent) coordinate. The `design-engineer`, `backend` and `tester` subagents do the work. Keep their briefs and reports short.

## Stack

Already scaffolded with `npm create convex@latest` (React + Vite + TypeScript). Add only: `motion`, `sonner`, `@number-flow/react`. Tests: `vitest`, `convex-test`, `@edge-runtime/vm`.

## Product

- List of habits. Each card shows the habit name, its current streak (e.g. "5 days"), and whether it's logged today.
- **Add** a habit from an input at the top (name, 1–60 characters).
- **Tap** a card to log today. Tap again to undo today's log.
- **Hold** a card to delete it (fill sweeps across while holding; releasing early cancels).
- **Swipe** a card left to archive it.
- After delete or archive: a Sonner toast with **Undo**.
- **Empty state** when there are no habits.
- **7-day milestone:** a small, one-time celebration when a streak reaches 7.
- First load: the list enters once with a short stagger. Never again during the session.
- Built mobile-first; must feel native on a phone.

No accounts. Each browser gets an `ownerId` (a random UUID stored in `localStorage`), sent with every call.

## Streak rules (the backend's core logic)

- Dates are the user's local date as `YYYY-MM-DD`, sent by the client as `today`. The server never computes "today".
- A habit has at most one log per date. Logging twice on the same date is a no-op.
- **Current streak** = number of consecutive logged dates ending on `today`, or ending on yesterday if today isn't logged yet (the streak is still alive until the day ends). Otherwise 0.
- Archived or deleted habits don't appear in `list`.

## API contract (both agents build against this; don't change it without telling the main agent)

All functions take `ownerId: string` and throw if the habit doesn't belong to that owner.

| Function | Type | Args | Returns |
| --- | --- | --- | --- |
| `habits.list` | query | `ownerId`, `today` | `{ _id, name, streak, loggedToday, _creationTime }[]`, oldest first |
| `habits.create` | mutation | `ownerId`, `name` | the new habit's `_id`. Trims the name; throws if empty or over 60 chars |
| `habits.toggleToday` | mutation | `ownerId`, `habitId`, `today` | `{ loggedToday, streak }` |
| `habits.archive` | mutation | `ownerId`, `habitId` | `null` (sets `archivedAt`) |
| `habits.remove` | mutation | `ownerId`, `habitId` | `null` (sets `deletedAt`; soft delete so Undo works) |
| `habits.restore` | mutation | `ownerId`, `habitId` | `null` (clears `archivedAt` and `deletedAt`) |

Tables: `habits` (`ownerId`, `name`, `archivedAt?`, `deletedAt?`, index `by_owner`) and `logs` (`habitId`, `date`, index `by_habit_date`). Streak logic lives in a pure helper, `convex/lib/streak.ts`, so it can be unit tested.

## Steps

0. **Design in Figma, then stop.** Start `design-engineer` alone to design Tally in a new Figma file named "Tally". Frames: the habit list (with a mix of logged and unlogged habits), empty state, a card's states (default, logged, pressed, holding to delete, swiping to archive), the Undo toast, and the 7-day milestone. Send me the file link and **wait for my approval or changes** before step 1. Then build to match the approved design.
1. **Build, in parallel.** Start `backend` (everything in `convex/`) and `design-engineer` (everything in `src/`) at the same time. Give each this file's path and its part of the work.
2. **Check it runs.** Run `npx convex dev --once` and `npm run build`. Fix wiring problems yourself if they're small; otherwise send them to the right agent.
3. **Test.** Start `tester` with all three checks: streak edge cases with convex-test (same-day double log, gap days, yesterday-only, midnight boundary, archived/deleted, wrong owner), break-ui on the habit card, and review-animations on the motion code.
4. **One fix round.** Send each failure or Block finding to the agent that owns the file. Re-run only the failed tests. Don't start a second round; list anything left over instead.
5. **Sync Figma.** Have `design-engineer` update the Figma file wherever the build changed from the design.
6. **Report to me:** what was built, test results, review verdict, anything left over, which interactions I should check on my phone, and how to preview it (`npm run dev`, plus the URL to open on my phone).

## Preview

`npm run dev` must start both the Vite app and Convex. Configure Vite with `server.host: true` so the app is reachable from a phone on the same Wi-Fi.
