"use client";

import { useSignUp, useClerk } from "@clerk/nextjs";
import { useState } from "react";

type Phase = "form" | "verify";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const { setActive } = useClerk();

  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp!.create({ username, emailAddress: email, password });
      await (signUp! as any).verifications.sendEmailCode();
      setPhase("verify");
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
      setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await (signUp! as any).verifications.verifyEmailCode({ code });
      if (signUp!.status === "complete") {
        await setActive({ session: signUp!.createdSessionId });
        await fetch("/api/register-player", { method: "POST" });
        window.location.href = "/player/deposits";
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
      setError(e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? e.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold mb-4">Create Account</h2>

        {phase === "form" ? (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">Account</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Account"
              required
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <label className="text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white rounded-md py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Account"}
            </button>
            <p className="text-xs text-center text-gray-500">
              Already have an account?{" "}
              <a href="/sign-in" className="underline">Sign in</a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">
              A verification code was sent to{" "}
              <span className="font-medium text-gray-800">{email}</span>
            </p>
            <label className="text-sm font-medium text-gray-700">Verification code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              disabled={loading}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black tracking-widest"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white rounded-md py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setPhase("form"); setCode(""); setError(""); }}
              className="text-xs text-gray-500 hover:underline"
            >
              Go back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
