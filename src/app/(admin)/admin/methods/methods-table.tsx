"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { toggleMethodActiveAction } from "./actions";
import type { MethodWithFieldCount } from "@/data/methods";

type Props = {
  methods: MethodWithFieldCount[];
};

export function MethodsTable({ methods }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await toggleMethodActiveAction({ id });
      router.refresh();
      setPendingId(null);
    });
  }

  if (methods.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No methods found. Create one to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Logo</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fields</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((method) => (
          <TableRow key={method.id}>
            <TableCell>
              {method.logoUrl ? (
                <Image
                  src={method.logoUrl}
                  alt={method.name}
                  width={40}
                  height={40}
                  className="rounded object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  —
                </div>
              )}
            </TableCell>
            <TableCell className="font-medium">{method.name}</TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">
                {method.type}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={method.isActive ? "default" : "secondary"}>
                {method.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>{method.fieldCount} field{method.fieldCount !== 1 ? "s" : ""}</TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending && pendingId === method.id}
                onClick={() => handleToggle(method.id)}
              >
                {method.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Link
                href={`/admin/methods/${method.id}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Edit
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
