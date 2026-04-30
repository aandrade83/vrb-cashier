"use client";

import { useState, useRef } from "react";

type LoadState = "idle" | "loading" | "loaded" | "blocked";

interface Step {
  label: string;
  status: "pending" | "ok" | "error";
  detail?: string;
}

export default function IframeTestPage() {
  // Form state
  const [baseUrl, setBaseUrl]     = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [apiKey, setApiKey]       = useState("");
  const [site, setSite]           = useState("bitbet.com");
  const [username, setUsername]   = useState("BETOWITEST");
  const [password, setPassword]   = useState("");

  // Flow state
  const [running, setRunning]         = useState(false);
  const [otpUrl, setOtpUrl]           = useState<string | null>(null);
  const [iframeLoadState, setIframe]  = useState<LoadState>("idle");
  const [steps, setSteps]             = useState<Step[]>([]);
  const [rawResponse, setRaw]         = useState<string | null>(null);
  const [showDebug, setShowDebug]     = useState(false);
  const iframeRef                     = useRef<HTMLIFrameElement>(null);

  function addStep(step: Step) {
    setSteps((prev) => [...prev, step]);
  }
  function updateLast(patch: Partial<Step>) {
    setSteps((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
      return copy;
    });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !username || !password) return;

    setRunning(true);
    setSteps([]);
    setRaw(null);
    setOtpUrl(null);
    setIframe("idle");

    // ── Call external-login ──────────────────────────────────────────────────
    addStep({ label: "POST /api/auth/external-login", status: "pending" });

    let url: string | null = null;
    try {
      const res = await fetch(`${baseUrl}/api/auth/external-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ site, username, password }),
      });

      const text = await res.text();
      setRaw(text);

      let json: Record<string, unknown> = {};
      try { json = JSON.parse(text); } catch { /* stored raw */ }

      if (!res.ok) {
        updateLast({
          status: "error",
          detail: `HTTP ${res.status} — ${JSON.stringify(json)}`,
        });
        setRunning(false);
        return;
      }

      url = (json as { url?: string }).url ?? null;
      if (!url) {
        updateLast({ status: "error", detail: `No OTP URL in response: ${text}` });
        setRunning(false);
        return;
      }

      updateLast({ status: "ok", detail: url });
    } catch (err) {
      updateLast({ status: "error", detail: String(err) });
      setRunning(false);
      return;
    }

    // ── Load iframe ──────────────────────────────────────────────────────────
    addStep({ label: "Cargando cashier en iframe...", status: "pending" });
    setOtpUrl(url);
    setIframe("loading");
    setRunning(false);
  }

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || doc.location.href === "about:blank") {
        // Blank page — X-Frame-Options likely blocked it
        setIframe("blocked");
        updateLast({ status: "error", detail: "Iframe bloqueado — X-Frame-Options o CSP" });
      } else {
        // Same-origin: can read document
        setIframe("loaded");
        updateLast({ status: "ok", detail: "Iframe cargó (same-origin)" });
      }
    } catch {
      // SecurityError — cross-origin page loaded successfully (expected in production)
      setIframe("loaded");
      updateLast({ status: "ok", detail: "Iframe cargó ✓ (cross-origin — headers OK)" });
    }
  }

  function reset() {
    setOtpUrl(null);
    setIframe("idle");
    setSteps([]);
    setRaw(null);
  }

  const icon = (s: Step["status"]) =>
    s === "pending" ? "⏳" : s === "ok" ? "✅" : "❌";

  const inIframe = otpUrl !== null;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono text-sm flex flex-col overflow-hidden">

      {/* ── Header (visible post-login) ─────────────────────────────────────── */}
      {inIframe && (
        <div className="shrink-0 h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-xs"
          >
            ← Volver al login
          </button>
          <span className="text-zinc-500 text-xs tracking-widest uppercase">
            Iframe Test — {site}
          </span>
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {showDebug ? "▲ Debug" : "▼ Debug"}
          </button>
        </div>
      )}

      {/* ── Debug panel (collapsible, post-login) ───────────────────────────── */}
      {inIframe && showDebug && (
        <div className="shrink-0 bg-zinc-900 border-b border-zinc-800 px-4 py-3 max-h-48 overflow-y-auto space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded p-2">
              <div className="flex gap-2">
                <span>{icon(s.status)}</span>
                <span className="text-zinc-200">{s.label}</span>
              </div>
              {s.detail && (
                <p className="mt-0.5 text-xs text-zinc-400 break-all pl-6">{s.detail}</p>
              )}
            </div>
          ))}
          {rawResponse && (
            <details className="mt-1">
              <summary className="text-zinc-500 text-xs cursor-pointer">Respuesta raw</summary>
              <pre className="text-xs text-green-400 whitespace-pre-wrap break-all mt-1">
                {(() => { try { return JSON.stringify(JSON.parse(rawResponse), null, 2); } catch { return rawResponse; } })()}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Login form (pre-login) ───────────────────────────────────────────── */}
      {!inIframe && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-md">
            <h1 className="text-xl font-bold mb-1 text-white">Iframe Test — Lobby Simulator</h1>
            <p className="text-zinc-500 text-xs mb-6">
              Simula el flujo del landing-book: login → external-login → iframe del cashier.
            </p>

            <form onSubmit={handleLogin} className="grid gap-3 mb-6">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400 text-xs">Base URL del cashier</span>
                <input
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400 text-xs">x-api-key (EXTERNAL_LOGIN_API_KEY)</span>
                <input
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Garrobo26"
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-400 text-xs">site (clientUrl del cashier)</span>
                <input
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-zinc-400 text-xs">username</span>
                  <input
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-zinc-400 text-xs">password</span>
                  <input
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={running || !apiKey || !username || !password}
                className="mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded font-sans font-semibold transition-colors"
              >
                {running ? "Autenticando..." : "Cargar cashier en iframe →"}
              </button>
            </form>

            {/* Error steps (shown pre-iframe if login failed) */}
            {steps.length > 0 && !otpUrl && (
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded p-3">
                    <div className="flex gap-2">
                      <span>{icon(s.status)}</span>
                      <span className="text-zinc-200">{s.label}</span>
                    </div>
                    {s.detail && (
                      <p className="mt-1 text-xs text-zinc-400 break-all">{s.detail}</p>
                    )}
                  </div>
                ))}
                {rawResponse && (
                  <pre className="bg-zinc-900 border border-zinc-800 rounded p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => { try { return JSON.stringify(JSON.parse(rawResponse), null, 2); } catch { return rawResponse; } })()}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Iframe (post-login) ──────────────────────────────────────────────── */}
      {inIframe && (
        <div className="flex-1 relative overflow-hidden">
          {/* Loading overlay */}
          {iframeLoadState === "loading" && (
            <div className="absolute inset-0 z-10 bg-zinc-950 flex flex-col items-center justify-center gap-4">
              <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-zinc-400 text-xs tracking-widest uppercase">
                Estableciendo sesión...
              </span>
              <p className="text-zinc-600 text-xs max-w-xs text-center break-all">{otpUrl}</p>
            </div>
          )}

          {/* Blocked overlay */}
          {iframeLoadState === "blocked" && (
            <div className="absolute inset-0 z-10 bg-zinc-950 flex flex-col items-center justify-center gap-4 px-4">
              <div className="bg-zinc-900 border border-red-900 rounded-xl p-6 max-w-sm w-full text-center space-y-3">
                <p className="text-red-400 font-semibold">❌ Iframe bloqueado</p>
                <p className="text-zinc-400 text-xs">
                  X-Frame-Options o CSP bloqueó el embedding. Revisa los response headers de la URL en DevTools.
                </p>
                <p className="text-zinc-600 text-xs break-all">{otpUrl}</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => otpUrl && window.open(otpUrl, "_blank", "noopener")}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded text-xs transition-colors"
                  >
                    Abrir OTP URL en nueva tab →
                  </button>
                  <button
                    onClick={reset}
                    className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                  >
                    ← Volver
                  </button>
                </div>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={otpUrl ?? ""}
            title="Cashier"
            onLoad={handleIframeLoad}
            className="w-full h-full border-0 block"
            allow="payment *; fullscreen *"
          />
        </div>
      )}
    </div>
  );
}
