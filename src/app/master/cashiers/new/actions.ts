"use server";

import { z } from "zod";
import { createCashier } from "@/data/cashiers";
import { cloneCashierMethods } from "@/data/methods";
import { getMasterSessionData, getMasterSessionFromCookies } from "@/lib/master-auth";
import { toggleUserCashierPermission } from "@/data/master-users";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(10).regex(/^[a-z0-9]+$/, "Only lowercase letters and numbers"),
  clientUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

export async function createCashierAction(data: {
  name: string;
  slug: string;
  clientUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  cloneMethodsFrom?: string;
}) {
  const token = await getMasterSessionFromCookies();
  if (!token) throw new Error("Unauthorized");
  const session = await getMasterSessionData(token);
  if (!session) throw new Error("Unauthorized");

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const { name, slug, clientUrl, contactEmail, contactPhone } = parsed.data;
  const { cloneMethodsFrom } = data;

  // Generate a 7-character alphanumeric token
  const cashierToken = randomBytes(4).toString("hex").slice(0, 7).toUpperCase();

  let cashierId: string;
  try {
    const cashier = await createCashier({
      name,
      slug,
      token: cashierToken,
      clientUrl: clientUrl || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      isActive: true,
    });
    cashierId = cashier.id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique")) {
      return { error: "Slug already in use. Choose a different one." };
    }
    return { error: "Failed to create cashier" };
  }

  // Auto-grant access to the creating DB user (not ENV root, who always sees everything)
  if (!session.isEnvRoot && session.masterUserId) {
    await toggleUserCashierPermission(session.masterUserId, cashierId, true);
  }

  if (cloneMethodsFrom) {
    await cloneCashierMethods(cloneMethodsFrom, cashierId);
  }

  redirect("/master/dashboard");
}
