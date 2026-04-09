import { db } from "@/db";
import { paymentMethods, methodFields, auditLogs } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { transactionFieldValues } from "@/db/schema";
import type { PaymentMethod, MethodField } from "@/db/schema";

export type MethodWithFieldCount = PaymentMethod & { fieldCount: number };

export type MethodWithFields = PaymentMethod & { fields: MethodField[] };

export type FieldInput = {
  id?: string; // existing DB id — present for updates, absent for new fields
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

export async function getActiveDepositMethods(cashierId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.type, "deposit"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getActivePayoutMethods(cashierId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.type, "payout"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getMethodWithFields(
  methodId: string,
  cashierId: string
): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, methodId),
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
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
      and(eq(paymentMethods.cashierId, cashierId), eq(paymentMethods.isDeleted, false))
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
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
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
  type: "deposit" | "payout"
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
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.type, type),
        eq(paymentMethods.isDeleted, false)
      )
    )
    .orderBy(paymentMethods.createdAt);

  return rows.map((r) => ({ ...r, fieldCount: Number(r.fieldCount) }));
}

export async function getMethodById(
  id: string,
  cashierId: string
): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, id),
        eq(paymentMethods.cashierId, cashierId),
        eq(paymentMethods.isDeleted, false)
      )
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

export async function createMethod(
  data: MethodInput,
  adminUserId: string,
  cashierId: string
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
      }))
    );
  }

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
  cashierId: string
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
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.cashierId, cashierId)));

  // Upsert fields: update existing, insert new, safely delete removed ones
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
      cashierId,
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
  cashierId: string
): Promise<void> {
  const [method] = await db
    .select({ isActive: paymentMethods.isActive })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.cashierId, cashierId)))
    .limit(1);

  if (!method) return;

  const newActive = !method.isActive;

  await db
    .update(paymentMethods)
    .set({ isActive: newActive, updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.cashierId, cashierId)));

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: adminUserId,
    action: newActive ? "method.activated" : "method.deactivated",
    entityType: "method",
    entityId: id,
  });
}
