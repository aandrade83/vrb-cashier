import { Resend } from "resend";

type Params = {
  playerEmail: string;
  playerFirstName: string | null;
  referenceCode: string;
  type: "deposit" | "payout";
  amount: string;
  currency: string;
  newStatus: string;
  noteToPlayer: string;
  appUrl: string;
};

export async function sendStatusUpdateEmail(
  params: Params
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const {
      playerEmail,
      playerFirstName,
      referenceCode,
      type,
      amount,
      currency,
      newStatus,
      noteToPlayer,
      appUrl,
    } = params;

    const greeting = playerFirstName ? `Hello ${playerFirstName},` : "Hello,";
    const typeLabel = type === "deposit" ? "Deposit" : "Payout";
    const statusLabel = newStatus.replace("_", " ");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7">

        <!-- Header -->
        <tr><td style="background:#09090b;padding:24px 32px">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700">VRB Cashier</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;color:#09090b;font-size:16px">${greeting}</p>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px">
            Your <strong>${typeLabel}</strong> request <strong>${referenceCode}</strong>
            for <strong>${currency} ${amount}</strong> has been updated.
          </p>

          <!-- Status badge -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td style="background:#f4f4f5;border-radius:6px;padding:8px 16px">
              <span style="font-size:13px;color:#52525b;text-transform:uppercase;letter-spacing:0.05em">Status</span>
              <span style="margin-left:12px;font-size:14px;font-weight:600;color:#09090b;text-transform:capitalize">${statusLabel}</span>
            </td></tr>
          </table>

          <!-- Message from clerk -->
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:0.05em">Message from our cashier team</p>
          <div style="background:#f4f4f5;border-left:3px solid #09090b;border-radius:4px;padding:12px 16px;margin-bottom:24px">
            <p style="margin:0;color:#09090b;font-size:15px;line-height:1.6">${noteToPlayer.replace(/\n/g, "<br>")}</p>
          </div>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#09090b;border-radius:6px">
              <a href="${appUrl}/player/transactions"
                 style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">
                View Transaction →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f4f4f5;padding:16px 32px;border-top:1px solid #e4e4e7">
          <p style="margin:0;color:#a1a1aa;font-size:12px">
            This is an automated notification from VRB Cashier. Do not reply to this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "cashier@vrb.com",
      to: playerEmail,
      subject: `Your ${typeLabel} request ${referenceCode} has been ${statusLabel}`,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}
