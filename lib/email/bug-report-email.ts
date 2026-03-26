import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export interface BugReportEmailData {
  description: string;
  pageUrl: string;
  submitterEmail: string;
  submitterName: string;
  browserMetadata: string;
  createdAt: Date;
}

let _ses: SESClient | null = null;
function getSesClient(): SESClient {
  if (!_ses) {
    _ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });
  }
  return _ses;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseViewport(browserMetadata: string): string {
  try {
    const meta = JSON.parse(browserMetadata);
    if (meta.viewport?.width && meta.viewport?.height) {
      return `${meta.viewport.width}x${meta.viewport.height}`;
    }
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

export function buildEmailHtml(report: BugReportEmailData): string {
  const name = escapeHtml(report.submitterName);
  const email = escapeHtml(report.submitterEmail);
  const pageUrl = escapeHtml(report.pageUrl);
  const description = escapeHtml(report.description);
  const viewport = parseViewport(report.browserMetadata);
  const timestamp = report.createdAt.toISOString();
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/bug-reports`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bug Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#dc2626;padding:20px 24px;">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Bug Report</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px;">
              <!-- Submitter Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="color:#71717a;font-size:13px;padding-bottom:4px;">Submitted by</td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#18181b;font-weight:500;">${name} (${email})</td>
                </tr>
              </table>
              <!-- Page URL -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="color:#71717a;font-size:13px;padding-bottom:4px;">Page URL</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#18181b;">${pageUrl}</td>
                </tr>
              </table>
              <!-- Description -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="color:#71717a;font-size:13px;padding-bottom:4px;">Description</td>
                </tr>
                <tr>
                  <td style="background-color:#f4f4f5;border-radius:6px;padding:12px;font-size:14px;color:#18181b;line-height:1.5;">${description}</td>
                </tr>
              </table>
              <!-- Metadata -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="color:#71717a;font-size:13px;padding-bottom:4px;">Browser Viewport</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#18181b;">${viewport}</td>
                </tr>
              </table>
              <!-- Timestamp -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="color:#71717a;font-size:13px;padding-bottom:4px;">Reported at</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#18181b;">${timestamp}</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;">View in Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendBugReportEmail(
  report: BugReportEmailData
): Promise<void> {
  const adminEmail = process.env.BUG_REPORT_ADMIN_EMAIL;
  const senderEmail = process.env.SES_SENDER_EMAIL;

  if (!adminEmail || !senderEmail) {
    console.warn("[BugReport] Email config missing, skipping notification");
    return;
  }

  const command = new SendEmailCommand({
    Source: senderEmail,
    Destination: {
      ToAddresses: [adminEmail],
    },
    Message: {
      Subject: {
        Data: `Bug Report: ${report.pageUrl}`,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: buildEmailHtml(report),
          Charset: "UTF-8",
        },
      },
    },
  });

  await getSesClient().send(command);
}
