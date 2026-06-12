import { NextResponse } from "next/server";

const MODEL = "claude-sonnet-4-6";
const API_KEY = () => process.env.ANTHROPIC_API_KEY;

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

// ── Agent 1: Risk Scanner ─────────────────────────────────────────────────────
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

// ── Agent 2: Fix Generator ────────────────────────────────────────────────────
async function runFixGenerator(projectData, riskAnalysis) {
  const system = `You are a project execution strategist. Given a risk analysis, generate specific actionable fixes.

For each risk produce:
FIX: [action title]
ADDRESSES: [risk name from analysis]
ACTION: [exactly what to do — name specific tasks, people, or decisions]
DAYS_RECOVERED: [estimate, or 0]
EFFORT: [LOW / MEDIUM / HIGH]

Do not produce generic advice. Every fix must reference actual tasks or owners from the project.`;

  const userMessage = `${formatProject(projectData)}

RISK ANALYSIS:
${riskAnalysis}`;

  return callClaude(system, userMessage, 900);
}

// ── Agent 3: Cascade Modeler ──────────────────────────────────────────────────
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

  const userMessage = `${formatProject(projectData)}

RISK ANALYSIS:
${riskAnalysis}`;

  return callClaude(system, userMessage, 700);
}

// ── Agent 4: Executive Writer ─────────────────────────────────────────────────
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

  const userMessage = `${formatProject(projectData)}

RISK ANALYSIS:
${riskAnalysis}

FIXES:
${fixes}

CASCADE SIMULATION:
${cascade}`;

  return callClaude(system, userMessage, 900);
}

export async function POST(request) {
  try {
    const { projectData } = await request.json();
    if (!projectData) {
      return NextResponse.json({ error: "projectData is required" }, { status: 400 });
    }
    if (!API_KEY()) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    // Run agents sequentially — each feeds the next
    const riskAnalysis = await runRiskScanner(projectData);
    const [fixes, cascade] = await Promise.all([
      runFixGenerator(projectData, riskAnalysis),
      runCascadeModeler(projectData, riskAnalysis),
    ]);
    const readout = await runExecutiveWriter(projectData, riskAnalysis, fixes, cascade);

    return NextResponse.json({
      readout,
      agentOutputs: { riskAnalysis, fixes, cascade },
    });

  } catch (err) {
    console.error("analyze route error:", err);
    return NextResponse.json({ error: "Internal server error", detail: err.message }, { status: 500 });
  }
}
