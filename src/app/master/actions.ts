"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyMasterCredentials,
  createMasterSession,
  deleteMasterSession,
  MASTER_SESSION_COOKIE,
} from "@/lib/master-auth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 8 * 60 * 60,
  path: "/",
};

export async function masterLoginAction(
  _prevState: string,
  formData: FormData,
): Promise<string> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return "Invalid request";
  }

  const valid = await verifyMasterCredentials(email.trim(), password);
  if (!valid) {
    return "Invalid credentials";
  }

  const token = await createMasterSession();
  const cookieStore = await cookies();
  cookieStore.set(MASTER_SESSION_COOKIE, token, COOKIE_OPTIONS);

  redirect("/master/dashboard");
}

export async function masterLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MASTER_SESSION_COOKIE)?.value;
  if (token) {
    await deleteMasterSession(token);
  }
  cookieStore.delete(MASTER_SESSION_COOKIE);
  redirect("/master/login");
}
