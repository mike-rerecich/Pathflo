import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are the planning engine for Pathflo — an AI-powered project planning tool that gives business owners, contractors, and agency operators operational clarity and execution predictability before work begins.

You are a structured project planning analyst. You identify dependency chains, score risk, and produce a clear actionable plan.

Always return your analysis in this exact order:

PLAN SUMMARY
Project: [name]
Target date: [date]
Total tasks: [n]
Projected completion: [calculated date]
Buffer available: [n days / AT RISK / OVERRUN]

RISK SCORE
Overall: [X/10] — [LOW / MODERATE / HIGH / CRITICAL]
  • Dependency complexity: [score/10] — [rationale]
  • Timeline tightness: [score/10] — [rationale]
  • Zero-float tasks: [score/10] — [rationale]
  • Ownership clarity: [score/10] — [rationale]
  • External dependencies: [score/10] — [rationale]

CRITICAL PATH
[Task A] → [Task B] → [Task C]
Total critical path duration: [n days]

BOTTLENECKS
Top 3 tasks most likely to delay the project. For each: why and what mitigates it.

TRIANGLE DIAGNOSIS
PRIMARY CONSTRAINT: [SCOPE / TIME / BUDGET] — [one sentence why]

  SCOPE lever: [concrete recommendation referencing actual task names]
  TIME lever: [concrete recommendation referencing actual task names]
  BUDGET lever: [concrete recommendation referencing actual task names]

RECOMMENDED MOVE: [One sentence. Be direct.]

LEADERSHIP READOUT
5 sentences. Project goal, projected completion, risk level, biggest bottleneck, one recommended next action.

OPTIMIZATION OPPORTUNITIES
2-3 specific changes referencing actual tasks.

GUARDRAILS: Never fabricate data. If risk score 7+ lead with the risk flag. Do not soften bad news.`;

export async function POST(request) {
  try {
    const { projectData } = await request.json();
    if (!projectData) {
      return NextResponse.json({ error: "projectData is required" }, { status: 400 });
    }
    const userMessage = `PROJECT INPUT

Project name: ${projectData.name}
Start date: ${projectData.startDate}
Target completion: ${projectData.targetDate}
Budget constraint: ${projectData.budget || "Not specified"}

TASKS:
${(projectData.tasks || []).map((t, i) =>
  `${i + 1}. ${t.name} | Owner: ${t.owner || "UNASSIGNED"} | Duration: ${t.days} days${t.milestone ? " | MILESTONE" : ""}${t.predecessors?.length ? ` | Depends on: ${t.predecessors.join(", ")}` : ""}`
).join("\n")}

Please analyze this project and return the full structured output.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: "API error", detail: err }, { status: 502 });
    }

    const data = await response.json();
    const readout = data.content?.[0]?.text ?? "";
    return NextResponse.json({ readout });

  } catch (err) {
    console.error("analyze route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
