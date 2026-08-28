# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@brand/Brand.md

## What Pathflo is

Pathflo is a project-management + AI-adoption **consulting practice first, self-serve SaaS second** — as
of the site revamp, `app/page.jsx` (the homepage) sells a $20K / ~4-week sprint and an optional
$200/hr retainer (capped at 80 hrs/month) that teach a client's own team the underlying methodology
(a 3-phase, 12-module curriculum:
institutional AI memory, forecasting/predictive modeling, risk scoring, comment rollup, charting,
document generation, review architecture, and more). This is the primary go-to-market now; don't revert
the homepage back to SaaS-first framing without being asked.

The underlying methodology is still a critical-path/execution-risk analysis engine: describe a project as a
task list with durations, owners, and dependencies, and it computes the critical path, a delivery-confidence
score, per-task failure probabilities, and a cascade-impact simulator ("what happens if task X slips N
days"), then has an LLM turn that math into a plain-language risk readout, a stakeholder-specific rewrite,
and (at the Team tier) a "work backwards from a fixed deadline" plan. That engine now lives behind
`app/software/page.jsx` (see Architecture below) as the self-serve product — `$0` / `$49`/mo Solo /
`$99`/mo Team, see the `pricing` array there — a secondary offering under the same brand, not the front
door.

The uploaded `MR_Operating_Partners` deck describes a third packaging of the same core capability —
installed and run for a private-equity portfolio company rather than sold as self-serve software or taught
as a curriculum. Treat all three (consulting curriculum, self-serve SaaS, portfolio-ops deck) as the same
core methodology (critical-path math + predictive milestone-chaining + cascade/risk narration + a
disciplined, fact-checked way of using AI) aimed at different buyers, not unrelated products. The deck's
"proof, not theory" positioning — self-validated forecasting backtested against real completed projects —
is a useful signal for what this engine is expected to eventually prove out, even though nothing in this
codebase currently implements backtesting against real historical outcomes; the confidence/risk scores
are heuristic weightings today (see `computeConfidence`/`computePredictiveRisk` below), not validated
predictions. If asked to make the scoring "self-validating" or accuracy-backtested, that's new work, not
something already implemented.

## Commands

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build

There is no lint, typecheck, or test setup in this repo (no ESLint config, no test framework, no CI). Verify changes by running `npm run dev` and exercising the flow in a browser, or `npm run build` to catch compile errors.

## Architecture

Pathflo is a Next.js (App Router) app. There's no state management library — flow between pages is done
by serializing plan/result data into URL query params (or `id` lookups against Supabase), which each
page's `useSearchParams`/`useEffect` picks up on mount.

**Page flow**: two entry points. `app/page.jsx` is the consulting-first homepage (the $20K sprint / $10K-mo retainer pitch, the curriculum, objection-handling) — this is what a first-time visitor sees. `app/software/page.jsx` is the self-serve SaaS product's marketing page (how-it-works, agent roster, pricing, interactive demo) → `app/app/page.jsx` (conversational wizard) → `app/results/page.jsx` (CPM engine + AI readout). The wizard's "back to home"/logo links point to `/software`, not `/`, since a mid-task user is in the product, not the consulting site.

- **`app/app/page.jsx`** — A scripted chatbot UI (not an LLM chat) that walks the user through naming a project, setting start/target dates, and adding tasks one at a time (name → owner → duration → dependencies). State machine driven by a `stage` string and an `advance(val)` function that pattern-matches on stage to decide the next bot message. Tasks accumulate in `tasks` state as `{id, name, owner, days, predecessors, concurrent}`. On completion, task data is either saved to Supabase (`/api/projects`, if signed in) or serialized to JSON and passed via the `?data=` query param to `/results`. Supports revising an existing plan via `?revise-id=` or `?revise=`.

- **`app/results/page.jsx`** (~2300 lines) — The core engine, all in one file:
  - `computeCPM(tasks, startDate, targetDate, budget)` — forward/backward-pass critical path method: computes earliest/latest start/finish and slack per task, project duration, buffer days vs. deadline, and a verdict (`ON TRACK` / `AT RISK` / `DEADLINE OVERRUN`). Also detects "shuffle opportunities" (sibling tasks sharing a predecessor that could run concurrently) and computes both a current and an "optimized" confidence score.
  - `computeConfidence(...)` — weighted score (0–100) from timeline tightness, budget pressure, scope-vs-capacity, external dependencies, owner concentration, sequencing, and optimization gaps. Heuristic weights, not fit against real outcome data.
  - `computePredictiveRisk(...)` — per-task failure probability from slack, owner concentration on the critical path, dependency chain depth, and downstream dependent count. Same caveat: heuristic, not backtested.
  - `computeCascadeImpact(...)` — "what if task X slips N days" simulator; re-runs `computeCPM` on a modified task list and diffs the outcome (new finish date, newly-blocked tasks, confidence delta, cost exposure).
  - The page also renders the dependency graph, calls `POST /api/analyze` to get the AI-generated agent readout, and handles saving/loading projects and PDF/link sharing.
  - All of the above math is pure and client-side; only the AI commentary requires the API route.

- **`app/api/analyze/route.js`** — Server route that runs a chain of prompts against the Anthropic API (`ANTHROPIC_API_KEY` env var) to turn the raw project/CPM data into human-readable output: Risk Scanner → Fix Generator + Cascade Modeler (parallel) → Executive Writer, always run. Stakeholder Adapter (3 audience-specific rewrites) and Deadline Reverse-Engineer run conditionally based on `projectData.tier` (`free` < `solo` < `team`, see `tierAtLeast`) — this is the **single place** tier-gating logic lives; don't reimplement the free/solo/team hierarchy elsewhere. Each "agent" is just a distinct system prompt with a fixed output format the frontend parses via regex — there's no structured output / tool use.

- **`app/api/projects/route.js`** + **`lib/supabase.js`** — Supabase-backed project persistence (GET/POST/DELETE on a `projects` table with RLS, see `supabase-setup.sql`). Auth is passed as a Bearer token from the client's Supabase session; the API route creates a per-request Supabase client scoped to that token rather than using a service role key. Supabase project URL and anon key are hardcoded in both `lib/supabase.js` and `app/api/projects/route.js` (not env vars) — keep them in sync if they ever change.

- **`app/auth/callback/page.jsx`** — Handles the Supabase OAuth/magic-link redirect (`exchangeCodeForSession`), then forwards to `/app` or a `?next=` target.

## Plan Mode is mandatory before starting work, not optional, when a task:

- touches more than 2 files
- changes the scoring/formula logic in `computeCPM`, `computeConfidence`, `computePredictiveRisk`, or `computeCascadeImpact`
- changes tier-gating logic (`tierAtLeast`, the free/solo/team hierarchy) or pricing
- changes the Supabase schema (`supabase-setup.sql`) or what gets persisted per project
- adds a new page/route, a new backend service, or a new data pipeline (i.e. a new "system," not a tweak to an existing one)
- restructures this CLAUDE.md itself

Use the harness's real `EnterPlanMode` tool — write the plan, get explicit approval — **before** any edit, not a verbal "here's my plan" followed immediately by tool calls. Trivial, single-file, obviously-scoped fixes (a copy tweak, a color change, a one-line bug fix) don't need it — don't over-apply this to busywork. This mirrors the standing rule already in production on the user's other project (GL Insights / Mighty Monday Power Points), adapted to what "non-trivial" means here.

## Custom subagents — real, built

Mirrors the pattern already in production on the user's other project (GL Insights / Mighty Monday Power
Points), adapted to Pathflo's actual codebase. Defined as real Claude Code custom subagents in
`.claude/agents/*.md`: `wizard` (router), `code-architect` (mandatory first), `scoring-engine-reviewer`,
`prompt-chain-reviewer`, `layout-consistency-reviewer`, `data-integrity-reviewer`, `completion-critic`
(mandatory last). Each file's own frontmatter (`description`) is the source of truth for exactly what it
checks — not duplicated here to avoid the two drifting out of sync; read the `.md` file directly.

Standing rule: consult `wizard` before dispatching agent work on any non-trivial task in this repo —
don't fire a bare `general-purpose` agent as a substitute for routing through it first. Dispatch order:
`code-architect` first on anything touching code, unconditionally; `completion-critic` last on every task,
unconditionally; the domain reviewers in between, whichever apply per `wizard`'s plan.

**Environment caveat**: if this session's `Agent`/`Task` tool doesn't expose these by name via
`subagent_type` (only generic built-in types show up), fall back to reading the target agent's `.md` file
directly and embedding its full persona/checklist as instructions inside a `general-purpose` agent call —
this produces the same real, checkable findings. Try the real name first; only fall back silently if it fails.

Always independently fact-check a reviewer's findings against the real current code before acting on
them — a review pass can produce false positives.

## Product roadmap — fundamental systems update

These are proposed, not-yet-built directions for Pathflo's engine, synthesized from three sources: the
MR Operating Partners deck's positioning (self-validated, backtested milestone-chain forecasting; portfolio
vs. single-company deployment), the mature patterns already proven out on the user's GL Insights project
(chain-projection from the last real anchor, honest data-quality surfacing, fact-checked verification before
shipping), and gaps in Pathflo's current heuristic scoring. **None of this is implemented yet** — each item
needs its own Plan Mode pass (per the rule above) before code changes, since each is a genuine
architecture change, not a tweak.

1. **Backtested/self-validating confidence scoring.** Today `computeConfidence`/`computePredictiveRisk` are
   fixed heuristic weightings (timeline tightness × 0.25, etc. — see `app/results/page.jsx`) with no evidence
   they predict real outcomes. To make the "self-validated" claim in the MR Operating Partners deck true for
   Pathflo: persist actual task completion dates (not just the plan) per project in Supabase, then build a
   chain-validation backtest — for each completed project, treat only the first N of its milestones as known,
   project the rest forward, and compare the projection to what actually happened. Reliability / bias / accuracy
   numbers come out of that comparison, not out of the current fixed weights. Requires a schema change
   (actual dates, not just planned `days`) — Plan Mode required.

2. **Milestone-chain forecasting from real historical durations.** Today task duration is whatever the user
   types in during the wizard (`currentTask.days`) — there's no learning from prior projects. A chained
   forecast (mirroring the technique already proven on GL Insights: project each remaining milestone by
   adding that milestone's real historical average duration to the last actually-completed anchor date,
   rather than the user's own estimate) would need a durations-by-task-type/owner dataset accumulated
   across a user's own completed projects — only meaningful once (1) exists and there's enough completed-
   project history to compute real averages from.

3. **Honest data-quality surfacing in the risk UI.** When a score is based on thin data (few historical
   completions, a brand-new owner, a task type never seen before), say so in the UI rather than presenting
   every score with equal confidence — the same principle GL Insights applies to blank/sentinel/backwards-
   date cells. Concretely: a `dataQuality`/`sampleSize` flag alongside each computed score, surfaced as a
   visible caveat, never silently blended into the number as if it were equally reliable.

4. **Portfolio-wide view.** The MR Operating Partners deck's "portfolio-wide vs. single-company" deployment
   split has no equivalent in this codebase — Pathflo today is strictly one project at a time (`/app` →
   `/results`). A portfolio rollup (multiple projects, aggregated risk/confidence across all of them) would be a
   new page/route, a new Supabase query pattern (per-user project list already exists via `/api/projects`,
   but nothing aggregates across it), and arguably a new pricing tier — genuinely new system, not a
   modification of `/results`.

5. **Verification standard for shipping scoring changes.** Whatever from (1)–(4) actually gets built: before
   calling it done, run it against a concrete before/after example (a real task list through the new code path)
   and show the actual numbers, not just that the code compiles/reads correctly — same fact-check-gate
   principle as the Engineering conventions section below, called out here because a scoring/forecasting
   change is exactly the kind of thing that "looks right" in a diff and is wrong in practice.

## Engineering conventions for this project

- **Fact-check before calling something done.** Verify a fix or new score against a real computed example (actual task list through `computeCPM`/the API route), not just that the code reads correctly. This matters especially for `computeConfidence`/`computePredictiveRisk`/`computeCascadeImpact` — a plausible-looking weight change can silently produce nonsense scores at the edges (0 tasks, 1 task, all-concurrent, all-sequential).
- **Honest empty/degenerate states, never a fabricated number.** `computeConfidence` already does this correctly (clamps but never invents a score with `totalTasks === 0`); preserve that pattern in any new scoring logic — a missing input should short-circuit to an explicit "not enough data" state, not a guessed number.
- **When a value is "wrong" in the UI, trace the full path before touching code**: `computeCPM`/related functions → the `result` object → the specific JSX reading it → (if AI-generated) the regex parsing `app/api/analyze/route.js`'s response. Most "wrong number" bugs will be in one of those hops, not in the math itself.
- **Single source of truth for shared constants.** Color tokens (`T`/`C` objects) and the free/solo/team tier hierarchy are each currently duplicated or centralized inconsistently — see the Notes below. Don't add a third copy; if you need the same value in a new file, either import it or flag the duplication rather than hand-copying values that can drift.

## Notes

- All pages/components are hand-rolled with inline `style={{...}}` objects (no CSS framework, no component library). Shared color tokens are redefined per-file as a local `T`/`C` object rather than imported from a common module. `app/page.jsx` and `app/software/page.jsx` now source their palette from `brand/Brand.md` (imported above) — `app/app/page.jsx` and `app/results/page.jsx` are still on the old dark palette, not yet migrated; don't assume the same values apply there without checking.
- `app/Layout.jsx` (capital L) and `app/layout.jsx` are duplicate files with identical content — only `app/layout.jsx` is used by Next.js App Router; the capitalized one appears to be a stray/unused copy.
- The root `index.html` is a standalone static file (not referenced by the Next.js build or `public/`) — appears to be a legacy/reference mockup, not part of the served app.
