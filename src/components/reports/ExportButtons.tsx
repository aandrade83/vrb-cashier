"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  exportAction: (filtersJson: string) => Promise<string>;
  filtersJson: string;
  filename?: string;
}

export function ExportButtons({ exportAction, filtersJson, filename = "report" }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startTransition(async () => {
      try {
        const csv = await exportAction(filtersJson);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        setError("Export failed. Please try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isPending}
        className="gap-2"
      >
        {isPending ? (
          <>
            <span className="animate-spin text-xs">⏳</span>
            Exporting…
          </>
        ) : (
          <>↓ Export CSV</>
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
