"use server";

import { z } from "zod";
import { db } from "@/db";
import { transactions, transactionFieldValues, transactionAttachments, auditLogs } from "@/db/schema";
import {
  findTransactionByIdempotencyKey,
  getNextTransactionSequence,
  getPlayerById,
} from "@/data/transactions";
import { getMethodWithFields } from "@/data/methods";
import { getUserSession } from "@/lib/auth/session";

type ActionResult = { success: true; transactionId: string } | { success: false; error: string };

const fieldValueSchema = z.object({
  methodFieldId: z.string().uuid(),
  fieldLabelSnapshot: z.string().min(1),
  fieldTypeSnapshot: z.enum([
    "text", "textarea", "number", "dropdown", "file", "image",
    "date", "checkbox", "label", "hidden_label", "random_list",
    "amount_list", "hyperlink", "name", "address",
  ]),
  value: z.string().nullable(),
});

const submitDepositSchema = z.object({
  methodId: z.string().uuid(),
  fieldValues: z.array(fieldValueSchema),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  expectedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid expected amount").optional(),
  idempotencyKey: z.string().uuid(),
  currency: z.string().default("USD"),
});

export async function submitDepositAction(data: unknown): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session || session.role !== "player") {
    return { success: false, error: "Unauthorized" };
  }

  const { userId, cashierId } = session;

  const parsed = submitDepositSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { methodId, fieldValues, amount, expectedAmount, idempotencyKey, currency } = parsed.data;

  if (expectedAmount) {
    const received = parseFloat(amount);
    const expected = parseFloat(expectedAmount);
    if (received > expected) {
      return { success: false, error: `Amount ${amount} exceeds the expected amount of ${expectedAmount}.` };
    }
  }

  const existing = await findTransactionByIdempotencyKey(idempotencyKey, cashierId);
  if (existing) {
    return { success: true, transactionId: existing.id };
  }

  const method = await getMethodWithFields(methodId, cashierId);
  if (!method) {
    return { success: false, error: "This deposit method is no longer available." };
  }

  const player = await getPlayerById(userId, cashierId);
  if (!player) {
    return { success: false, error: "Player account not found." };
  }

  const seq = await getNextTransactionSequence("deposit", cashierId);
  const year = new Date().getFullYear();
  const referenceCode = `DEP-${year}-${seq.toString().padStart(6, "0")}`;

  const [transaction] = await db
    .insert(transactions)
    .values({
      cashierId,
      type: "deposit",
      status: "pending",
      playerId: player.id,
      methodId,
      amount,
      expectedAmount: expectedAmount ?? null,
      currency,
      referenceCode,
      idempotencyKey,
    })
    .returning({ id: transactions.id });

  if (fieldValues.length > 0) {
    await db.insert(transactionFieldValues).values(
      fieldValues.map((fv) => ({
        cashierId,
        transactionId: transaction.id,
        methodFieldId: fv.methodFieldId,
        fieldLabelSnapshot: fv.fieldLabelSnapshot,
        fieldTypeSnapshot: fv.fieldTypeSnapshot,
        value: fv.value,
      }))
    );
  }

  const attachmentFields = fieldValues.filter(
    (fv) => (fv.fieldTypeSnapshot === "file" || fv.fieldTypeSnapshot === "image") && fv.value
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
          cashierId,
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
    cashierId,
    actorUserId: player.id,
    actorRole: "player",
    action: "transaction.created",
    entityType: "transaction",
    entityId: transaction.id,
    metadata: { type: "deposit", methodId, amount, currency },
  });

  return { success: true, transactionId: transaction.id };
}
