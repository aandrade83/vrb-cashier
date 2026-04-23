// Central source of truth for all transaction status values, labels, and transitions.
// Import from here everywhere — never hardcode status strings.

export const TX_STATUS = {
  UNASSIGNED:   "unassigned",
  PENDING:      "pending",
  PRECONFIRMED: "preconfirmed",
  POSTCONFIRMED:"postconfirmed",
  COMPLETED:    "completed",
  DENIED:       "denied",
  CANCELLED:    "cancelled",
} as const;

export type TxStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS];

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  unassigned:   "Unassigned",
  pending:      "Pending",
  preconfirmed: "Pre-Confirmed",
  postconfirmed:"Post-Confirmed",
  completed:    "Completed",
  denied:       "Denied",
  cancelled:    "Cancelled",
};

export const TX_STATUS_BADGE_VARIANT: Record<
  TxStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  unassigned:   "secondary",
  pending:      "outline",
  preconfirmed: "default",
  postconfirmed:"default",
  completed:    "default",
  denied:       "destructive",
  cancelled:    "destructive",
};

export const TERMINAL_STATUSES: TxStatus[] = ["completed", "denied", "cancelled"];

export const ACTIVE_STATUSES: TxStatus[] = [
  "unassigned",
  "pending",
  "preconfirmed",
  "postconfirmed",
];

// Transitions available to clerks and master_clerks
export const NEXT_STATUSES_CLERK: Record<string, { value: TxStatus; label: string }[]> = {
  pending:      [{ value: "preconfirmed", label: "Pre-Confirm" }, { value: "denied", label: "Deny" }],
  preconfirmed: [{ value: "postconfirmed", label: "Post-Confirm" }, { value: "denied", label: "Deny" }],
};

// Transitions available to master_admin (superset of clerk transitions)
export const NEXT_STATUSES_ADMIN: Record<string, { value: TxStatus; label: string }[]> = {
  ...NEXT_STATUSES_CLERK,
  unassigned:    [{ value: "preconfirmed", label: "Pre-Confirm" }, { value: "denied", label: "Deny" }],
  postconfirmed: [{ value: "completed", label: "Complete" }],
};
