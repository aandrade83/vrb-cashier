"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCashierId } from "@/lib/cashier-context";
import { getSessionForCashier } from "@/lib/auth/session";
import {
  createName,
  updateName,
  deleteName,
} from "@/data/random-pools";

async function requireAdmin(cashierId: string) {
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") throw new Error("Unauthorized");
  return access.userId;
}

const createSchema = z.object({
  value: z.string().min(1).max(200),
  priority: z.number().int().min(0),
  slug: z.string(),
  token: z.string(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  value: z.string().min(1).max(200).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  slug: z.string(),
  token: z.string(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  token: z.string(),
});

export async function createNameAction(data: {
  value: string;
  priority: number;
  slug: string;
  token: string;
}) {
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const cashierId = await getCashierId();
  await requireAdmin(cashierId);
  await createName(cashierId, parsed.data.value, parsed.data.priority);

  revalidatePath(`/${data.slug}/${data.token}/admin/names`);
}

export async function updateNameAction(data: {
  id: string;
  value?: string;
  priority?: number;
  isActive?: boolean;
  slug: string;
  token: string;
}) {
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const cashierId = await getCashierId();
  await requireAdmin(cashierId);
  await updateName(parsed.data.id, cashierId, {
    ...(parsed.data.value !== undefined && { value: parsed.data.value }),
    ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
    ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
  });

  revalidatePath(`/${data.slug}/${data.token}/admin/names`);
}

export async function deleteNameAction(data: {
  id: string;
  slug: string;
  token: string;
}) {
  const parsed = deleteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const cashierId = await getCashierId();
  await requireAdmin(cashierId);
  await deleteName(parsed.data.id, cashierId);

  revalidatePath(`/${data.slug}/${data.token}/admin/names`);
}
