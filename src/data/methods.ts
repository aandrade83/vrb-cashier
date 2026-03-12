import { db } from "@/db";
import { paymentMethods, methodFields, auditLogs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { PaymentMethod, MethodField } from "@/db/schema";

export type MethodWithFieldCount = PaymentMethod & { fieldCount: number };

export type MethodWithFields = PaymentMethod & { fields: MethodField[] };

export type FieldInput = {
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

  // Replace all fields: delete existing, re-insert
  await db.delete(methodFields).where(eq(methodFields.methodId, id));

  if (data.fields.length > 0) {
    await db.insert(methodFields).values(
      data.fields.map((f) => ({
        methodId: id,
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
