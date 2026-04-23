"use server";

import { z } from "zod";
import { getCashierId, getCashier } from "@/lib/cashier-context";
import { getSessionForCashier } from "@/lib/auth/session";
import {
  getPlayerVerificationStatus,
  saveVerificationCode,
  markEmailVerified,
  incrementVerificationAttempts,
} from "@/data/users";
import { sendVerificationEmail } from "@/lib/email";

const RESEND_COOLDOWN_MS = 60_000;
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

export type SendCodeResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type VerifyCodeResult =
  | { success: true; verified: true }
  | { success: false; error: string };

export async function sendStaffVerificationCodeAction(): Promise<SendCodeResult> {
  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);

  if (!access || access.isMasterActing || !access.userId || access.role === "player") {
    return { success: false, error: "Unauthorized." };
  }

  const { userId } = access;
  const status = await getPlayerVerificationStatus(userId, cashierId);

  if (!status) return { success: false, error: "User not found." };
  if (!status.email) return { success: false, error: "No email address on file. Contact your administrator." };
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

  await saveVerificationCode(userId, cashierId, status.email, code, expiresAt);

  const cashier = await getCashier();

  try {
    await sendVerificationEmail({ to: status.email, cashierName: cashier.name, code });
  } catch (err) {
    console.error("[staff-verification] send failed for user", userId, err);
    return { success: false, error: "Failed to send verification email. Please try again." };
  }

  console.info("[staff-verification] code sent for user", userId);
  return { success: true, message: "Verification code sent." };
}

export async function verifyStaffCodeAction(code: string): Promise<VerifyCodeResult> {
  const parsed = z
    .string()
    .trim()
    .length(6)
    .regex(/^\d{6}$/)
    .safeParse(code.trim());
  if (!parsed.success) {
    return { success: false, error: "Code must be exactly 6 digits." };
  }
  const cleanCode = parsed.data;

  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);

  if (!access || access.isMasterActing || !access.userId || access.role === "player") {
    return { success: false, error: "Unauthorized." };
  }

  const { userId } = access;
  const status = await getPlayerVerificationStatus(userId, cashierId);
  if (!status) return { success: false, error: "User not found." };

  if (status.emailVerified) return { success: true, verified: true };

  if (!status.verificationCode || !status.verificationExpiresAt) {
    return { success: false, error: "No active code found. Please request a new code." };
  }

  if (status.verificationAttempts >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (status.verificationExpiresAt <= new Date()) {
    return { success: false, error: "Code has expired. Please request a new code." };
  }

  if (status.verificationCode !== cleanCode) {
    await incrementVerificationAttempts(userId, cashierId);
    const remaining = MAX_VERIFY_ATTEMPTS - status.verificationAttempts - 1;
    console.warn("[staff-verification] invalid code for user", userId, "remaining:", remaining);
    if (remaining <= 0) {
      return { success: false, error: "No attempts remaining. Please request a new code." };
    }
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
    };
  }

  await markEmailVerified(userId, cashierId);
  console.info("[staff-verification] email verified for user", userId);
  return { success: true, verified: true };
}
