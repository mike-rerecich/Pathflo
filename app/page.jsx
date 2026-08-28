"use client";
import { useState, useEffect, useRef } from "react";

/* Brand tokens — see brand/Brand.md, the single source of truth for these values */
const BRAND = "#3ECB6F";       // large fills, icons, highlights — never text on white (2.1:1 contrast)
const BRAND_DEEP = "#166F42";  // button fills, links, small text-as-accent (6.2:1 on white)
const WHITE = "#FFFFFF";
const OFFGREY = "#F6F7F6";
const BORDER = "#E4E7E4";
const BORDER_HOVER = "#D8DCD8";
const TEXT = "#14171A";
const TEXT_MID = "#5B6560";
const TEXT_DIM = "#8A928D";    // large text / non-body UI only — 3.2:1, not body-text-safe
/* Accent set — see brand/Brand.md "Accent set" table; small-swatch/label use only, matches the same
   agent's color on app/software/page.jsx's AGENT_NODES/agents arrays */
const ACCENT_TEAL = "#0E7490";
const ACCENT_BLUE = "#1D4ED8";
const ACCENT_VIOLET = "#6D28D9";
const ACCENT_PURPLE = "#7E22CE";
const ACCENT_AMBER = "#B45309";
const BOOK_CALL = "mailto:mike.rerecich2@gmail.com?subject=Discovery%20call%20-%20Pathflo%20Consulting";

function hex2rgb(hex) {
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}

/* ─── Logo ───────────────────────────────────────────────────────── */
const Logo = ({ color=BRAND_DEEP, size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{display:"inline-block",verticalAlign:"middle"}}>
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4"  cy="24" r="3"   fill={color}/>
    <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="26" cy="6"  r="2.5" fill={color} opacity="0.5"/>
    <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
  </svg>
);

/* ─── useReveal ──────────────────────────────────────────────────── */
function useReveal(threshold=0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function RevealSection({ children, id, style }) {
  const [ref, visible] = useReveal(0.08);
  return (
    <div ref={ref} id={id} style={{
      ...style, position:"relative", zIndex:1,
      opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(24px)",
      transition:"opacity 0.6s ease, transform 0.6s ease",
    }}>
      {children}
    </div>
  );
}

/* ─── ScrollProgress ─────────────────────────────────────────────── */
function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    let raf;
    const update = () => {
      const el = barRef.current; if (!el) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      el.style.width = (total>0?(window.scrollY/total)*100:0)+"%";
    };
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", fn, { passive:true });
    return () => { window.removeEventListener("scroll", fn); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,height:"2px",zIndex:9999,background:BORDER,pointerEvents:"none"}}>
      <div ref={barRef} style={{height:"100%",width:"0%",background:BRAND_DEEP,transition:"none"}}/>
    </div>
  );
}

/* ─── Methodology chain — a functional diagram, motion kept subdued ─ */
const CHAIN_NODES = [
  {n:"01",name:"Risk Scanner",    short:"Top failure points, ranked",       color:BRAND, col:0,row:0},
  {n:"02",name:"Fix Generator",   short:"Specific, actionable fixes",       color:ACCENT_TEAL, col:1,row:0},
  {n:"03",name:"Cascade Modeler", short:"What breaks downstream",           color:ACCENT_BLUE, col:1,row:1},
  {n:"04",name:"Exec Writer",     short:"60-second forwardable readout",    color:ACCENT_VIOLET, col:0,row:1},
  {n:"05",name:"Stakeholder Adapter", short:"Client / team / exec versions",color:ACCENT_PURPLE, col:0,row:2},
  {n:"06",name:"Deadline Reverse-Engineer", short:"Work backwards from the date", color:ACCENT_AMBER, col:1,row:2},
];

function CometDot({ fromCx, fromCy, toCx, toCy, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let start;
    const dur = 580;
    const animate = ts => {
      if (!start) start = ts;
      const t = Math.min((ts-start)/dur, 1);
      const ease = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
      el.style.left = (fromCx+(toCx-fromCx)*ease - 3)+"px";
      el.style.top  = (fromCy+(toCy-fromCy)*ease - 3)+"px";
      el.style.opacity = t>0.88 ? String(1-(t-0.88)/0.12) : "1";
      if (t<1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [fromCx,fromCy,toCx,toCy,color]);
  return (
    <div ref={ref} style={{
      position:"absolute", left:fromCx-3, top:fromCy-3,
      width:6, height:6, borderRadius:"50%", background:color,
      pointerEvents:"none", zIndex:10,
    }}/>
  );
}

function MethodologyChain() {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    let timer;
    const STEP = 680, HOLD = 2400;
    const tick = () => {
      phaseRef.current++;
      if (phaseRef.current > 5) {
        setPhase(-1);
        timer = setTimeout(() => { phaseRef.current=0; setPhase(0); timer=setTimeout(tick,STEP); }, 900);
      } else {
        setPhase(phaseRef.current);
        timer = setTimeout(tick, phaseRef.current===5 ? HOLD : STEP);
      }
    };
    timer = setTimeout(tick, STEP);
    return () => clearTimeout(timer);
  }, []);

  const CW=145, CH=74, GX=12, GY=12, PAD=12;
  const W = PAD+CW+GX+CW+PAD;
  const H = PAD+CH+GY+CH+GY+CH+PAD;

  const nodePos = (col, row) => ({
    x: PAD+col*(CW+GX), y: PAD+row*(CH+GY),
    cx: PAD+col*(CW+GX)+CW/2, cy: PAD+row*(CH+GY)+CH/2,
  });

  const edges = CHAIN_NODES.map((a,i) => {
    if (i>=5) return null;
    const fp=nodePos(a.col,a.row), np=CHAIN_NODES[i+1], tp=nodePos(np.col,np.row);
    let x1,y1,x2,y2;
    if (fp.cy===tp.cy) {
      x1=a.col<np.col?fp.x+CW:fp.x; y1=fp.cy;
      x2=a.col<np.col?tp.x:tp.x+CW; y2=tp.cy;
    } else {
      x1=fp.cx; y1=fp.cy<tp.cy?fp.y+CH:fp.y;
      x2=tp.cx; y2=fp.cy<tp.cy?tp.y:tp.y+CH;
    }
    return {x1,y1,x2,y2,color:a.color};
  }).filter(Boolean);

  const showComet = phase>=0 && phase<5;
  const fp = showComet ? nodePos(CHAIN_NODES[phase].col, CHAIN_NODES[phase].row) : null;
  const tp = showComet ? nodePos(CHAIN_NODES[phase+1].col, CHAIN_NODES[phase+1].row) : null;

  return (
    <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:"0.68rem",fontWeight:600,color:TEXT_MID,display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:BRAND_DEEP,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
          The chain we teach your team
        </div>
        <div style={{fontSize:"0.6rem",color:TEXT_DIM}}>6 stages</div>
      </div>
      <div style={{position:"relative",width:W,height:H}}>
        <svg style={{position:"absolute",inset:0,overflow:"visible",pointerEvents:"none"}} width={W} height={H}>
          {edges.map((e,i) => {
            const active = phase>i;
            const [r,g,b] = hex2rgb(e.color);
            return (
              <g key={i}>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={BORDER} strokeWidth={1.5}/>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={`rgba(${r},${g},${b},${active?0.6:0})`}
                  strokeWidth={1.5} strokeDasharray="4 3"
                  style={{transition:"stroke 0.35s ease"}}/>
              </g>
            );
          })}
        </svg>
        {CHAIN_NODES.map((a,i) => {
          const p=nodePos(a.col,a.row);
          const active=phase>=i, current=phase===i;
          const [r,g,b]=hex2rgb(a.color);
          return (
            <div key={i} style={{
              position:"absolute", left:p.x, top:p.y, width:CW, height:CH,
              background: active?`rgba(${r},${g},${b},0.06)`:OFFGREY,
              border:`1px solid ${active?a.color+"40":BORDER}`,
              borderRadius:10, padding:"0.55rem 0.7rem",
              transition:"background 0.35s,border-color 0.35s",
              animation: current?"pv-agentBurst 0.42s ease":"none",
            }}>
              <div style={{marginBottom:"0.22rem"}}>
                <span style={{fontSize:"0.55rem",fontWeight:700,letterSpacing:"0.08em",color:active?(a.color===BRAND?BRAND_DEEP:a.color):TEXT_DIM}}>{a.n}</span>
              </div>
              <div style={{fontSize:"0.76rem",fontWeight:700,color:active?TEXT:TEXT_DIM,lineHeight:1.2,marginBottom:"0.18rem"}}>{a.name}</div>
              <div style={{fontSize:"0.62rem",color:active?TEXT_MID:TEXT_DIM,lineHeight:1.3}}>{a.short}</div>
            </div>
          );
        })}
        {showComet && (
          <CometDot key={phase}
            fromCx={fp.cx} fromCy={fp.cy}
            toCx={tp.cx}   toCy={tp.cy}
            color={CHAIN_NODES[phase].color}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Content data ───────────────────────────────────────────────── */
const costOfWaiting = [
  {icon:"⏳",title:"The gap compounds every week",desc:"Teams already catching risk early are pulling further ahead each cycle you spend still doing it by hand. This isn't a one-time gap to close later — it widens on its own."},
  {icon:"💸",title:"Late risk always costs more than early risk",desc:"The same problem caught in week one is a quick fix. Caught in week eight, it's a missed date, a client conversation you didn't want to have, and hours nobody budgeted for."},
  {icon:"📈",title:"Manual review doesn't scale with headcount",desc:"The people doing it today are already at capacity. Growth doesn't make this easier — it makes the blind spots bigger."},
];

const trustQA = [
  {q:"Won't the AI just make things up?",a:"That's the first thing we build in, not an afterthought: a fact-check gate that requires every number to be checked against real data before it's trusted, and an explicit rule that a missing input gets an honest “not enough data” state — never a guess. If a system can't tell you when it doesn't know, it shouldn't be making the call.",icon:"◈"},
  {q:"Our team isn't technical enough for this.",a:"The curriculum is built for that. Nothing here requires anyone to write code — it's a set of habits (how to check a number, how to spot a gap, how to ask AI the right question) that a project manager or ops lead picks up the same way they'd learn any other process.",icon:"⊞"},
  {q:"We don't want to be dependent on another vendor.",a:"That's the actual goal, not a concession — the sprint ends with your team running the method themselves. You're not buying a subscription to us; you're buying the four weeks it takes to not need us for this anymore.",icon:"⚡"},
  {q:"This feels like a fad we can wait out.",a:"Maybe. But the cost of waiting isn't zero while you find out — it's every week of manual review, every risk caught late, every competitor who didn't wait. “Wait and see” is itself a decision, and it's the one with the compounding downside.",icon:"↗"},
];

const curriculum = [
  {phase:"Phase 1", name:"Foundations", modules:[
    {n:"Institutional AI Memory", d:"A persistent instruction file so AI assistance compounds instead of resetting every session."},
    {n:"Data Pipeline Literacy", d:"Source, process, and generated output kept cleanly separate — nothing hand-edited that a refresh would silently undo."},
    {n:"Debugging & Verification Discipline", d:"Trace the full data path before touching code; never trust “looks right” without running it."},
    {n:"Process & Governance", d:"Concrete triggers for when to pause and get sign-off, versus when to just proceed."},
  ]},
  {phase:"Phase 2", name:"Analytical Core", modules:[
    {n:"Forecasting & Predictive Modeling", d:"Project forward from the last real anchor, validated against real completed outcomes — not a guess dressed up as a model."},
    {n:"Risk Scoring Systems", d:"Turn “someone has to remember to check this” into a deterministic, weighted, tiered score."},
    {n:"Entity/Vendor Scorecard Systems", d:"Fair, sample-size-aware comparison across people, vendors, or projects."},
    {n:"Comment & Free-Text Rollup", d:"Extract real structured signal from notes and comments nobody has time to re-read."},
    {n:"Reactivity & Cross-Output Integrity", d:"Make sure a filter or segment actually changes the underlying numbers, not just the screen."},
  ]},
  {phase:"Phase 3", name:"Communication & Scale", modules:[
    {n:"Charting & Visualization Conventions", d:"Reports that read as one coherent system instead of a pile of one-off charts."},
    {n:"Document/Deck Generation", d:"Leadership-ready output, verified against a real render — never just “the math says it fits.”"},
    {n:"Review/Subagent Architecture", d:"A repeatable quality-gate structure so good output doesn't depend on one person remembering to check."},
  ]},
];

/* ─── Main page ──────────────────────────────────────────────────── */
export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",fn,{passive:true});
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  return (
    <main style={{background:WHITE,color:TEXT,fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:${BORDER};border-radius:4px}

        @keyframes pv-fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pv-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes pv-agentBurst{0%{transform:scale(0.96);opacity:0.6}55%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}

        .pv-h1{animation:pv-fadeUp 0.7s 0.05s ease both}
        .pv-h2{animation:pv-fadeUp 0.7s 0.15s ease both}
        .pv-h3{animation:pv-fadeUp 0.7s 0.25s ease both}
        .pv-h4{animation:pv-fadeUp 0.7s 0.35s ease both}
        .pv-h5{animation:pv-fadeUp 0.7s 0.45s ease both}

        .pv-btn-p{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;background:${BRAND_DEEP};color:${WHITE};border:none;border-radius:100px;font-family:inherit;font-weight:700;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.08);transition:transform 0.15s,box-shadow 0.15s}
        .pv-btn-p:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(0,0,0,.08), 0 8px 20px rgba(0,0,0,.12)}
        .pv-btn-s{display:inline-flex;align-items:center;justify-content:center;background:${WHITE};color:${TEXT};border:1.5px solid ${BORDER};border-radius:100px;font-family:inherit;font-weight:500;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;transition:all 0.15s}
        .pv-btn-s:hover{border-color:${BRAND_DEEP};color:${BRAND_DEEP}}

        .pv-card{background:${WHITE};border:1px solid ${BORDER};border-radius:16px;padding:1.75rem;position:relative;transition:box-shadow 0.2s,border-color 0.2s;box-shadow:0 1px 2px rgba(0,0,0,.03)}
        .pv-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.06);border-color:${BORDER_HOVER}}

        .pv-price-card{background:${WHITE};border:1px solid ${BORDER};border-radius:20px;padding:1.75rem;position:relative;overflow:visible;box-shadow:0 1px 2px rgba(0,0,0,.03);transition:box-shadow 0.2s}
        .pv-price-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.06)}
        .pv-price-card.pv-featured{background:${OFFGREY};border-color:rgba(22,111,66,0.35)}

        .pv-ham{display:flex;flex-direction:column;gap:5px;cursor:pointer;padding:4px;border:none;background:transparent;z-index:202;position:relative}
        .pv-ham span{display:block;width:22px;height:2px;background:${TEXT};border-radius:2px;transition:all 0.28s}
        .pv-ham.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
        .pv-ham.open span:nth-child(2){opacity:0;transform:scaleX(0)}
        .pv-ham.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}

        .pv-nav-backdrop{position:fixed;inset:0;background:rgba(20,23,26,0.3);z-index:199;opacity:0;pointer-events:none;transition:opacity 0.3s}
        .pv-nav-backdrop.open{opacity:1;pointer-events:auto}

        .pv-nav-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;background:${WHITE};z-index:200;display:flex;flex-direction:column;padding:5rem 2.5rem 2.5rem;border-right:1px solid ${BORDER};transform:translateX(-100%);transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);box-shadow:8px 0 40px rgba(0,0,0,0.08)}
        .pv-nav-drawer.open{transform:translateX(0)}
        .pv-nav-drawer a{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:300;color:${TEXT_MID};text-decoration:none;transition:color 0.15s;letter-spacing:-0.02em;padding:0.4rem 0}
        .pv-nav-drawer a:hover{color:${BRAND_DEEP}}
        .pv-nav-drawer .pv-drawer-links{display:flex;flex-direction:column;gap:0.5rem;flex:1}
        .pv-nav-drawer .pv-drawer-cta{margin-top:2rem}

        @media(max-width:900px){
          .pv-hero-grid{grid-template-columns:1fr!important}
          .pv-hero-right{display:none!important}
          .pv-cost-grid{grid-template-columns:1fr!important}
          .pv-curr-grid{grid-template-columns:1fr!important}
          .pv-eng-grid{grid-template-columns:1fr!important}
          .pv-hbtns{flex-direction:column!important;align-items:stretch!important}
          .pv-stats{gap:2rem!important;flex-wrap:wrap!important;justify-content:center!important}
        }
      `}</style>

      <ScrollProgress/>

      <div className={`pv-nav-backdrop ${navOpen?"open":""}`} onClick={()=>setNavOpen(false)}/>

      <div className={`pv-nav-drawer ${navOpen?"open":""}`}>
        <div className="pv-drawer-links">
          {[["#why","Why now"],["#trust","Why this is different"],["#curriculum","The curriculum"],["#engagement","Sprint & retainer"],["/software","Software"]].map(([href,label])=>(
            <a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}</a>
          ))}
        </div>
        <div className="pv-drawer-cta">
          <a href={BOOK_CALL} className="pv-btn-p" style={{width:"100%",justifyContent:"center",fontSize:"1rem"}} onClick={()=>setNavOpen(false)}>
            Book a discovery call →
          </a>
        </div>
      </div>

      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:201,height:64,
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.75rem",
        background:scrolled?"rgba(255,255,255,0.92)":"transparent",
        backdropFilter:scrolled?"blur(16px)":"none",
        borderBottom:scrolled?`1px solid ${BORDER}`:"1px solid transparent",
        transition:"all 0.25s",
      }}>
        <button className={`pv-ham ${navOpen?"open":""}`} onClick={()=>setNavOpen(o=>!o)} aria-label="Menu">
          <span/><span/><span/>
        </button>
        <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:"0.5rem",position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
          <Logo color={BRAND_DEEP} size={22}/>
          <span style={{fontWeight:700,fontSize:"1.05rem",color:TEXT,letterSpacing:"-0.02em"}}>
            Path<span style={{color:BRAND_DEEP}}>flo</span>
          </span>
        </a>
        <a href={BOOK_CALL} className="pv-btn-p" style={{fontSize:"0.85rem",padding:"0.5rem 1.3rem"}}>Book a call</a>
      </nav>

      {/* ── HERO ── */}
      <section style={{position:"relative",zIndex:1,padding:"148px 2rem 100px",maxWidth:1200,margin:"0 auto"}}>
        <div className="pv-hero-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center"}}>
          <div>
            <div className="pv-h1" style={{marginBottom:"1.75rem"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",background:OFFGREY,border:`1px solid ${BORDER}`,borderRadius:"100px",padding:"0.4rem 1.1rem",fontSize:"0.68rem",fontWeight:600,color:TEXT_MID,letterSpacing:"0.1em"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:BRAND_DEEP,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
                LIMITED ENGAGEMENTS EACH QUARTER
              </span>
            </div>
            <h1 className="pv-h2" style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2.6rem,5.6vw,4.1rem)",fontWeight:700,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:"1.5rem",color:TEXT}}>
              Your team is already making decisions<br/>
              <em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>on information nobody checked.</em>
            </h1>
            <p className="pv-h3" style={{fontSize:"clamp(1rem,2vw,1.1rem)",color:TEXT_MID,lineHeight:1.85,maxWidth:"480px",marginBottom:"2.5rem",fontWeight:400}}>
              Manual review misses what's already going wrong. We install the discipline — forecasting, risk
              scoring, and honest verification — and teach your own team to run it.{" "}
              <span style={{fontWeight:600,color:TEXT}}>No dependency on us afterward.</span>
            </p>
            <div className="pv-h4 pv-hbtns" style={{display:"flex",gap:"1rem",marginBottom:"3.5rem"}}>
              <a href={BOOK_CALL} className="pv-btn-p" style={{fontSize:"1rem",padding:"1rem 2.25rem"}}>Book a discovery call →</a>
              <a href="#curriculum" className="pv-btn-s">See the curriculum</a>
            </div>
            <div className="pv-h5 pv-stats" style={{display:"flex",gap:"3rem"}}>
              {[{val:"Week 1",label:"A real audit, not a pitch deck"},{val:"Week 4",label:"Your team runs it themselves"},{val:"1 number",label:"Real proof, not a testimonial"}].map(({val,label})=>(
                <div key={val}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.5rem",fontWeight:700,color:TEXT,letterSpacing:"-0.02em"}}>{val}</div>
                  <div style={{fontSize:"0.68rem",color:TEXT_DIM,fontWeight:500,letterSpacing:"0.03em",marginTop:"0.2rem",maxWidth:150}}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pv-hero-right">
            <MethodologyChain/>
          </div>
        </div>
      </section>

      {/* WHY NOW */}
      <RevealSection id="why" style={{padding:"5rem 1.5rem",background:OFFGREY,margin:0}}>
        <div style={{maxWidth:1050,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"3rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>THE COST OF WAITING</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            Standing still isn't neutral.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>It's a decision — and it compounds.</em>
          </h2>
        </div>
        <div className="pv-cost-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem"}}>
          {costOfWaiting.map((c,i)=>(
            <div key={i} className="pv-card">
              <div style={{width:44,height:44,borderRadius:12,background:`${BRAND}14`,border:`1px solid ${BRAND}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",marginBottom:"1.25rem"}}>{c.icon}</div>
              <div style={{fontSize:"1rem",fontWeight:700,color:TEXT,marginBottom:"0.75rem",lineHeight:1.3}}>{c.title}</div>
              <div style={{fontSize:"0.875rem",color:TEXT_MID,lineHeight:1.75,fontWeight:400}}>{c.desc}</div>
            </div>
          ))}
        </div>
        </div>
      </RevealSection>

      {/* TRUST / NOT A BLACK BOX */}
      <RevealSection id="trust" style={{padding:"5rem 1.5rem"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>WHY THIS IS DIFFERENT FROM "JUST USE AI"</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            We don't trust AI either.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>That's the whole point.</em>
          </h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:680,margin:"0 auto"}}>
          {trustQA.map(({q,a,icon},i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <div style={{background:`${BRAND}0F`,border:`1px solid ${BRAND}40`,borderRadius:"18px 18px 4px 18px",padding:"0.7rem 1.1rem",maxWidth:"80%",fontSize:"0.9rem",fontWeight:600,color:BRAND_DEEP,lineHeight:1.5}}>{q}</div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-start",gap:"0.5rem",alignItems:"flex-start"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:OFFGREY,border:`1px solid ${BORDER}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:BRAND_DEEP,fontWeight:700,marginTop:2}}>{icon}</div>
                <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:"4px 18px 18px 18px",padding:"0.75rem 1.1rem",maxWidth:"85%",fontSize:"0.875rem",color:TEXT_MID,lineHeight:1.7}}>{a}</div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </RevealSection>

      {/* CURRICULUM */}
      <RevealSection id="curriculum" style={{padding:"5rem 1.5rem",background:OFFGREY}}>
        <div style={{maxWidth:1150,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"3rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>THE CURRICULUM</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.85rem",color:TEXT}}>
            This is the bread and butter.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>Three phases. Twelve modules. Fully replicable.</em>
          </h2>
          <p style={{color:TEXT_MID,fontSize:"0.95rem",fontWeight:400,lineHeight:1.8,maxWidth:"560px",margin:"0 auto"}}>
            Every module is taught against your own real data, not a toy example — and every module is
            something your team keeps running long after we're gone.
          </p>
        </div>
        <div className="pv-curr-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem"}}>
          {curriculum.map((p,i)=>(
            <div key={i} className="pv-card" style={{padding:"1.5rem"}}>
              <div style={{fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.1em",color:BRAND_DEEP,marginBottom:"0.3rem",textTransform:"uppercase"}}>{p.phase}</div>
              <div style={{fontSize:"1.15rem",fontWeight:700,color:TEXT,marginBottom:"1.1rem",lineHeight:1.3}}>{p.name}</div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.85rem"}}>
                {p.modules.map((m,j)=>(
                  <div key={j}>
                    <div style={{fontSize:"0.82rem",fontWeight:700,color:TEXT,marginBottom:"0.15rem"}}>{m.n}</div>
                    <div style={{fontSize:"0.76rem",color:TEXT_MID,lineHeight:1.6,fontWeight:400}}>{m.d}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:"2rem",fontSize:"0.85rem",color:TEXT_MID,fontWeight:400}}>
          Plus a close on <strong style={{color:TEXT,fontWeight:700}}>Institutionalization</strong> — your
          own trimmed playbook, handed off, plus one real before/after number.
        </div>
        </div>
      </RevealSection>

      {/* ENGAGEMENT — SPRINT + RETAINER */}
      <RevealSection id="engagement" style={{padding:"5rem 1.5rem"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"3rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>HOW WE WORK TOGETHER</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            A fixed sprint to prove it.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>An optional retainer to keep going.</em>
          </h2>
        </div>
        <div className="pv-eng-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem"}}>
          <div className="pv-price-card pv-featured">
            <div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:BRAND_DEEP,color:WHITE,fontWeight:700,fontSize:"0.65rem",letterSpacing:"0.08em",padding:"0.2rem 0.85rem",borderRadius:"100px",whiteSpace:"nowrap"}}>START HERE</div>
            <div style={{fontSize:"0.65rem",fontWeight:700,color:BRAND_DEEP,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.65rem"}}>The Sprint</div>
            <div style={{display:"flex",alignItems:"baseline",gap:"0.2rem",marginBottom:"0.5rem"}}>
              <span style={{fontFamily:"'Fraunces',serif",fontSize:"2.8rem",fontWeight:700,color:TEXT,lineHeight:1}}>$20K</span>
              <span style={{fontSize:"0.8rem",color:TEXT_DIM}}>one-time, ~4 weeks</span>
            </div>
            <p style={{fontSize:"0.83rem",color:TEXT_MID,lineHeight:1.65,marginBottom:"1.5rem"}}>
              The fast-track version of the curriculum — real audit, real installation, real proof, on your own data.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginBottom:"1.75rem"}}>
              {["Institutional AI memory, built with your team","Forecasting & predictive modeling on one real workflow","Risk scoring rules built and tuned live","Comment/notes rollup on your real data","The sign-off discipline installed as a habit","One real before/after number, not a testimonial"].map(item=>(
                <div key={item} style={{display:"flex",gap:"0.65rem",fontSize:"0.85rem",color:TEXT,alignItems:"flex-start"}}>
                  <span style={{color:BRAND_DEEP,flexShrink:0,fontSize:"0.7rem",marginTop:"0.15rem"}}>✓</span>
                  <span style={{fontWeight:400}}>{item}</span>
                </div>
              ))}
            </div>
            <a href={BOOK_CALL} className="pv-btn-p" style={{width:"100%",justifyContent:"center"}}>Book the sprint</a>
          </div>
          <div className="pv-price-card">
            <div style={{fontSize:"0.65rem",fontWeight:700,color:TEXT_MID,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.65rem"}}>The Retainer</div>
            <div style={{display:"flex",alignItems:"baseline",gap:"0.2rem",marginBottom:"0.5rem"}}>
              <span style={{fontFamily:"'Fraunces',serif",fontSize:"2.8rem",fontWeight:700,color:TEXT,lineHeight:1}}>$200</span>
              <span style={{fontSize:"0.8rem",color:TEXT_DIM}}>/hr · capped at 80 hrs/mo</span>
            </div>
            <p style={{fontSize:"0.83rem",color:TEXT_MID,lineHeight:1.65,marginBottom:"1.5rem"}}>
              For teams who want to keep going past the sprint — ongoing support and the rest of the curriculum, as follow-on work. You only pay for hours actually used, up to the cap.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginBottom:"1.75rem"}}>
              {["Billed hourly, never more than 80 hrs in a month","Direct access for questions and troubleshooting","Special projects, scoped month to month","Phase 2 & 3 curriculum modules as follow-on engagements","Cancel anytime — no lock-in"].map(item=>(
                <div key={item} style={{display:"flex",gap:"0.65rem",fontSize:"0.85rem",color:TEXT,alignItems:"flex-start"}}>
                  <span style={{color:BRAND_DEEP,flexShrink:0,fontSize:"0.7rem",marginTop:"0.15rem"}}>✓</span>
                  <span style={{fontWeight:400}}>{item}</span>
                </div>
              ))}
            </div>
            <a href={BOOK_CALL} className="pv-btn-s" style={{width:"100%",justifyContent:"center"}}>Ask about the retainer</a>
          </div>
        </div>
        <p style={{textAlign:"center",marginTop:"1.75rem",fontSize:"0.75rem",color:TEXT_MID}}>The retainer is billed hourly and capped at 80 hrs/month — you'll always know what's included, and what it costs.</p>
        </div>
      </RevealSection>

      {/* PROOF, NOT THEORY */}
      <RevealSection style={{padding:"0 1.5rem 5rem"}}>
        <div style={{maxWidth:780,margin:"0 auto",background:OFFGREY,border:`1px solid ${BORDER}`,borderRadius:16,padding:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"1rem"}}>PROOF, NOT THEORY</div>
          <h3 style={{fontFamily:"'Fraunces',serif",fontSize:"1.6rem",fontWeight:700,lineHeight:1.3,marginBottom:"1rem",color:TEXT}}>
            A "top-ranked" number, corrected once, fell out of the ranking entirely.
          </h3>
          <p style={{fontSize:"0.95rem",color:TEXT_MID,lineHeight:1.85,fontWeight:400}}>
            A headline metric everyone trusted turned out to be a data-entry artifact — a different answer
            was actually true once someone checked. That correction is the point: the sprint's Week 1
            audit is built to find exactly this kind of thing on your own data, before it costs you something.
          </p>
        </div>
      </RevealSection>

      {/* FINAL CTA */}
      <RevealSection style={{padding:"0 1.5rem 6rem"}}>
        <div style={{maxWidth:620,margin:"0 auto",textAlign:"center",padding:"3.5rem 2rem",background:WHITE,border:`1px solid ${BORDER}`,borderRadius:24,boxShadow:"0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.06)"}}>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2rem,5.5vw,3.1rem)",fontWeight:700,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:"1.25rem",color:TEXT}}>
            Your next quarter<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>shouldn't run on hope.</em>
          </h2>
          <p style={{color:TEXT_MID,fontSize:"1rem",lineHeight:1.8,marginBottom:"2.5rem",fontWeight:400}}>30 minutes. No pitch deck. Just whether this is a fit.</p>
          <a href={BOOK_CALL} className="pv-btn-p" style={{fontSize:"1.05rem",padding:"1.1rem 2.75rem"}}>Book a discovery call →</a>
          <p style={{marginTop:"1.25rem",fontSize:"0.75rem",color:TEXT_MID}}>Prefer the self-serve tool instead? <a href="/software" style={{color:BRAND_DEEP,textDecoration:"none",fontWeight:600}}>See Pathflo Software →</a></p>
        </div>
      </RevealSection>

      {/* FOOTER */}
      <footer style={{borderTop:`1px solid ${BORDER}`,background:OFFGREY,padding:"2rem 2.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"1rem",maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Logo color={BRAND_DEEP} size={15}/>
            <span style={{fontSize:"0.75rem",color:TEXT_DIM,fontWeight:400}}>© 2026 Pathflo. All rights reserved.</span>
          </div>
          <div style={{display:"flex",gap:"2rem"}}>
            {[{label:"Software",href:"/software"},{label:"Privacy",href:"#"},{label:"Terms",href:"#"},{label:"Contact",href:BOOK_CALL}].map(l=>(
              <a key={l.label} href={l.href} style={{fontSize:"0.75rem",color:TEXT_DIM,textDecoration:"none"}}>{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
