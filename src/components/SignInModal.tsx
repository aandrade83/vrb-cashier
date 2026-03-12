"use client";

import { useSignIn, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Phase = "email" | "code";

export default function SignInModal() {
  const { signIn } = useSignIn();
  const { setActive } = useClerk();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleClose() {
    setOpen(false);
    setPhase("email");
    setLoading(false);
    setEmail("");
    setCode("");
    setError("");
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Force email-code authentication by specifying the strategy
      const { error: createError } = await signIn!.create({ 
        identifier: email,
        strategy: "email_code"
      });
      if (createError) {
        setError(createError.message ?? "Could not find account.");
        return;
      }
      setPhase("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await signIn!.attemptFirstFactor({ 
        strategy: "email_code", 
        code 
      });
      if (verifyError) {
        setError(verifyError.message ?? "Invalid code.");
        return;
      }
      if (signIn!.status === "complete") {
        await setActive({ session: signIn!.createdSessionId });
        window.location.href = "/";
        handleClose();
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={loading}>
        Sign in
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sign in</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {phase === "email" ? (
              <form onSubmit={handleSendCode} className="flex flex-col gap-3">
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
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-black text-white rounded-md py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">
                  A code was sent to <span className="font-medium text-gray-800">{email}</span>
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
                  onClick={() => { setPhase("email"); setCode(""); setError(""); }}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
