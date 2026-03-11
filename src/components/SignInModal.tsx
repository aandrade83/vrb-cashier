"use client";

import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignInModal() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setOpen(false);
    setStep("email");
    setEmail("");
    setCode("");
    setError("");
    setLoading(false);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      await signIn.__internal_future.create({ identifier: email });
      await signIn.__internal_future.emailCode.sendCode();
      setStep("code");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message: string }[] };
      setError(clerkErr.errors?.[0]?.longMessage ?? clerkErr.errors?.[0]?.message ?? "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const si = signIn.__internal_future;
      await si.emailCode.verifyCode({ code });
      await setActive({ session: si.createdSessionId });
      router.refresh();
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message: string }[] };
      setError(clerkErr.errors?.[0]?.longMessage ?? clerkErr.errors?.[0]?.message ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="default">
        Sign In
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onMouseDown={handleClose}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {step === "email" ? "Sign in" : "Check your email"}
              </h2>
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); handleClose(); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="si-email" className="text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    id="si-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    disabled={loading}
                    autoComplete="email"
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Sending…" : "Send code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <p className="text-sm text-gray-500">
                  Code sent to <span className="font-medium text-gray-900">{email}</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="si-code" className="text-sm font-medium text-gray-700">
                    Verification code
                  </label>
                  <input
                    id="si-code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    required
                    autoFocus
                    disabled={loading}
                    autoComplete="one-time-code"
                    className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm tracking-widest text-center outline-none focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Verifying…" : "Verify code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  className="text-xs text-gray-500 hover:underline text-center"
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
