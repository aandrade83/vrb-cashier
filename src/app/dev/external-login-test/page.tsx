"use client";

import { useState } from "react";

interface Step {
  label: string;
  status: "pending" | "ok" | "error";
  detail?: string;
}

export default function ExternalLoginTestPage() {
  const [apiKey, setApiKey]       = useState("");
  const [site, setSite]           = useState("bitbet.com");
  const [username, setUsername]   = useState("BETOWITEST");
  const [password, setPassword]   = useState("123");
  const [baseUrl, setBaseUrl]     = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );

  const [steps, setSteps]         = useState<Step[]>([]);
  const [running, setRunning]     = useState(false);
  const [rawResponse, setRaw]     = useState<string | null>(null);
  const [autoLoginUrl, setAutoLoginUrl] = useState<string | null>(null);

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

  async function runTest() {
    setSteps([]);
    setRaw(null);
    setAutoLoginUrl(null);
    setRunning(true);

    // ── Step 1: call external-login ───────────────────────────────────────
    addStep({ label: "POST /api/auth/external-login", status: "pending" });

    let url: string | null = null;
    try {
      const endpoint = `${baseUrl}/api/auth/external-login`;
      const res = await fetch(endpoint, {
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
      try { json = JSON.parse(text); } catch { /* raw already stored */ }

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
        updateLast({ status: "error", detail: `No URL in response: ${text}` });
        setRunning(false);
        return;
      }

      updateLast({ status: "ok", detail: url });
    } catch (err) {
      updateLast({ status: "error", detail: String(err) });
      setRunning(false);
      return;
    }

    // ── Step 2: show auto-login URL ───────────────────────────────────────
    setAutoLoginUrl(url);
    addStep({
      label: "OTP URL generada",
      status: "ok",
      detail: "Haz clic en 'Abrir en este tab' para completar el login",
    });

    setRunning(false);
  }

  function openAutoLogin() {
    if (autoLoginUrl) window.location.href = autoLoginUrl;
  }

  const statusIcon = (s: Step["status"]) =>
    s === "pending" ? "⏳" : s === "ok" ? "✅" : "❌";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono text-sm">
      <h1 className="text-xl font-bold mb-1 text-white">External Login — Test Page</h1>
      <p className="text-zinc-500 mb-6 text-xs">Solo para depuración. No usar en producción.</p>

      <div className="grid gap-3 max-w-lg mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">Base URL del cashier</span>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">x-api-key (EXTERNAL_LOGIN_API_KEY)</span>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="tu secreto..."
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">site</span>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">username</span>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400 text-xs">password</span>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>

      <button
        onClick={runTest}
        disabled={running || !apiKey}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-2 rounded font-sans font-semibold mb-8"
      >
        {running ? "Probando..." : "Ejecutar test"}
      </button>

      {steps.length > 0 && (
        <div className="max-w-2xl space-y-2 mb-6">
          {steps.map((s, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded p-3">
              <div className="flex gap-2 items-center">
                <span>{statusIcon(s.status)}</span>
                <span className="text-zinc-200 font-semibold">{s.label}</span>
              </div>
              {s.detail && (
                <p className="mt-1 text-xs text-zinc-400 break-all">{s.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {autoLoginUrl && (
        <div className="max-w-2xl mb-6">
          <button
            onClick={openAutoLogin}
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded font-sans font-semibold"
          >
            Abrir auto-login en este tab →
          </button>
          <p className="text-xs text-zinc-500 mt-1 break-all">{autoLoginUrl}</p>
        </div>
      )}

      {rawResponse !== null && (
        <div className="max-w-2xl">
          <p className="text-zinc-400 text-xs mb-1">Respuesta raw del server:</p>
          <pre className="bg-zinc-900 border border-zinc-800 rounded p-4 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
            {(() => { try { return JSON.stringify(JSON.parse(rawResponse), null, 2); } catch { return rawResponse; } })()}
          </pre>
        </div>
      )}
    </div>
  );
}
