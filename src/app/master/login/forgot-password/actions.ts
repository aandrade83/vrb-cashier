"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMasterUserByEmail, setMasterUserMustResetPassword } from "@/data/master-users";
import {
  saveMasterVerificationCode,
  getMasterVerificationStatus,
  markMasterEmailVerified,
  incrementMasterVerificationAttempts,
  createMasterSession,
  MASTER_SESSION_COOKIE,
} from "@/lib/master-auth";
import { sendPasswordResetEmail } from "@/lib/email";

const RESEND_COOLDOWN_MS = 60_000;
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Result = { success: true } | { success: false; error: string };

function generateCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 8 * 60 * 60,
  path: "/",
};

export async function requestPasswordResetAction(email: string): Promise<Result> {
  const parsed = z.string().email().safeParse(email.trim().toLowerCase());
  if (!parsed.success) return { success: false, error: "Please enter a valid email address." };

  const user = await getMasterUserByEmail(parsed.data);

  // Always succeed silently when email not found — prevents enumeration
  if (!user || !user.isActive) return { success: true };

  const status = await getMasterVerificationStatus(user.id);
  if (!status) return { success: true };

  if (status.verificationLastSentAt) {
    const elapsed = Date.now() - status.verificationLastSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const remaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        error: `Please wait ${remaining} second${remaining !== 1 ? "s" : ""} before requesting a new code.`,
      };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await saveMasterVerificationCode(user.id, code, expiresAt);

  try {
    await sendPasswordResetEmail({ to: user.email, code });
  } catch (err) {
    console.error("[password-reset] email send failed for user", user.id, err);
    return { success: false, error: "Failed to send reset email. Please try again." };
  }

  console.info("[password-reset] code sent for user", user.id);
  return { success: true };
}

export async function verifyPasswordResetCodeAction(email: string, code: string): Promise<Result> {
  const emailParsed = z.string().email().safeParse(email.trim().toLowerCase());
  if (!emailParsed.success) return { success: false, error: "Invalid request." };

  const codeParsed = z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/)
    .safeParse(code.trim());
  if (!codeParsed.success) return { success: false, error: "Code must be exactly 6 digits." };

  const user = await getMasterUserByEmail(emailParsed.data);
  if (!user || !user.isActive) {
    return { success: false, error: "Invalid or expired code." };
  }

  const status = await getMasterVerificationStatus(user.id);
  if (!status) return { success: false, error: "Invalid or expired code." };

  if (!status.verificationCode || !status.verificationExpiresAt) {
    return { success: false, error: "No active code found. Please request a new code." };
  }
  if (status.verificationAttempts >= MAX_ATTEMPTS) {
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }
  if (status.verificationExpiresAt <= new Date()) {
    return { success: false, error: "Code has expired. Please request a new code." };
  }

  if (status.verificationCode !== codeParsed.data) {
    await incrementMasterVerificationAttempts(user.id);
    const remaining = MAX_ATTEMPTS - status.verificationAttempts - 1;
    console.warn("[password-reset] invalid code for user", user.id, "remaining:", remaining);
    if (remaining <= 0) {
      return { success: false, error: "No attempts remaining. Please request a new code." };
    }
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    };
  }

  // Code valid — mark email verified (proved inbox ownership) and force password reset
  await markMasterEmailVerified(user.id);
  await setMasterUserMustResetPassword(user.id);

  const token = await createMasterSession({
    isEnvRoot: false,
    masterUserId: user.id,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(MASTER_SESSION_COOKIE, token, COOKIE_OPTIONS);

  console.info("[password-reset] session created for user", user.id);
  redirect(user.role === "master_clerk" ? "/master/clerk/queue" : "/master/dashboard");
}
