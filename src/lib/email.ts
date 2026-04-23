import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(opts: {
  to: string;
  cashierName: string;
  code: string;
}): Promise<void> {
  const { to, cashierName, code } = opts;

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: [to],
    subject: `Verify your email for ${cashierName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background-color:#0f172a;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${cashierName}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;">Verify Your Email Address</h2>
            <p style="margin:0 0 12px;color:#475569;line-height:1.6;">Hello,</p>
            <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
              You are verifying your email address for <strong>${cashierName}</strong>. Enter the code below inside the cashier to continue.
            </p>
            <!-- Code block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background-color:#f8fafc;border:2px solid #0f172a;border-radius:8px;padding:24px;text-align:center;">
                  <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#0f172a;font-family:monospace;">${code}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0 0 8px;color:#475569;line-height:1.6;">Your verified email will be used for important notifications such as:</p>
            <ul style="margin:0 0 24px;padding-left:20px;color:#475569;line-height:2;">
              <li>Deposit updates</li>
              <li>Payout updates</li>
              <li>Transaction status alerts</li>
            </ul>
            <p style="margin:0;color:#94a3b8;font-size:13px;">If you did not request this, please ignore this email.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:13px;">Thank you,<br /><strong>${cashierName} Team</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
