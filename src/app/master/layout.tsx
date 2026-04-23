import { redirect } from "next/navigation";
import {
  getMasterSessionFromCookies,
  getMasterSessionData,
  getMasterVerificationStatus,
} from "@/lib/master-auth";
import { MasterPasswordResetGate, MasterEmailVerifyGate } from "@/components/master-gate";
import {
  sendMasterVerificationCodeAction,
  verifyMasterCodeAction,
  resetMasterPasswordAction,
} from "./gate-actions";

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getMasterSessionFromCookies();
  // No session — let the page handle it (e.g. login page renders freely)
  if (!token) return <>{children}</>;

  const session = await getMasterSessionData(token);
  if (!session) return <>{children}</>;


  // ENV root account bypasses all gates — it has no DB row
  if (session.isEnvRoot) {
    return <>{children}</>;
  }

  const userId = session.masterUserId!;
  const status = await getMasterVerificationStatus(userId);
  if (!status) redirect("/master/login");

  // Gate 1: force password reset first
  if (status.mustResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <MasterPasswordResetGate resetPassword={resetMasterPasswordAction} />
      </div>
    );
  }

  // Gate 2: email verification (one-time)
  if (!status.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <MasterEmailVerifyGate
          email={status.email}
          sendCode={sendMasterVerificationCodeAction}
          verifyCode={verifyMasterCodeAction}
        />
      </div>
    );
  }

  return <>{children}</>;
}
