import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-6";
const API_KEY = () => process.env.ANTHROPIC_API_KEY;

// Tier hierarchy: free < solo < team
function tierAtLeast(tier, required) {
  const order = { free: 0, solo: 1, team: 2 };
  return (order[tier] || 0) >= (order[required] || 0);
}

async function callClaude(system, userMessage, maxTokens = 1200) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${err}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

function formatProject(projectData) {
  return `Project: ${projectData.name}
Start: ${projectData.startDate}
Deadline: ${projectData.targetDate}
Daily burn rate: ${projectData.dailyBurnRate || "Not specified"}
Deadline stakes: ${projectData.deadlineStakes || "Not specified"}
Deadline penalty: ${projectData.deadlinePenalty || "Not specified"}

Tasks:
${(projectData.tasks || []).map((t, i) =>
  `${i + 1}. ${t.name} | Owner: ${t.owner || "UNASSIGNED"} | Duration: ${t.days}d${t.milestone ? " | MILESTONE" : ""}${t.predecessors?.length ? ` | Depends on: ${t.predecessors.join(", ")}` : ""}`
).join("\n")}`;
}

// ── Agent 1: Risk Scanner (FREE) ──────────────────────────────────────────────
async function runRiskScanner(projectData) {
  const system = `You are a project risk analyst. Given a project plan, identify the top 3-5 failure points.

For each failure point return exactly this format:
RISK: [name]
PROBABILITY: [0-100]%
TRIGGER: [what causes it — reference specific task names]
IMPACT: [what breaks downstream]
DOLLAR_EXPOSURE: [$ estimate if daily burn provided, else "Unknown"]

Be specific. Use actual task names. Do not hedge.`;

  return callClaude(system, formatProject(projectData), 800);
}

// ── Agent 2: Fix Generator (FREE) ─────────────────────────────────────────────
async function runFixGenerator(projectData, riskAnalysis) {
  const system = `You are a project execution strategist. Given a risk analysis, generate specific actionable fixes.

For each risk produce:
FIX: [action title]
ADDRESSES: [risk name from analysis]
ACTION: [exactly what to do — name specific tasks, people, or decisions]
DAYS_RECOVERED: [estimate, or 0]
EFFORT: [LOW / MEDIUM / HIGH]

Do not produce generic advice. Every fix must reference actual tasks or owners from the project.`;

  return callClaude(system, `${formatProject(projectData)}\n\nRISK ANALYSIS:\n${riskAnalysis}`, 900);
}

// ── Agent 3: Cascade Modeler (FREE) ──────────────────────────────────────────
async function runCascadeModeler(projectData, riskAnalysis) {
  const system = `You are a cascade impact modeler. Take the highest-probability risk and trace its exact domino effect through the project.

Return this structure:
SCENARIO: [risk being simulated]
TRIGGER_TASK: [task name]
TRIGGER_DELAY: [estimated slip in days]

CHAIN:
Step 1: [task name] slips X days — [why]
Step 2: [downstream task] now can't start until [date] — [why]
Step 3: [next task] blocked — [consequence]
... (up to 6 steps)

FINAL_OUTCOME: [net schedule impact in days and whether deadline is missed]
RECOVERY_WINDOW: [last moment action can be taken to avoid full cascade]`;

  return callClaude(system, `${formatProject(projectData)}\n\nRISK ANALYSIS:\n${riskAnalysis}`, 700);
}

// ── Agent 4: Executive Writer (FREE) ─────────────────────────────────────────
async function runExecutiveWriter(projectData, riskAnalysis, fixes, cascade) {
  const system = `You are an executive communications writer. Produce a clean, forwardable project status summary.

Format:
EXECUTIVE SUMMARY — [project name]

VERDICT: [one sentence — delivery confidence, key risk]

CRITICAL PATH: [2 sentences on the most critical sequence of tasks]

TOP RISKS:
• [risk 1 — one sentence]
• [risk 2 — one sentence]
• [risk 3 — one sentence]

RECOMMENDED ACTIONS:
1. [specific action — who does what by when]
2. [specific action]
3. [specific action]

SCENARIO IF NO ACTION TAKEN: [2 sentences on the cascade outcome]

BOTTOM LINE: [One direct sentence. What should leadership decide today?]

Write for a business owner or executive who has 60 seconds. No jargon. No hedging.`;

  return callClaude(system,
    `${formatProject(projectData)}\n\nRISK ANALYSIS:\n${riskAnalysis}\n\nFIXES:\n${fixes}\n\nCASCADE SIMULATION:\n${cascade}`,
    900);
}

// ── Agent 5: Stakeholder Adapter (SOLO+) ──────────────────────────────────────
async function runStakeholderAdapter(projectData, executiveSummary) {
  const system = `You are a professional communications strategist. Given a project status summary, rewrite it in three versions for three different audiences. Each version should be ready to send without editing.

Return exactly this structure — no extra commentary:

CLIENT VERSION:
[3-4 sentences. Reassuring tone. Lead with what's on track. Frame any risks as being actively managed. Do not mention internal team issues. End with confidence.]

TEAM VERSION:
[Bullet list of 4-6 specific actions. Name actual tasks and owners. Who does what, by when. Operational, direct, no fluff.]

EXEC VERSION:
[3-4 sentences. Risk-first. What is the financial or timeline exposure? What decision needs to be made at the leadership level? What happens if no action is taken?]`;

  return callClaude(system,
    `${formatProject(projectData)}\n\nEXECUTIVE SUMMARY:\n${executiveSummary}`,
    900);
}

// ── Agent 6: Deadline Reverse-Engineer (TEAM+) ───────────────────────────────
async function runDeadlineReverseEngineer(projectData, riskAnalysis) {
  const system = `You are a project schedule optimizer. The deadline is fixed and cannot move. Work backwards from it.

Return exactly this structure:

DEADLINE ANALYSIS — [project name]

CURRENT GAP: [how many days over or under the deadline the current plan is]

TO HIT THE DEADLINE, ONE OF THESE MUST HAPPEN:
Option A — CUT SCOPE: [exactly which tasks to remove or reduce, and how many days each saves]
Option B — COMPRESS TIMELINE: [which tasks can run in parallel or be shortened, and how]
Option C — ADD RESOURCE: [where adding a person or contractor would recover the most days]

FASTEST PATH TO GREEN: [one sentence — which option is most realistic given this project's constraints]

WHAT CANNOT BE CHANGED: [tasks that are on the critical path with zero flexibility — touching these makes things worse]`;

  return callClaude(system,
    `${formatProject(projectData)}\n\nRISK ANALYSIS:\n${riskAnalysis}`,
    800);
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { projectData } = await request.json();
    if (!projectData) {
      return NextResponse.json({ error: "projectData is required" }, { status: 400 });
    }
    if (!API_KEY()) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const tier = projectData.tier || "free";

    // Agents 1-4: all tiers
    const riskAnalysis = await runRiskScanner(projectData);
    const [fixes, cascade] = await Promise.all([
      runFixGenerator(projectData, riskAnalysis),
      runCascadeModeler(projectData, riskAnalysis),
    ]);
    const readout = await runExecutiveWriter(projectData, riskAnalysis, fixes, cascade);

    // Agent 5: Solo+ — Stakeholder Adapter
    let stakeholderVersions = null;
    if (tierAtLeast(tier, "solo")) {
      const raw = await runStakeholderAdapter(projectData, readout);
      const clientMatch = raw.match(/CLIENT VERSION:\n([\s\S]*?)(?=\nTEAM VERSION:|$)/);
      const teamMatch   = raw.match(/TEAM VERSION:\n([\s\S]*?)(?=\nEXEC VERSION:|$)/);
      const execMatch   = raw.match(/EXEC VERSION:\n([\s\S]*?)$/);
      stakeholderVersions = {
        client: clientMatch?.[1]?.trim() || raw,
        team:   teamMatch?.[1]?.trim()   || raw,
        exec:   execMatch?.[1]?.trim()   || raw,
        raw,
      };
    }

    // Agent 6: Team+ — Deadline Reverse-Engineer
    let deadlineReversal = null;
    if (tierAtLeast(tier, "team")) {
      deadlineReversal = await runDeadlineReverseEngineer(projectData, riskAnalysis);
    }

    return NextResponse.json({
      readout,
      stakeholderVersions,
      deadlineReversal,
      tier,
      agentOutputs: { riskAnalysis, fixes, cascade },
    });

  } catch (err) {
    console.error("analyze route error:", err);
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}
