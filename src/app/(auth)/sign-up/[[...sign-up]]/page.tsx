"use client";

import { useSignUp, useClerk, useSession } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "form" | "verify";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const { setActive } = useClerk();
  const { session } = useSession();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const isDev = process.env.NODE_ENV === "development";
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await (signUp! as any).create({ username, emailAddress: email });
      await (signUp! as any).verifications.sendEmailCode();
      if (isDev && email.includes("+clerk_test")) setCode("424242");
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
        // Wait for the JWT to refresh with the new role before navigating.
        // Without this, middleware sees role=undefined and redirects to /pending.
        for (let i = 0; i < 10; i++) {
          await session?.reload();
          const role = (session?.lastActiveToken?.jwt?.claims as any)?.public_metadata?.role;
          if (role) break;
          await new Promise((r) => setTimeout(r, 500));
        }
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
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 relative">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
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
            {isDev && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                This is a Developer test Mode. Security will be turned on in production environment.
              </div>
            )}
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
