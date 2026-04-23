"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type GateResult = { success: true } | { success: false; error: string };
type SendCodeResult = GateResult;
type VerifyCodeResult = GateResult;
type ResetPasswordResult = GateResult;

const RESEND_COOLDOWN_SECONDS = 60;

// ─── Password Reset Gate ─────────────────────────────────────────────────────

type PasswordResetProps = {
  resetPassword: (newPassword: string, confirmPassword: string) => Promise<ResetPasswordResult>;
};

export function MasterPasswordResetGate({ resetPassword }: PasswordResetProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await resetPassword(newPassword, confirmPassword);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Set a New Password</CardTitle>
        <CardDescription>
          Your account requires a password change before you can continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isPending}
            autoFocus
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && newPassword && confirmPassword && handleSubmit()
            }
            disabled={isPending}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!newPassword || !confirmPassword || isPending}
        >
          {isPending ? "Updating..." : "Set Password"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Email Verification Gate ─────────────────────────────────────────────────

type EmailVerifyProps = {
  email: string;
  sendCode: () => Promise<SendCodeResult>;
  verifyCode: (code: string) => Promise<VerifyCodeResult>;
};

type Step = "send" | "code" | "success";

export function MasterEmailVerifyGate({ email, sendCode, verifyCode }: EmailVerifyProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("send");
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
      const result = await sendCode();
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
      const result = await sendCode();
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
      const result = await verifyCode(code.trim());
      if (result.success) {
        setStep("success");
        setTimeout(() => router.refresh(), 800);
      } else {
        setError(result.error);
      }
    });
  }

  if (step === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-3xl dark:bg-green-900/30 dark:text-green-400">
            ✓
          </div>
          <CardTitle className="text-xl">Email Verified</CardTitle>
          <CardDescription>
            Your account is now verified. Loading your dashboard...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Verify Your Email</CardTitle>
        <CardDescription>
          A one-time email verification is required before accessing the master panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === "send" ? (
          <>
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">Verification code will be sent to:</p>
              <p className="mt-1 font-medium">{email}</p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={handleSendCode} disabled={isPendingSend}>
              {isPendingSend ? "Sending..." : "Send Verification Code"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <strong className="text-foreground">{email}</strong>. It expires in 10 minutes.
            </p>

            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) =>
                  e.key === "Enter" && code.length === 6 && handleVerify()
                }
                disabled={isPendingVerify}
                autoComplete="one-time-code"
                autoFocus
                className="text-center text-xl tracking-widest font-mono"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {resendMessage && (
              <p className="text-sm text-green-600 dark:text-green-400">{resendMessage}</p>
            )}

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={code.length !== 6 || isPendingVerify}
            >
              {isPendingVerify ? "Verifying..." : "Verify Email"}
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
                  {isPendingSend ? "Sending..." : "Resend Code"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
