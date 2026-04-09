"use server";

import { z } from "zod";
import { createCashier } from "@/data/cashiers";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";

const schema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(10).regex(/^[a-z0-9]+$/, "Only lowercase letters and numbers"),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

export async function createCashierAction(data: {
  name: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) throw new Error("Unauthorized");

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }

  const { name, slug, contactEmail, contactPhone } = parsed.data;

  // Generate a 7-character alphanumeric token
  const token = randomBytes(4).toString("hex").slice(0, 7).toUpperCase();

  try {
    await createCashier({
      name,
      slug,
      token,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      isActive: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique")) {
      return { error: "Slug already in use. Choose a different one." };
    }
    return { error: "Failed to create cashier" };
  }

  redirect("/master/dashboard");
}
