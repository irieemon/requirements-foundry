"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendBugReportEmail } from "@/lib/email/bug-report-email";

export async function submitBugReport(data: {
  description: string;
  pageUrl: string;
  browserMetadata: string;
}) {
  const user = await getCurrentUser();

  if (!data.description || data.description.trim().length < 10) {
    return {
      success: false as const,
      error: "Description must be at least 10 characters",
    };
  }

  const report = await db.bugReport.create({
    data: {
      description: data.description.trim(),
      pageUrl: data.pageUrl,
      submitterEmail: user.email,
      submitterName: user.name,
      browserMetadata: data.browserMetadata,
      status: "open",
    },
  });

  try {
    await sendBugReportEmail(report);
  } catch (error) {
    console.error("[BugReport] Email notification failed:", error);
  }

  return { success: true as const };
}
