export type UserRole = "admin" | "clerk" | "player";

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
  actingCashierId?: string;
};

export type AuthSession = UserSession | MasterSession;
