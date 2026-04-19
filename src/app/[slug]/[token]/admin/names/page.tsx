import { getCashierId } from "@/lib/cashier-context";
import { getNames } from "@/data/random-pools";
import { NamesView } from "./_components/NamesView";

export default async function AdminNamesPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const cashierId = await getCashierId();
  const namesList = await getNames(cashierId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Names</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pool of names assigned to transactions. Lowest priority number = assigned first.
            A name is locked while in use and released when the transaction completes or is rejected.
          </p>
        </div>
      </div>
      <NamesView names={namesList} slug={slug} token={token} />
    </div>
  );
}
