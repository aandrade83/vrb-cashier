import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNewTransactionEmail(opts: {
  to: string[];
  cashierName: string;
  referenceCode: string;
  type: "deposit" | "payout";
  playerName: string;
  playerEmail: string | null;
  methodName: string;
  amount: string;
  currency: string;
}): Promise<void> {
  if (opts.to.length === 0) return;
  const { cashierName, referenceCode, type, playerName, playerEmail, methodName, amount, currency } = opts;
  const typeLabel = type === "deposit" ? "Deposit" : "Payout";
  const typeColor = type === "deposit" ? "#16a34a" : "#ea580c";

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: opts.to,
    subject: `New ${typeLabel} – ${referenceCode} | ${cashierName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0f172a;padding:24px 32px;border-radius:8px 8px 0 0;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${cashierName}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 4px;color:#0f172a;font-size:20px;">New Transaction Received</h2>
            <p style="margin:0 0 24px;color:#64748b;font-size:13px;">A player has submitted a new transaction that requires processing.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;width:40%;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reference</span>
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;font-family:monospace;font-weight:bold;">${referenceCode}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Type</span>
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:${typeColor};font-size:14px;font-weight:bold;">${typeLabel}</span>
                </td>
              </tr>
              <tr style="background-color:#f8fafc;">
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Player</span>
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;">${playerName}</span>
                  ${playerEmail ? `<br/><span style="color:#64748b;font-size:12px;">${playerEmail}</span>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Method</span>
                </td>
                <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;">${methodName}</span>
                </td>
              </tr>
              <tr style="background-color:#f8fafc;">
                <td style="padding:10px 16px;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Amount</span>
                </td>
                <td style="padding:10px 16px;">
                  <span style="color:#0f172a;font-size:14px;font-weight:bold;">${currency} ${amount}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#94a3b8;font-size:13px;">Log in to the master panel to process this transaction.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:13px;"><strong>${cashierName}</strong> — Transaction Alert</p>
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

export async function sendTransactionStatusUpdateEmail(opts: {
  to: string[];
  cashierName: string;
  referenceCode: string;
  transactionType: "deposit" | "payout";
  newStatusLabel: string;
  noteToPlayer: string | null;
}): Promise<void> {
  if (opts.to.length === 0) return;
  const { cashierName, referenceCode, transactionType, newStatusLabel, noteToPlayer } = opts;
  const typeLabel = transactionType === "deposit" ? "Deposit" : "Payout";

  const statusColors: Record<string, string> = {
    "Pre-Confirmed": "#2563eb",
    "Post-Confirmed": "#7c3aed",
    "Completed": "#16a34a",
    "Denied": "#dc2626",
    "Pending": "#d97706",
  };
  const statusColor = statusColors[newStatusLabel] ?? "#475569";

  for (const address of opts.to) {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [address],
      subject: `${typeLabel} ${referenceCode} — Status Updated to ${newStatusLabel}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0f172a;padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${cashierName}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;">Transaction Update</h2>
            <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.6;">
              There has been a status update on the following transaction.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;width:40%;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Reference</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;font-family:monospace;font-weight:bold;">${referenceCode}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Type</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;">${typeLabel}</span>
                </td>
              </tr>
              <tr style="background-color:#f8fafc;">
                <td style="padding:12px 16px${noteToPlayer ? ";border-bottom:1px solid #e2e8f0" : ""};">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">New Status</span>
                </td>
                <td style="padding:12px 16px${noteToPlayer ? ";border-bottom:1px solid #e2e8f0" : ""};">
                  <span style="color:${statusColor};font-size:14px;font-weight:bold;">${newStatusLabel}</span>
                </td>
              </tr>
              ${noteToPlayer ? `
              <tr>
                <td style="padding:12px 16px;vertical-align:top;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Message</span>
                </td>
                <td style="padding:12px 16px;">
                  <span style="color:#0f172a;font-size:14px;line-height:1.6;">${noteToPlayer}</span>
                </td>
              </tr>` : ""}
            </table>

            <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
              If you have any questions regarding this update, please contact support.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:13px;"><strong>${cashierName}</strong> — Transaction Notification</p>
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
}

export async function sendTransactionReceivedEmail(opts: {
  to: string;
  cashierName: string;
  referenceCode: string;
  type: "deposit" | "payout";
  playerName: string;
  methodName: string;
  amount: string;
  currency: string;
}): Promise<void> {
  const { cashierName, referenceCode, type, playerName, methodName, amount, currency } = opts;
  const typeLabel = type === "deposit" ? "Deposit" : "Payout";
  const typeColor = type === "deposit" ? "#16a34a" : "#ea580c";
  const greeting = playerName ? `Hello, ${playerName}` : "Hello";

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: [opts.to],
    subject: `${typeLabel} Request Received – ${referenceCode}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0f172a;padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">${cashierName}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">${greeting},</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
              Your <strong style="color:${typeColor};">${typeLabel}</strong> request has been successfully received by our system.
              Our team will review it promptly and keep you informed of any updates through this channel.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="background-color:#f8fafc;">
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;width:40%;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Reference</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;font-family:monospace;font-weight:bold;">${referenceCode}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Type</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:${typeColor};font-size:14px;font-weight:bold;">${typeLabel}</span>
                </td>
              </tr>
              <tr style="background-color:#f8fafc;">
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Method</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="color:#0f172a;font-size:14px;">${methodName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;">
                  <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Amount</span>
                </td>
                <td style="padding:12px 16px;">
                  <span style="color:#0f172a;font-size:15px;font-weight:bold;">${currency} ${amount}</span>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;color:#15803d;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">What happens next?</p>
                  <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">
                    Our team will process your request and send you a status update to this email address. There is nothing further you need to do at this time.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
              If you did not submit this request or have any questions, please contact support immediately.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;padding:20px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:13px;">Thank you for choosing <strong>${cashierName}</strong>.</p>
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
