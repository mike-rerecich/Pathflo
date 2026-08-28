# Brand.md — Pathflo visual design system

Canonical source for color, typography, motion, and surface treatment on Pathflo's marketing pages
(`app/page.jsx`, `app/software/page.jsx`). If you're changing a color, a card style, a button, or an
animation on either of those pages, the values here are the single source of truth — don't invent a new
one inline. `/app` and `/results` are **intentionally not yet migrated** to this system (see Notes below);
don't assume the same rules apply there without checking.

## Design intent

"Crisp white, off-grey, green. Professional to a tee — the kind of site where the owner of a company
looks at it and says this is legit." That's a restrained, editorial, consulting-firm aesthetic, not a
SaaS-startup one. Concretely: real whitespace, a serif display face for gravitas, muted motion, and color
used only where it carries meaning (a button, a checkmark, a status badge) — never as ambient decoration.

## Palette

| Token | Hex | Use |
|---|---|---|
| `--white` | `#FFFFFF` | Primary background |
| `--offgrey` | `#F6F7F6` | Secondary/alternating section background |
| `--border` | `#E4E7E4` | Card and divider borders |
| `--text` | `#14171A` | Headings, primary body text |
| `--text-mid` | `#5B6560` | Secondary/body copy |
| `--text-dim` | `#8A928D` | Tertiary/meta text — **large or non-body use only, see contrast note** |
| `--brand` | `#3ECB6F` | Large fills, icons, highlights, illustrative accents — never small text |
| `--brand-deep` | `#166F42` | Button fills (with white text), links, small text-as-accent on white/off-grey |

**Contrast, actually computed (WCAG relative-luminance formula), not eyeballed**, since this project's own
fact-check-gate convention applies to design claims too:
- `--brand-deep` (#166F42) on `--white`: **6.2:1** — clears AA for body text (4.5:1) and large text (3:1).
- `--text-mid` (#5B6560) on `--white`: **6.0:1** — clears AA body text.
- `--text-dim` (#8A928D) on `--white`: **3.2:1** — clears the 3:1 large-text/UI-component floor, does
  **not** clear 4.5:1. Use it only for large text, icons, or non-text UI — never body paragraphs.
- `--brand` (#3ECB6F) on `--white`: **2.1:1** — fails AA at any text size. This is why `--brand-deep` exists;
  `--brand` is for fills/icons/illustration only, never text or a text-bearing button.

## Accent set — for multi-item diagrams only (the 6-agent chain, cards)

When something needs to distinguish several items at a glance (the 6-stage agent-chain diagram, its
matching card grid), use these — never invent a one-off hex for a "new" node/card. `--brand` doubles as
the first accent. All are small-swatch/icon/label use only, same restriction as `--text-dim` — none of
these are body-text-safe:

| Token | Hex | Use |
|---|---|---|
| `--brand` | `#3ECB6F` | Accent 1 (Risk Scanner) |
| `--accent-teal` | `#0E7490` | Accent 2 (Fix Generator) |
| `--accent-blue` | `#1D4ED8` | Accent 3 (Cascade Modeler) |
| `--accent-violet` | `#6D28D9` | Accent 4 (Exec Writer) |
| `--accent-purple` | `#7E22CE` | Accent 5 (Stakeholder Adapter) |
| `--accent-amber` | `#B45309` | Accent 6 (Deadline Reverse-Engineer) |
| `--danger` | `#DC2626` | The one negative/lacking indicator (e.g. a comparison table's ✕) — never decorative |

**The same agent gets the same accent color everywhere it appears** — the 6-agent chain diagram and its
card grid represent the same six things on both `app/page.jsx` and `app/software/page.jsx`; a color
picked for "Fix Generator" in one place is wrong if it's a different color in another. If a future page adds
a 7th item needing its own accent, add it here first, then use it — don't hand-type a new hex at the call
site.

## Typography

- **Display headings**: Fraunces (serif), the weight/italic pairing already established (700 roman /
  300 italic accent word) — this is what gives the page editorial/consulting gravitas rather than a
  tech-startup feel. Keep it.
- **Everything else** (body, labels, buttons, nav): DM Sans.
- **DM Mono is dropped from marketing pages.** The small monospace "terminal" labels used throughout
  the old dark design read as developer-tool, not consulting-firm. If a small all-caps label/eyebrow is
  needed, set it in DM Sans with letter-spacing instead.

## Motion

Restrained, not ambient. What's still allowed:
- Scroll-reveal fade + slide-up on section entry (`RevealSection`/`useReveal` — unchanged, already subtle)
- At most one small status-dot pulse (e.g. a "taking new engagements" badge)
- A simple, functional animated diagram where the motion itself communicates something (e.g. a
  step-by-step chain lighting up in sequence) — kept subdued, no glow

What's removed entirely from marketing pages: the animated particle-field canvas background, comet
streaks, halo rings, ember particles, grain/noise texture, and any glow-style `box-shadow` (a colored blur
behind text or a card). These were the dark-theme's visual signature and don't belong in this system —
if you're tempted to add one back "for polish," don't; ask first.

## Surfaces

- Sections alternate `--white` and `--offgrey` for rhythm — never a gradient, never a dark section.
- Cards: `--white` background, `1px solid var(--border)`, `border-radius: 14–20px`, and a soft **neutral**
  shadow — `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)`. No colored/glow shadows.
- No decorative colored top-bars on cards. Color appears only where it's meaningful: a button, a
  checkmark, a status badge, a numbered phase label.

## Buttons

- **Primary**: `--brand-deep` fill, white text, the soft neutral card shadow above (no glow), subtle
  `translateY` lift on hover — no color change on hover, the lift is enough.
- **Secondary**: `--white` fill, `1px solid var(--border)`, `--text` label; hover swaps the border to
  `--brand-deep` and the text to `--brand-deep`.

## Notes

- `/app` (the wizard) and `/results` (the CPM/confidence/risk dashboard) are **not** on this system yet —
  they're a dark-themed, chart-heavy working tool where a same-day recolor risks legibility regressions
  (risk color-coding, dependency-graph contrast, chart readability). Migrating them is real, separate,
  planned follow-up work — don't assume they should match this file until that's explicitly done.
- If you add a new marketing section/component and need a color or shadow not listed here, that's a
  sign this file needs a new entry — add it here, don't invent a one-off inline value that only that
  component knows about.
