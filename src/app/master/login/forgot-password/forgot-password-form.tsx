"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction, verifyPasswordResetCodeAction } from "./actions";

type Step = "email" | "code";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isPendingSend, startSendTransition] = useTransition();
  const [isPendingVerify, startVerifyTransition] = useTransition();

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  function handleSendCode() {
    setError("");
    startSendTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.success) {
        setStep("code");
        setCountdown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError(result.error);
      }
    });
  }

  function handleResend() {
    setError("");
    setResendMessage("");
    setCode("");
    startSendTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.success) {
        setCountdown(RESEND_COOLDOWN_SECONDS);
        setResendMessage("New code sent.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleVerify() {
    setError("");
    setResendMessage("");
    startVerifyTransition(async () => {
      const result = await verifyPasswordResetCodeAction(email, code.trim());
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your account email to receive a reset code."
              : `Enter the 6-digit code sent to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <>
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && email && handleSendCode()}
                  disabled={isPendingSend}
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSendCode}
                disabled={!email || isPendingSend}
              >
                {isPendingSend ? "Sending…" : "Send Reset Code"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                If an account with that email exists, a code was sent. It expires in 10 minutes.
              </p>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {resendMessage && (
                <p className="text-sm text-green-600 dark:text-green-400">{resendMessage}</p>
              )}

              <div className="space-y-1">
                <Label htmlFor="code">Reset Code</Label>
                <Input
                  id="code"
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

              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={code.length !== 6 || isPendingVerify}
              >
                {isPendingVerify ? "Verifying…" : "Reset Password"}
              </Button>

              <div className="text-center pt-1">
                {countdown > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Resend code in{" "}
                    <span className="tabular-nums font-medium">{countdown}s</span>
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={isPendingSend}
                  >
                    {isPendingSend ? "Sending…" : "Resend Code"}
                  </Button>
                )}
              </div>
            </>
          )}

          <div className="text-center pt-1">
            <Link
              href="/master/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
