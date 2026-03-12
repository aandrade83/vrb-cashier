export type Role = "admin" | "clerk" | "player";

declare global {
  interface CustomJwtSessionClaims {
    metadata?: { role?: Role };
    public_metadata?: { role?: Role };
  }
}
