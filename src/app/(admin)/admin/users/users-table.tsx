"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  disableUserAction,
  enableUserAction,
  deleteUserAction,
  resetEmailVerificationAction,
} from "./actions";
import type { CashierUser } from "@/db/schema";

type Props = {
  users: CashierUser[];
  currentUserId?: string | null;
};

export function UsersTable({ users, currentUserId }: Props) {
  const router = useRouter();

  // Toggle active / delete share one transition slot
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Reset email verification — controlled dialog so it closes before async work starts
  const [resetDialogUserId, setResetDialogUserId] = useState<string | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<{ userId: string; message: string } | null>(null);

  function handleToggleActive(user: CashierUser) {
    setPendingId(user.id);
    startTransition(async () => {
      const action = user.isActive ? disableUserAction : enableUserAction;
      await action({ userId: user.id });
      router.refresh();
      setPendingId(null);
    });
  }

  function handleDelete(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      await deleteUserAction({ userId });
      router.refresh();
      setPendingId(null);
    });
  }

  // Called only after the dialog has already been closed via setResetDialogUserId(null)
  async function handleResetVerification(userId: string) {
    setResetLoadingId(userId);
    setResetError(null);
    try {
      const result = await resetEmailVerificationAction({ userId });
      if (!result.success) {
        setResetError({ userId, message: result.error });
      }
    } catch (err) {
      console.error("[reset-email] unexpected error:", err);
      setResetError({ userId, message: "Unexpected error. Check server logs." });
    } finally {
      setResetLoadingId(null);
      router.refresh();
    }
  }

  const ROOT_USER_ID = "8bcd74e0-f9a5-4b81-a65b-7b52f1b064cc";

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="py-8 text-center text-muted-foreground"
            >
              No users found.
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => {
            const isTogglePending = pendingId === user.id && isPending;
            const isResetLoading = resetLoadingId === user.id;
            const initials =
              (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "");

            const isCurrentUser = currentUserId === user.id;
            const isRootUser = user.id === ROOT_USER_ID;
            const canDelete =
              !isCurrentUser && !isRootUser && user.role !== "player";

            return (
              <TableRow key={user.id}>
                <TableCell>
                  <Avatar size="sm">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback>{initials.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </TableCell>

                {/* Account */}
                <TableCell>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-sm text-muted-foreground">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                  </p>
                </TableCell>

                {/* Email */}
                <TableCell>
                  {user.email ? (
                    <div className="space-y-1">
                      <p className="text-sm">{user.email}</p>
                      {user.role === "player" && (
                        <Badge
                          variant={user.emailVerified ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.emailVerified ? "✓ Verified" : "Unverified"}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                  {resetError?.userId === user.id && (
                    <p className="text-xs text-destructive mt-1">
                      {resetError.message}
                    </p>
                  )}
                </TableCell>

                {/* Role */}
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "destructive"}>
                    {user.isActive ? "Active" : "Disabled"}
                  </Badge>
                </TableCell>

                {/* Created */}
                <TableCell className="text-muted-foreground">
                  {format(new Date(user.createdAt), "do MMM yyyy")}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isTogglePending || isResetLoading}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.isActive ? "Disable" : "Enable"}
                    </Button>

                    {/* Reset email verification — players only, controlled dialog */}
                    {user.role === "player" && (
                      <AlertDialog
                        open={resetDialogUserId === user.id}
                        onOpenChange={(open) =>
                          setResetDialogUserId(open ? user.id : null)
                        }
                      >
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isTogglePending || isResetLoading}
                            />
                          }
                        >
                          {isResetLoading ? "Resetting..." : "Reset Email"}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset email verification?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the verified email from{" "}
                              <strong>{user.username}</strong> and require them
                              to verify a new address on next login.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                // Close the dialog first, then run the async action.
                                // This prevents the re-render from setState inside
                                // the async handler from freezing the dialog open.
                                setResetDialogUserId(null);
                                void handleResetVerification(user.id);
                              }}
                            >
                              Reset
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Delete — admins/clerks only */}
                    {canDelete ? (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isTogglePending || isResetLoading}
                            />
                          }
                        >
                          Delete
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete user?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete{" "}
                              <strong>
                                {user.firstName} {user.lastName}
                              </strong>{" "}
                              from the system. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDelete(user.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : user.role !== "player" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled
                        title={
                          isCurrentUser
                            ? "You cannot delete your own account"
                            : isRootUser
                            ? "Root user cannot be deleted"
                            : "Cannot delete this user"
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
