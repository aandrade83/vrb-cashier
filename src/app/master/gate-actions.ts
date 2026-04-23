"use server";

import { z } from "zod";
import { getMasterSession } from "@/lib/auth/session";
import {
  getMasterVerificationStatus,
  saveMasterVerificationCode,
  markMasterEmailVerified,
  incrementMasterVerificationAttempts,
  resetMasterPassword,
  hashMasterPassword,
} from "@/lib/master-auth";
import { sendVerificationEmail } from "@/lib/email";

const RESEND_COOLDOWN_MS = 60_000;
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

type GateResult = { success: true } | { success: false; error: string };

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const session = await getMasterSession();
  if (!session || session.isEnvRoot || !session.masterUserId) return null;
  return session.masterUserId;
}

export async function sendMasterVerificationCodeAction(): Promise<GateResult> {
  const userId = await getAuthenticatedMasterUserId();
  if (!userId) return { success: false, error: "Unauthorized." };

  const status = await getMasterVerificationStatus(userId);
  if (!status) return { success: false, error: "User not found." };
  if (status.emailVerified) return { success: false, error: "Email is already verified." };

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

  await saveMasterVerificationCode(userId, code, expiresAt);

  try {
    await sendVerificationEmail({ to: status.email, cashierName: "VRB Master", code });
  } catch (err) {
    console.error("[master-verification] send failed for user", userId, err);
    return { success: false, error: "Failed to send verification email. Please try again." };
  }

  console.info("[master-verification] code sent for user", userId);
  return { success: true };
}

export async function verifyMasterCodeAction(code: string): Promise<GateResult> {
  const parsed = z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/)
    .safeParse(code.trim());
  if (!parsed.success) return { success: false, error: "Code must be exactly 6 digits." };

  const userId = await getAuthenticatedMasterUserId();
  if (!userId) return { success: false, error: "Unauthorized." };

  const status = await getMasterVerificationStatus(userId);
  if (!status) return { success: false, error: "User not found." };
  if (status.emailVerified) return { success: true };

  if (!status.verificationCode || !status.verificationExpiresAt) {
    return { success: false, error: "No active code found. Please request a new code." };
  }
  if (status.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }
  if (status.verificationExpiresAt <= new Date()) {
    return { success: false, error: "Code has expired. Please request a new code." };
  }

  if (status.verificationCode !== parsed.data) {
    await incrementMasterVerificationAttempts(userId);
    const remaining = MAX_VERIFY_ATTEMPTS - status.verificationAttempts - 1;
    console.warn("[master-verification] invalid code for user", userId, "remaining:", remaining);
    if (remaining <= 0) {
      return { success: false, error: "No attempts remaining. Please request a new code." };
    }
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    };
  }

  await markMasterEmailVerified(userId);
  console.info("[master-verification] email verified for user", userId);
  return { success: true };
}

export async function resetMasterPasswordAction(
  newPassword: string,
  confirmPassword: string,
): Promise<GateResult> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  const parsed = z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .safeParse(newPassword);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const userId = await getAuthenticatedMasterUserId();
  if (!userId) return { success: false, error: "Unauthorized." };

  const hash = await hashMasterPassword(parsed.data);
  await resetMasterPassword(userId, hash);

  console.info("[master-gate] password reset for user", userId);
  return { success: true };
}
