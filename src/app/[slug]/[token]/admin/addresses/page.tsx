import { getCashierId } from "@/lib/cashier-context";
import { getAddresses } from "@/data/random-pools";
import { AddressesView } from "./_components/AddressesView";

export default async function AdminAddressesPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const cashierId = await getCashierId();
  const addressesList = await getAddresses(cashierId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Addresses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pool of addresses assigned to transactions. Lowest priority number = assigned first.
            An address is locked while in use and released when the transaction completes or is rejected.
          </p>
        </div>
      </div>
      <AddressesView addresses={addressesList} slug={slug} token={token} />
    </div>
  );
}
