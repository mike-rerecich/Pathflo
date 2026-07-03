"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    async function handle() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("Sign-in failed. Please try again.");
          setTimeout(() => { window.location.href = "/app"; }, 2000);
          return;
        }
      }

      // Session is now established — redirect to app
      const next = searchParams.get("next") || "/app";
      window.location.href = next;
    }
    handle();
  }, []);

  return (
    <div style={{ background: "#080A08", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#EEF2EE", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✦</div>
        <div style={{ fontSize: "0.9rem", color: "#8A9E8A" }}>{status}</div>
      </div>
    </div>
  );
}
