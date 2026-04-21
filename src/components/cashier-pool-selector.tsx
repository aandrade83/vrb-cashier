"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  cashiers: { id: string; name: string }[];
  selectedId: string | null;
  basePath: string;
}

export function CashierPoolSelector({ cashiers, selectedId, basePath }: Props) {
  const router = useRouter();

  const selected = cashiers.find((c) => c.id === selectedId);

  return (
    <Select
      value={selectedId ?? ""}
      onValueChange={(v) => { if (v) router.push(`${basePath}?cashier=${v}`); }}
    >
      <SelectTrigger className="w-48">
        <SelectValue>
          {selected?.name ?? "Select cashier"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {cashiers.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
