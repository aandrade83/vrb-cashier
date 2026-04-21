"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Settings2 } from "lucide-react";
import { setMasterUserActiveAction, deleteMasterUserAction } from "./actions";
import type { MasterUser } from "@/db/schema";

interface Props {
  users: MasterUser[];
  currentUserId: string | null;
  currentUserIsEnvRoot: boolean;
  currentUserRole: "master_admin" | "master_clerk" | null;
}

export function MasterUsersTable({ users, currentUserId, currentUserIsEnvRoot, currentUserRole }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const deleting = deletingId ? users.find((u) => u.id === deletingId) : null;

  function handleToggleActive(user: MasterUser) {
    startTransition(async () => {
      await setMasterUserActiveAction(user.id, !user.isActive);
      router.refresh();
    });
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingId) return;
    setDeleteError("");
    setDeleteLoading(true);
    const result = await deleteMasterUserAction(deletingId);
    setDeleteLoading(false);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    setDeletingId(null);
    router.refresh();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No DB users yet. Create one to allow login without env credentials.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const isSelf = currentUserId === user.id;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "master_admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "outline"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {user.mustResetPassword && (
                      <Badge variant="secondary" className="ml-1">
                        Reset pwd
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastLogin
                      ? format(new Date(user.lastLogin), "do MMM yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(user.createdAt), "do MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(currentUserIsEnvRoot ||
                        (currentUserRole === "master_admin" && user.role === "master_clerk")) && (
                        <Link
                          href={`/master/users/${user.id}/permissions`}
                          title="Cashier permissions"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf}
                        title={isSelf ? "Cannot deactivate your own account" : undefined}
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isSelf}
                        title={isSelf ? "Cannot delete your own account" : undefined}
                        onClick={() => {
                          setDeletingId(user.id);
                          setDeleteError("");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.username}</strong> will be permanently deleted. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDelete} className="space-y-4 pt-2">
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
