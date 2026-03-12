import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getActiveDepositMethods } from "@/data/methods";

export default async function DepositsPage() {
  const { sessionClaims } = await auth();

  if (sessionClaims?.public_metadata?.role !== "player") {
    redirect("/");
  }

  const methods = await getActiveDepositMethods();

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Deposits</h1>

      {methods.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No deposit methods are currently available. Please check back later.
        </p>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <Link
              key={method.id}
              href={`/player/deposits/${method.id}`}
              className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0">
                {method.logoUrl ? (
                  <Image
                    src={method.logoUrl}
                    alt={method.name}
                    width={48}
                    height={48}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xl">
                    💳
                  </div>
                )}
              </div>
              <span className="flex-1 font-medium">{method.name}</span>
              <span className="text-muted-foreground">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
