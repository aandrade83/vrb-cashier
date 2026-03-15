import { db } from "@/db";
import { paymentMethods, methodFields, auditLogs } from "@/db/schema";
import { eq, and, sql, inArray, notInArray } from "drizzle-orm";
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

export async function getActiveDepositMethods(): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.type, "deposit"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getActivePayoutMethods(): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.type, "payout"),
        eq(paymentMethods.isActive, true),
        eq(paymentMethods.isDeleted, false)
      )
    )
    .orderBy(paymentMethods.createdAt);
}

export async function getMethodWithFields(methodId: string): Promise<MethodWithFields | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.id, methodId),
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

export async function getAllMethodsWithFields(): Promise<MethodWithFields[]> {
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.isDeleted, false))
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

export async function getAllActiveMethodsWithFields(): Promise<MethodWithFields[]> {
  const methods = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.isActive, true), eq(paymentMethods.isDeleted, false)))
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
  type: "deposit" | "payout"
): Promise<MethodWithFieldCount[]> {
  const rows = await db
    .select({
      id: paymentMethods.id,
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
    .where(and(eq(paymentMethods.type, type), eq(paymentMethods.isDeleted, false)))
    .orderBy(paymentMethods.createdAt);

  return rows.map((r) => ({ ...r, fieldCount: Number(r.fieldCount) }));
}

export async function getMethodById(id: string): Promise<MethodWithFields | null> {
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

export async function createMethod(
  data: MethodInput,
  adminUserId: string
): Promise<string> {
  const [method] = await db
    .insert(paymentMethods)
    .values({
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
  adminUserId: string
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

  // Upsert fields: update existing, insert new, safely delete removed ones
  const incomingIds = data.fields.map((f) => f.id).filter((fid): fid is string => !!fid);

  // Find existing field IDs for this method
  const existingFields = await db
    .select({ id: methodFields.id })
    .from(methodFields)
    .where(eq(methodFields.methodId, id));

  const existingIds = existingFields.map((f) => f.id);

  // IDs that were removed in the UI
  const removedIds = existingIds.filter((eid) => !incomingIds.includes(eid));

  // Only delete removed fields that have no transaction_field_values referencing them
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

  // Update existing fields and insert new ones
  for (const f of data.fields) {
    const fieldData = {
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
      // Update existing field
      await db.update(methodFields).set(fieldData).where(eq(methodFields.id, f.id));
    } else {
      // Insert new field
      await db.insert(methodFields).values(fieldData);
    }
  }

  await db.insert(auditLogs).values({
    actorUserId: adminUserId,
    action: "method.updated",
    entityType: "method",
    entityId: id,
    metadata: { name: data.name },
  });
}

export async function toggleMethodActive(
  id: string,
  adminUserId: string
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
    actorUserId: adminUserId,
    action: newActive ? "method.activated" : "method.deactivated",
    entityType: "method",
    entityId: id,
  });
}
