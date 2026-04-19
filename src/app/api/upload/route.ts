import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { methodFields } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCashierId } from "@/lib/cashier-context";
import { getUserSession } from "@/lib/auth/session";

const ADMIN_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PLAYER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const session = await getUserSession();
  const role = session?.role;

  if (role === "admin") {
    return handleAdminUpload(request);
  }

  if (role === "player") {
    return handlePlayerUpload(request);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleAdminUpload(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ADMIN_ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2MB." },
      { status: 400 }
    );
  }

  const blob = await put(`method-logos/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}

async function handlePlayerUpload(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const methodFieldId = formData.get("methodFieldId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (typeof methodFieldId !== "string" || !methodFieldId) {
    return NextResponse.json({ error: "Missing upload context" }, { status: 400 });
  }

  const cashierId = await getCashierId();
  if (!cashierId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [field] = await db
    .select({ id: methodFields.id, fieldType: methodFields.fieldType })
    .from(methodFields)
    .where(
      and(
        eq(methodFields.id, methodFieldId),
        eq(methodFields.cashierId, cashierId)
      )
    )
    .limit(1);

  if (!field) {
    return NextResponse.json({ error: "Invalid upload context" }, { status: 403 });
  }

  if (field.fieldType !== "file" && field.fieldType !== "image") {
    return NextResponse.json({ error: "This field does not accept file uploads" }, { status: 403 });
  }

  if (!PLAYER_ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPG, PNG, WebP, PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2MB." },
      { status: 400 }
    );
  }

  const blob = await put(`transaction-receipts/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
