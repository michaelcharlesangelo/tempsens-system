"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        window.location.href = "/dashboard";
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setInfo("Account created. If email confirmation is enabled on this Supabase project, check your inbox before signing in.");
        setMode("login");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 20 }}>
        <img src="/logo.png" alt="Tempsens" style={{ height: 30, width: "auto" }} />
        <h1 style={{ fontSize: "1.1rem", margin: 0 }}>Tempsens System</h1>
      </div>
      <div className="card">
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>

        {mode === "signup" && (
          <div className="field">
            <label>Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {info && <p className="subtle">{info}</p>}

        <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={submit} disabled={busy || !email || !password}>
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="subtle" style={{ marginTop: 14, textAlign: "center" }}>
          {mode === "login" ? (
            <>New here? <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(null); }}>Create an account</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); }}>Sign in</a></>
          )}
        </p>
      </div>
    </div>
  );
}
