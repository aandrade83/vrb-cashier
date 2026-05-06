"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getOrCreateShadowPlayer } from "@/lib/master-actor";
import { getPlayerById, updatePlayerTransactionNote } from "@/data/transactions";

const saveNoteSchema = z.object({
  transactionId: z.string().uuid(),
  note: z.string().max(1000),
  slug: z.string(),
  token: z.string(),
});

type SaveNoteInput = z.infer<typeof saveNoteSchema>;

export async function savePlayerNoteAction(data: SaveNoteInput) {
  const parsed = saveNoteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const access = await getCashierPageAccess("player");
  if (!access) throw new Error("Unauthorized");

  const { userId, cashierId, isMasterActing } = access;

  let resolvedUserId = userId;
  if (!resolvedUserId && isMasterActing) {
    const shadow = await getOrCreateShadowPlayer(cashierId);
    resolvedUserId = shadow?.id ?? null;
  }
  if (!resolvedUserId) throw new Error("Unauthorized");

  const player = await getPlayerById(resolvedUserId, cashierId);
  if (!player) throw new Error("Unauthorized");

  await updatePlayerTransactionNote(
    parsed.data.transactionId,
    player.id,
    cashierId,
    parsed.data.note,
  );

  revalidatePath(`/${parsed.data.slug}/${parsed.data.token}/player/transactions`);
}
