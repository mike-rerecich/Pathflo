"use client";
import { useState, useEffect } from "react";

const G = {
  bg: "#0A0D0B",
  surface: "#111510",
  border: "#1E2820",
  border2: "#263330",
  green: "#3ECB6F",
  greenDim: "#152B1E",
  text: "#E4EDE7",
  textMid: "#8FA898",
  textDim: "#4A5E52",
  accent: "#85D44A",
  warn: "#FBBF24",
};

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleWaitlist(e) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  return (
    <main style={{ background: G.bg, color: G.text, fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${G.border2}; }
        html { scroll-behavior: smooth; }

        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes floatA   { 0%,100%{transform:translateY(0px) rotate(0deg);} 50%{transform:translateY(-18px) rotate(1deg);} }
        @keyframes floatB   { 0%,100%{transform:translateY(0px) rotate(0deg);} 50%{transform:translateY(-12px) rotate(-1deg);} }
        @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }