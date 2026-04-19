"use client";

import { masterLogoutAction } from "@/app/master/actions";
import { Button } from "@/components/ui/button";

export function MasterLogoutButton() {
  return (
    <form action={masterLogoutAction}>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
