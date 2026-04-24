import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cashiers } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeHostname(raw: string): string {
  const s = raw.trim().toLowerCase();
  try {
    // If it already looks like a URL, parse it
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return s.replace(/^www\./, "");
  }
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");

  if (!domain) {
    return NextResponse.json(
      { error: "Missing domain parameter" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const normalizedDomain = normalizeHostname(domain);

  const activeCashiers = await db
    .select({
      slug: cashiers.slug,
      token: cashiers.token,
      clientUrl: cashiers.clientUrl,
    })
    .from(cashiers)
    .where(eq(cashiers.isActive, true));

  const match = activeCashiers.find((c) => {
    if (!c.clientUrl) return false;
    return normalizeHostname(c.clientUrl) === normalizedDomain;
  });

  if (!match) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const origin = req.nextUrl.origin;
  const cashierUrl = `${origin}/${match.slug}/${match.token}/`;

  return NextResponse.json(
    { url: cashierUrl },
    { status: 200, headers: CORS_HEADERS }
  );
}
