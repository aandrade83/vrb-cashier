import { db } from "@/db";
import { paymentMethods, methodFields, cashierMethods, auditLogs } from "@/db/schema";
import { eq, and, sql, inArray, exists } from "drizzle-orm";
import { transactionFieldValues, transactions } from "@/db/schema";
import { count } from "drizzle-orm";
import type { PaymentMethod, MethodField } from "@/db/schema";

export type MethodWithFieldCount = PaymentMethod & { fieldCount: number };

export type MethodWithFields = PaymentMethod & { fields: MethodField[] };

export type FieldInput = {
  id?: string;
  label: string;
  placeholder?: string | null;
  fieldType: MethodField["fieldType"];
  isRequired: boolean;
  displayOrder: number;
  dropdownOptions?: unknown;
  fileConfig?: unknown;
  validationRules?: unknown;
};

export type MethodInput = {
  name: string;
  type: "deposit" | "payout";
  description?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  fields: FieldInput[];
};

// =============================================================================
// CASHIER-SCOPED READS (use cashier_methods junction)
// All player-facing and cashier-admin-facing queries go through this junction.
// =============================================================================

function assignedToExists(cashierId: string, enabledOnly: boolean) {
  return exists(
    db
      .select({ _: sql<number>`1` })
      .from(cashierMethods)
      .where(
        and(
          eq(cashierMethods.methodId, paymentMethods.id),
          eq(cashierMethods.cashierId, cashierId),
          ...(enabledOnly ? [eq(cashierMethods.enabled, true)] : []),
        ),
      ),
  );
}

export async function getActiveDepositMethods(cashierId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.type, "deposit"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, true),
      ),
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getActivePayoutMethods(cashierId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.type, "payout"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, true),
      ),
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getMethodWithFields(
  methodId: string,
  cashierId: string,
): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, methodId),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, true),
      ),
    )
    .limit(1);

  if (!method) return null;

  const fields = await db
    .select()
    .from(methodFields)
    .where(eq(methodFields.methodId, methodId))
    .orderBy(methodFields.displayOrder);

  return { ...method, fields };
}

export async function getAllMethodsWithFields(cashierId: string): Promise<MethodWithFields[]> {
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, false),
      ),
    )
    .orderBy(paymentMethods.type, paymentMethods.createdAt);

  if (methods.length === 0) return [];

  const allFields = await db
    .select()
    .from(methodFields)
    .where(inArray(methodFields.methodId, methods.map((m) => m.id)))
    .orderBy(methodFields.methodId, methodFields.displayOrder);

  return methods.map((m) => ({
    ...m,
    fields: allFields.filter((f) => f.methodId === m.id),
  }));
}

export async function getAllActiveMethodsWithFields(cashierId: string): Promise<MethodWithFields[]> {
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, true),
      ),
    )
    .orderBy(paymentMethods.type, paymentMethods.createdAt);

  if (methods.length === 0) return [];

  const allFields = await db
    .select()
    .from(methodFields)
    .where(inArray(methodFields.methodId, methods.map((m) => m.id)))
    .orderBy(methodFields.methodId, methodFields.displayOrder);

  return methods.map((m) => ({
    ...m,
    fields: allFields.filter((f) => f.methodId === m.id),
  }));
}

export async function getMethodsForAdmin(
  cashierId: string,
  type: "deposit" | "payout",
): Promise<MethodWithFieldCount[]> {
  const rows = await db
    .select({
      id: paymentMethods.id,
      cashierId: paymentMethods.cashierId,
      name: paymentMethods.name,
      type: paymentMethods.type,
      description: paymentMethods.description,
      logoUrl: paymentMethods.logoUrl,
      isActive: paymentMethods.isActive,
      isDeleted: paymentMethods.isDeleted,
      createdByAdminId: paymentMethods.createdByAdminId,
      createdAt: paymentMethods.createdAt,
      updatedAt: paymentMethods.updatedAt,
      fieldCount: sql<number>`(
        select count(*) from method_fields where method_fields.method_id = ${paymentMethods.id}
      )`,
    })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.type, type),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, false),
      ),
    )
    .orderBy(paymentMethods.createdAt);

  return rows.map((r) => ({ ...r, fieldCount: Number(r.fieldCount) }));
}

export async function getMethodById(
  id: string,
  cashierId: string,
): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.isDeleted, false),
        assignedToExists(cashierId, false),
      ),
    )
    .limit(1);

  if (!method) return null;

  const fields = await db
    .select()
    .from(methodFields)
    .where(eq(methodFields.methodId, id))
    .orderBy(methodFields.displayOrder);

  return { ...method, fields };
}

// =============================================================================
// CASHIER-SCOPED WRITES (still used by cashier admin panel for legacy methods)
// =============================================================================

export async function createMethod(
  data: MethodInput,
  adminUserId: string,
  cashierId: string,
): Promise<string> {
  const [method] = await db
    .insert(paymentMethods)
    .values({
      cashierId,
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      isActive: data.isActive,
      createdByAdminId: adminUserId,
    })
    .returning({ id: paymentMethods.id });

  if (data.fields.length > 0) {
    await db.insert(methodFields).values(
      data.fields.map((f) => ({
        cashierId,
        methodId: method.id,
        label: f.label,
        placeholder: f.placeholder ?? null,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        displayOrder: f.displayOrder,
        dropdownOptions: f.dropdownOptions ?? null,
        fileConfig: f.fileConfig ?? null,
        validationRules: f.validationRules ?? null,
      })),
    );
  }

  // Auto-assign to the cashier that created it
  await db
    .insert(cashierMethods)
    .values({ cashierId, methodId: method.id, enabled: data.isActive })
    .onConflictDoNothing();

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: adminUserId,
    action: "method.created",
    entityType: "method",
    entityId: method.id,
    metadata: { name: data.name, type: data.type },
  });

  return method.id;
}

export async function updateMethod(
  id: string,
  data: MethodInput,
  adminUserId: string,
  cashierId: string,
): Promise<void> {
  await db
    .update(paymentMethods)
    .set({
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(paymentMethods.id, id));

  const incomingIds = data.fields.map((f) => f.id).filter((fid): fid is string => !!fid);

  const existingFields = await db
    .select({ id: methodFields.id })
    .from(methodFields)
    .where(eq(methodFields.methodId, id));

  const existingIds = existingFields.map((f) => f.id);
  const removedIds = existingIds.filter((eid) => !incomingIds.includes(eid));

  if (removedIds.length > 0) {
    const referenced = await db
      .select({ methodFieldId: transactionFieldValues.methodFieldId })
      .from(transactionFieldValues)
      .where(inArray(transactionFieldValues.methodFieldId, removedIds));

    const referencedIds = new Set(referenced.map((r) => r.methodFieldId));
    const safeToDelete = removedIds.filter((rid) => !referencedIds.has(rid));

    if (safeToDelete.length > 0) {
      await db.delete(methodFields).where(inArray(methodFields.id, safeToDelete));
    }
  }

  for (const f of data.fields) {
    const fieldData = {
      cashierId: cashierId ?? null,
      methodId: id,
      label: f.label,
      placeholder: f.placeholder ?? null,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      displayOrder: f.displayOrder,
      dropdownOptions: f.dropdownOptions ?? null,
      fileConfig: f.fileConfig ?? null,
      validationRules: f.validationRules ?? null,
    };

    if (f.id && existingIds.includes(f.id)) {
      await db.update(methodFields).set(fieldData).where(eq(methodFields.id, f.id));
    } else {
      await db.insert(methodFields).values(fieldData);
    }
  }

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: adminUserId,
    action: "method.updated",
    entityType: "method",
    entityId: id,
    metadata: { name: data.name },
  });
}

export async function toggleMethodActive(
  id: string,
  adminUserId: string,
  cashierId: string,
): Promise<void> {
  const [method] = await db
    .select({ isActive: paymentMethods.isActive })
    .from(paymentMethods)
    .where(eq(paymentMethods.id, id))
    .limit(1);

  if (!method) return;

  const newActive = !method.isActive;

  await db
    .update(paymentMethods)
    .set({ isActive: newActive, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id));

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: adminUserId,
    action: newActive ? "method.activated" : "method.deactivated",
    entityType: "method",
    entityId: id,
  });
}

// =============================================================================
// GLOBAL METHOD READS (master only — no cashier filter)
// =============================================================================

export async function getGlobalMethodsWithFieldCount(
  type?: "deposit" | "payout",
): Promise<MethodWithFieldCount[]> {
  const rows = await db
    .select({
      id: paymentMethods.id,
      cashierId: paymentMethods.cashierId,
      name: paymentMethods.name,
      type: paymentMethods.type,
      description: paymentMethods.description,
      logoUrl: paymentMethods.logoUrl,
      isActive: paymentMethods.isActive,
      isDeleted: paymentMethods.isDeleted,
      createdByAdminId: paymentMethods.createdByAdminId,
      createdAt: paymentMethods.createdAt,
      updatedAt: paymentMethods.updatedAt,
      fieldCount: sql<number>`(
        select count(*) from method_fields where method_fields.method_id = ${paymentMethods.id}
      )`,
    })
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.isDeleted, false),
        ...(type ? [eq(paymentMethods.type, type)] : []),
      ),
    )
    .orderBy(paymentMethods.type, paymentMethods.createdAt);

  return rows.map((r) => ({ ...r, fieldCount: Number(r.fieldCount) }));
}

export async function getGlobalMethodById(id: string): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.isDeleted, false)))
    .limit(1);

  if (!method) return null;

  const fields = await db
    .select()
    .from(methodFields)
    .where(eq(methodFields.methodId, id))
    .orderBy(methodFields.displayOrder);

  return { ...method, fields };
}

// =============================================================================
// GLOBAL METHOD WRITES (master only)
// =============================================================================

export async function createGlobalMethod(data: MethodInput): Promise<string> {
  const [method] = await db
    .insert(paymentMethods)
    .values({
      cashierId: null,
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      isActive: data.isActive,
      createdByAdminId: null,
    })
    .returning({ id: paymentMethods.id });

  if (data.fields.length > 0) {
    await db.insert(methodFields).values(
      data.fields.map((f) => ({
        cashierId: null,
        methodId: method.id,
        label: f.label,
        placeholder: f.placeholder ?? null,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        displayOrder: f.displayOrder,
        dropdownOptions: f.dropdownOptions ?? null,
        fileConfig: f.fileConfig ?? null,
        validationRules: f.validationRules ?? null,
      })),
    );
  }

  return method.id;
}

export async function updateGlobalMethod(id: string, data: MethodInput): Promise<void> {
  await db
    .update(paymentMethods)
    .set({
      name: data.name,
      type: data.type,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.isDeleted, false)));

  const incomingIds = data.fields.map((f) => f.id).filter((fid): fid is string => !!fid);

  const existingFields = await db
    .select({ id: methodFields.id })
    .from(methodFields)
    .where(eq(methodFields.methodId, id));

  const existingIds = existingFields.map((f) => f.id);
  const removedIds = existingIds.filter((eid) => !incomingIds.includes(eid));

  if (removedIds.length > 0) {
    const referenced = await db
      .select({ methodFieldId: transactionFieldValues.methodFieldId })
      .from(transactionFieldValues)
      .where(inArray(transactionFieldValues.methodFieldId, removedIds));

    const referencedIds = new Set(referenced.map((r) => r.methodFieldId));
    const safeToDelete = removedIds.filter((rid) => !referencedIds.has(rid));

    if (safeToDelete.length > 0) {
      await db.delete(methodFields).where(inArray(methodFields.id, safeToDelete));
    }
  }

  for (const f of data.fields) {
    const fieldData = {
      cashierId: null as string | null,
      methodId: id,
      label: f.label,
      placeholder: f.placeholder ?? null,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      displayOrder: f.displayOrder,
      dropdownOptions: f.dropdownOptions ?? null,
      fileConfig: f.fileConfig ?? null,
      validationRules: f.validationRules ?? null,
    };

    if (f.id && existingIds.includes(f.id)) {
      await db.update(methodFields).set(fieldData).where(eq(methodFields.id, f.id));
    } else {
      await db.insert(methodFields).values(fieldData);
    }
  }
}

export async function toggleGlobalMethodActive(id: string): Promise<void> {
  const [method] = await db
    .select({ isActive: paymentMethods.isActive })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.isDeleted, false)))
    .limit(1);

  if (!method) return;

  await db
    .update(paymentMethods)
    .set({ isActive: !method.isActive, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id));
}

export async function deleteGlobalMethod(
  id: string,
): Promise<{ deleted: true } | { deleted: false; deactivated: true }> {
  const [historyRow] = await db
    .select({ count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.methodId, id),
        inArray(transactions.status, ["approved", "rejected", "completed"]),
      ),
    );

  const hasHistory = Number(historyRow?.count ?? 0) > 0;

  if (hasHistory) {
    await db
      .update(paymentMethods)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(paymentMethods.id, id));
    return { deleted: false, deactivated: true };
  }

  await db
    .update(paymentMethods)
    .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id));
  return { deleted: true };
}

// =============================================================================
// CASHIER METHOD ASSIGNMENTS
// =============================================================================

export type CashierMethodAssignment = {
  methodId: string;
  methodName: string;
  type: "deposit" | "payout";
  isActive: boolean;
  logoUrl: string | null;
  enabled: boolean;
};

export async function getCashierMethodAssignments(
  cashierId: string,
): Promise<CashierMethodAssignment[]> {
  const allMethods = await db
    .select({
      id: paymentMethods.id,
      name: paymentMethods.name,
      type: paymentMethods.type,
      isActive: paymentMethods.isActive,
      logoUrl: paymentMethods.logoUrl,
    })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.isDeleted, false)))
    .orderBy(paymentMethods.type, paymentMethods.name);

  const assignments = await db
    .select({ methodId: cashierMethods.methodId, enabled: cashierMethods.enabled })
    .from(cashierMethods)
    .where(eq(cashierMethods.cashierId, cashierId));

  const assignmentMap = new Map(assignments.map((a) => [a.methodId, a.enabled]));

  return allMethods.map((m) => ({
    methodId: m.id,
    methodName: m.name,
    type: m.type as "deposit" | "payout",
    isActive: m.isActive,
    logoUrl: m.logoUrl,
    enabled: assignmentMap.get(m.id) ?? false,
  }));
}

export async function setCashierMethodAssignments(
  cashierId: string,
  assignments: { methodId: string; enabled: boolean }[],
): Promise<void> {
  // Upsert each assignment
  for (const { methodId, enabled } of assignments) {
    await db
      .insert(cashierMethods)
      .values({ cashierId, methodId, enabled })
      .onConflictDoUpdate({
        target: [cashierMethods.cashierId, cashierMethods.methodId],
        set: { enabled },
      });
  }

  // Remove any methods that were not included (deassign)
  const methodIdsToKeep = assignments.map((a) => a.methodId);
  if (methodIdsToKeep.length > 0) {
    await db
      .delete(cashierMethods)
      .where(
        and(
          eq(cashierMethods.cashierId, cashierId),
          sql`${cashierMethods.methodId} NOT IN ${sql`(${sql.join(methodIdsToKeep.map((id) => sql`${id}::uuid`), sql`, `)})`}`,
        ),
      );
  } else {
    await db.delete(cashierMethods).where(eq(cashierMethods.cashierId, cashierId));
  }
}

export async function cloneCashierMethods(
  sourceCashierId: string,
  targetCashierId: string,
): Promise<void> {
  const sourceAssignments = await db
    .select({ methodId: cashierMethods.methodId, enabled: cashierMethods.enabled })
    .from(cashierMethods)
    .where(eq(cashierMethods.cashierId, sourceCashierId));

  if (sourceAssignments.length === 0) {
    // Source has no assignments — clear target
    await db.delete(cashierMethods).where(eq(cashierMethods.cashierId, targetCashierId));
    return;
  }

  // Delete target's existing assignments then insert source's
  await db.delete(cashierMethods).where(eq(cashierMethods.cashierId, targetCashierId));

  await db.insert(cashierMethods).values(
    sourceAssignments.map(({ methodId, enabled }) => ({
      cashierId: targetCashierId,
      methodId,
      enabled,
    })),
  );
}
