"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { transactions, transactionFieldValues, transactionAttachments, auditLogs } from "@/db/schema";
import {
  findTransactionByIdempotencyKey,
  getNextTransactionSequence,
  getPlayerByClerkId,
} from "@/data/transactions";
import { getMethodWithFields } from "@/data/methods";

type ActionResult = { success: true; transactionId: string } | { success: false; error: string };

const fieldValueSchema = z.object({
  methodFieldId: z.string().uuid(),
  fieldLabelSnapshot: z.string().min(1),
  fieldTypeSnapshot: z.enum(["text", "textarea", "number", "dropdown", "file", "image", "date", "checkbox", "label", "hidden_label"]),
  value: z.string().nullable(),
});

const submitPayoutSchema = z.object({
  methodId: z.string().uuid(),
  fieldValues: z.array(fieldValueSchema),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  idempotencyKey: z.string().uuid(),
  currency: z.string().default("USD"),
});

export async function submitPayoutAction(data: unknown): Promise<ActionResult> {
  const { sessionClaims, userId: clerkId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "player" || !clerkId) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = submitPayoutSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { methodId, fieldValues, amount, idempotencyKey, currency } = parsed.data;

  const existing = await findTransactionByIdempotencyKey(idempotencyKey);
  if (existing) {
    return { success: true, transactionId: existing.id };
  }

  const method = await getMethodWithFields(methodId);
  if (!method) {
    return { success: false, error: "This payout method is no longer available." };
  }

  const player = await getPlayerByClerkId(clerkId);
  if (!player) {
    return { success: false, error: "Player account not found." };
  }

  const seq = await getNextTransactionSequence("payout");
  const year = new Date().getFullYear();
  const referenceCode = `PAY-${year}-${seq.toString().padStart(6, "0")}`;

  const [transaction] = await db
    .insert(transactions)
    .values({
      type: "payout",
      status: "pending",
      playerId: player.id,
      methodId,
      amount,
      currency,
      referenceCode,
      idempotencyKey,
    })
    .returning({ id: transactions.id });

  if (fieldValues.length > 0) {
    await db.insert(transactionFieldValues).values(
      fieldValues.map((fv) => ({
        transactionId: transaction.id,
        methodFieldId: fv.methodFieldId,
        fieldLabelSnapshot: fv.fieldLabelSnapshot,
        fieldTypeSnapshot: fv.fieldTypeSnapshot,
        value: fv.value,
      }))
    );
  }

  const attachmentFields = fieldValues.filter(
    (fv) =>
      (fv.fieldTypeSnapshot === "file" || fv.fieldTypeSnapshot === "image") &&
      fv.value
  );

  if (attachmentFields.length > 0) {
    await db.insert(transactionAttachments).values(
      attachmentFields.map((fv) => {
        const url = fv.value!;
        const fileName = url.split("/").pop() ?? fv.fieldLabelSnapshot;
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          pdf: "application/pdf",
          gif: "image/gif",
        };
        return {
          transactionId: transaction.id,
          methodFieldId: fv.methodFieldId,
          fileName,
          fileType: mimeMap[ext] ?? "application/octet-stream",
          fileUrl: url,
          uploadedByPlayerId: player.id,
        };
      })
    );
  }

  await db.insert(auditLogs).values({
    actorUserId: player.id,
    actorRole: "player",
    action: "transaction.created",
    entityType: "transaction",
    entityId: transaction.id,
    metadata: { type: "payout", methodId, amount, currency },
  });

  return { success: true, transactionId: transaction.id };
}
