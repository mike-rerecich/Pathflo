# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build

There is no lint, typecheck, or test setup in this repo (no ESLint config, no test framework, no CI). Verify changes by running `npm run dev` and exercising the flow in a browser, or `npm run build` to catch compile errors.

## Architecture

Pathflo is a Next.js (App Router) app that turns a chat-collected project plan into a critical-path analysis with AI-generated risk commentary. There's no state management library — flow between pages is done by serializing plan/result data into URL query params (or `id` lookups against Supabase), which each page's `useSearchParams`/`useEffect` picks up on mount.

**Page flow**: `app/page.jsx` (marketing landing) → `app/app/page.jsx` (conversational wizard) → `app/results/page.jsx` (CPM engine + AI readout). `app/preview/page.jsx` is a near-duplicate of the landing page (separate route, same content) — check both if editing marketing copy.

- **`app/app/page.jsx`** — A scripted chatbot UI (not an LLM chat) that walks the user through naming a project, setting start/target dates, and adding tasks one at a time (name → owner → duration → dependencies). State machine driven by a `stage` string and an `advance(val)` function that pattern-matches on stage to decide the next bot message. Tasks accumulate in `tasks` state as `{id, name, owner, days, predecessors, concurrent}`. On completion, task data is either saved to Supabase (`/api/projects`, if signed in) or serialized to JSON and passed via the `?data=` query param to `/results`. Supports revising an existing plan via `?revise-id=` or `?revise=`.

- **`app/results/page.jsx`** (~2300 lines) — The core engine, all in one file:
  - `computeCPM(tasks, startDate, targetDate, budget)` — forward/backward-pass critical path method: computes earliest/latest start/finish and slack per task, project duration, buffer days vs. deadline, and a verdict (`ON TRACK` / `AT RISK` / `DEADLINE OVERRUN`). Also detects "shuffle opportunities" (sibling tasks sharing a predecessor that could run concurrently) and computes both a current and an "optimized" confidence score.
  - `computeConfidence(...)` — weighted score (0–100) from timeline tightness, budget pressure, scope-vs-capacity, external dependencies, owner concentration, sequencing, and optimization gaps.
  - `computePredictiveRisk(...)` — per-task failure probability from slack, owner concentration on the critical path, dependency chain depth, and downstream dependent count.
  - `computeCascadeImpact(...)` — "what if task X slips N days" simulator; re-runs `computeCPM` on a modified task list and diffs the outcome (new finish date, newly-blocked tasks, confidence delta, cost exposure).
  - The page also renders the dependency graph, calls `POST /api/analyze` to get the AI-generated agent readout, and handles saving/loading projects and PDF/link sharing.
  - All of the above math is pure and client-side; only the AI commentary requires the API route.

- **`app/api/analyze/route.js`** — Server route that runs a chain of prompts against the Anthropic API (`ANTHROPIC_API_KEY` env var, model `claude-sonnet-4-6`) to turn the raw project/CPM data into human-readable output: Risk Scanner → Fix Generator + Cascade Modeler (parallel) → Executive Writer, always run. Stakeholder Adapter (3 audience-specific rewrites) and Deadline Reverse-Engineer run conditionally based on `projectData.tier` (`free` < `solo` < `team`, see `tierAtLeast`). Each "agent" is just a distinct system prompt with a fixed output format the frontend parses via regex — there's no structured output / tool use.

- **`app/api/projects/route.js`** + **`lib/supabase.js`** — Supabase-backed project persistence (GET/POST/DELETE on a `projects` table with RLS, see `supabase-setup.sql`). Auth is passed as a Bearer token from the client's Supabase session; the API route creates a per-request Supabase client scoped to that token rather than using a service role key. Supabase project URL and anon key are hardcoded in both `lib/supabase.js` and `app/api/projects/route.js` (not env vars) — keep them in sync if they ever change.

- **`app/auth/callback/page.jsx`** — Handles the Supabase OAuth/magic-link redirect (`exchangeCodeForSession`), then forwards to `/app` or a `?next=` target.

## Notes

- All pages/components are hand-rolled with inline `style={{...}}` objects (no CSS framework, no component library). Shared color tokens are redefined per-file as a local `T`/`C` object rather than imported from a common module — if you change the palette, you likely need to edit it in multiple files (`app/page.jsx`, `app/preview/page.jsx`, `app/app/page.jsx`, `app/results/page.jsx`).
- `app/Layout.jsx` (capital L) and `app/layout.jsx` are duplicate files with identical content — only `app/layout.jsx` is used by Next.js App Router; the capitalized one appears to be a stray/unused copy.
- The root `index.html` is a standalone static file (not referenced by the Next.js build or `public/`) — appears to be a legacy/reference mockup, not part of the served app.
