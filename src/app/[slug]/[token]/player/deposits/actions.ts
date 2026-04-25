"use server";

import { z } from "zod";
import { db } from "@/db";
import { transactions, transactionFieldValues, transactionAttachments, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  findTransactionByIdempotencyKey,
  getNextTransactionSequence,
  getPlayerById,
} from "@/data/transactions";
import { getMethodWithFields } from "@/data/methods";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getOrCreateShadowPlayer } from "@/lib/master-actor";
import {
  getNameListForCashier,
  lockNameForTransaction,
  lockNextAvailableForTransaction,
  commitRotation,
} from "@/data/name-lists";
import { getUserById } from "@/data/users";
import { getClerkEmailsForCashier } from "@/data/master-users";
import { getCashierById } from "@/data/cashiers";
import { sendNewTransactionEmail, sendTransactionReceivedEmail } from "@/lib/email";

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
  nameId: z.string().uuid().nullable().optional(),
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
  let userId: string;
  let cashierId: string;

  const [userSession, masterSession] = await Promise.all([
    getUserSession(),
    getMasterSession(),
  ]);

  // Master session takes priority — prevents stale player cookie from interfering
  const isMasterActing = !!(masterSession?.actingCashierId);

  if (isMasterActing) {
    const access = await getCashierPageAccess("player");
    if (!access) return { success: false, error: "Unauthorized" };
    cashierId = access.cashierId;
    if (access.userId) {
      userId = access.userId;
    } else {
      const shadow = await getOrCreateShadowPlayer(cashierId);
      if (!shadow) return { success: false, error: "Unauthorized" };
      userId = shadow.id;
    }
  } else if (userSession && userSession.role === "player") {
    userId = userSession.userId;
    cashierId = userSession.cashierId;
  } else {
    return { success: false, error: "Unauthorized" };
  }

  // Block unverified real players — master sessions bypass this check
  if (!isMasterActing && userSession?.role === "player") {
    const playerRecord = await getUserById(userId, cashierId);
    if (!playerRecord?.emailVerified) {
      return { success: false, error: "Email verification required." };
    }
  }

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

  const [seq, cashierForRef] = await Promise.all([
    getNextTransactionSequence("deposit", cashierId),
    getCashierById(cashierId),
  ]);
  if (!cashierForRef) return { success: false, error: "Cashier not found." };
  const referenceCode = `DEP-${cashierForRef.slug.toUpperCase()}-${seq.toString().padStart(6, "0")}`;

  let transaction: { id: string };
  try {
    const [row] = await db
      .insert(transactions)
      .values({
        cashierId,
        type: "deposit",
        status: "unassigned",
        playerId: player.id,
        methodId,
        amount,
        expectedAmount: expectedAmount ?? null,
        currency,
        referenceCode,
        idempotencyKey,
      })
      .returning({ id: transactions.id });
    transaction = row;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deposit] insert failed — cashierId=%s playerId=%s methodId=%s amount=%s error=%s", cashierId, player.id, methodId, amount, msg);
    return { success: false, error: "Failed to create transaction. Please try again." };
  }

  // Separate name fields (handled via new Name List system) from others
  const regularFieldValues = fieldValues.filter((fv) => fv.fieldTypeSnapshot !== "name");
  const nameFieldValues = fieldValues.filter((fv) => fv.fieldTypeSnapshot === "name");

  if (regularFieldValues.length > 0) {
    await db.insert(transactionFieldValues).values(
      regularFieldValues.map((fv) => ({
        cashierId,
        transactionId: transaction.id,
        methodFieldId: fv.methodFieldId,
        fieldLabelSnapshot: fv.fieldLabelSnapshot,
        fieldTypeSnapshot: fv.fieldTypeSnapshot,
        value: fv.value,
      }))
    );
  }

  // Handle name fields: use Name List system if configured, else fall back to old pool
  const nameList = nameFieldValues.length > 0
    ? await getNameListForCashier(methodId, cashierId)
    : null;

  const nameValuesToInsert: {
    cashierId: string; transactionId: string; methodFieldId: string;
    fieldLabelSnapshot: string; fieldTypeSnapshot: "name"; value: string | null;
  }[] = [];

  for (const fv of nameFieldValues) {
    if (nameList && fv.nameId) {
      // New Name List system
      let finalValue: string | null = null;
      if (nameList.blockingMode === "yes") {
        const locked = await lockNameForTransaction(fv.nameId, transaction.id, referenceCode);
        if (locked) {
          finalValue = locked.value;
        } else {
          const fallback = await lockNextAvailableForTransaction(methodId, cashierId, transaction.id, referenceCode);
          if (fallback) {
            finalValue = fallback.value;
          } else {
            // No names available — remove orphaned transaction rows and return error
            await db.delete(transactions).where(eq(transactions.id, transaction.id));
            return { success: false, error: "No names available at this time. Please try again later." };
          }
        }
      } else {
        const committed = await commitRotation(methodId, cashierId, fv.nameId, referenceCode);
        finalValue = committed?.value ?? fv.value ?? null;
      }
      nameValuesToInsert.push({
        cashierId, transactionId: transaction.id,
        methodFieldId: fv.methodFieldId, fieldLabelSnapshot: fv.fieldLabelSnapshot,
        fieldTypeSnapshot: "name", value: finalValue,
      });
    }
  }

  if (nameValuesToInsert.length > 0) {
    await db.insert(transactionFieldValues).values(nameValuesToInsert);
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

  // Fire-and-forget notifications — never block the player response
  void (async () => {
    try {
      const [clerkEmails, cashier] = await Promise.all([
        getClerkEmailsForCashier(cashierId),
        getCashierById(cashierId),
      ]);
      if (!cashier) return;
      const playerName =
        [player.firstName, player.lastName].filter(Boolean).join(" ") || player.username;

      await Promise.allSettled([
        clerkEmails.length > 0
          ? sendNewTransactionEmail({
              to: clerkEmails,
              cashierName: cashier.name,
              referenceCode,
              type: "deposit",
              playerName,
              playerEmail: player.email ?? null,
              methodName: method.name,
              amount,
              currency,
            })
          : Promise.resolve(),
        player.email
          ? sendTransactionReceivedEmail({
              to: player.email,
              cashierName: cashier.name,
              referenceCode,
              type: "deposit",
              playerName,
              methodName: method.name,
              amount,
              currency,
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("[deposit] notification emails failed:", err);
    }
  })();

  return { success: true, transactionId: transaction.id };
}
