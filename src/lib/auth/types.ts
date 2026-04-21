export type UserRole = "admin" | "clerk" | "player";

export type MasterRole = "master_admin" | "master_clerk";

export type UserSession = {
  type: "cashier";
  sessionToken: string;
  userId: string;
  cashierId: string;
  role: UserRole;
};

export type MasterSession = {
  type: "master";
  sessionToken: string;
  // true = authenticated via MASTER_EMAIL/MASTER_PASSWORD env vars (root account)
  // false = authenticated via users DB table
  isEnvRoot: boolean;
  // null when isEnvRoot is true
  masterUserId: string | null;
  role: MasterRole;
  // Set when master is visiting a specific cashier tenant
  actingCashierId?: string;
  // Set when master is impersonating a specific role within a cashier
  // null/undefined = admin, "clerk" = clerk, "player" = player
  actingRole?: UserRole;
};

export type AuthSession = UserSession | MasterSession;
