"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { masterLoginAction } from "@/app/master/actions";
import { requestPasswordResetAction, verifyPasswordResetCodeAction } from "./forgot-password/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Mode = "login" | "email" | "code";

const RESEND_COOLDOWN = 60;

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fpError, setFpError] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isPendingSend, startSend] = useTransition();
  const [isPendingVerify, startVerify] = useTransition();

  const [loginError, formAction, loginPending] = useActionState(masterLoginAction, "");

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  function handleSendCode() {
    setFpError("");
    startSend(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.success) {
        setMode("code");
        setCountdown(RESEND_COOLDOWN);
      } else {
        setFpError(result.error);
      }
    });
  }

  function handleResend() {
    setFpError("");
    setResendMsg("");
    setCode("");
    startSend(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.success) {
        setCountdown(RESEND_COOLDOWN);
        setResendMsg("New code sent.");
      } else {
        setFpError(result.error);
      }
    });
  }

  function handleVerify() {
    setFpError("");
    setResendMsg("");
    startVerify(async () => {
      const result = await verifyPasswordResetCodeAction(email, code.trim());
      if (!result.success) setFpError(result.error);
    });
  }

  function resetToLogin() {
    setMode("login");
    setEmail("");
    setCode("");
    setFpError("");
    setResendMsg("");
    setCountdown(0);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">

        {mode === "login" && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Master Access</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={formAction} className="space-y-4">
                {loginError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                    {loginError}
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoFocus disabled={loginPending} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required disabled={loginPending} />
                </div>
                <Button type="submit" className="w-full" disabled={loginPending}>
                  {loginPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </CardContent>
          </>
        )}

        {mode === "email" && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Reset Password</CardTitle>
              <CardDescription>Enter your account email to receive a reset code.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fpError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {fpError}
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="fp-email">Email</Label>
                <Input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email && handleSendCode()}
                  disabled={isPendingSend}
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button className="w-full" onClick={handleSendCode} disabled={!email || isPendingSend}>
                {isPendingSend ? "Sending…" : "Send Reset Code"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={resetToLogin} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </button>
              </div>
            </CardContent>
          </>
        )}

        {mode === "code" && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Enter Reset Code</CardTitle>
              <CardDescription>
                If an account exists for <strong>{email}</strong>, a code was sent. It expires in 10 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fpError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {fpError}
                </div>
              )}
              {resendMsg && <p className="text-sm text-green-600 dark:text-green-400">{resendMsg}</p>}
              <div className="space-y-1">
                <Label htmlFor="fp-code">Reset Code</Label>
                <Input
                  id="fp-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
                  disabled={isPendingVerify}
                  autoComplete="one-time-code"
                  autoFocus
                  className="text-center text-xl tracking-widest font-mono"
                />
              </div>
              <Button className="w-full" onClick={handleVerify} disabled={code.length !== 6 || isPendingVerify}>
                {isPendingVerify ? "Verifying…" : "Reset Password"}
              </Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Resend in <span className="tabular-nums font-medium">{countdown}s</span>
                  </p>
                ) : (
                  <button type="button" onClick={handleResend} disabled={isPendingSend} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {isPendingSend ? "Sending…" : "Resend Code"}
                  </button>
                )}
              </div>
              <div className="text-center">
                <button type="button" onClick={resetToLogin} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </button>
              </div>
            </CardContent>
          </>
        )}

      </Card>
    </div>
  );
}
