"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { sendBugReportEmail } from "@/lib/email/bug-report-email";
import { revalidatePath } from "next/cache";

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

export async function getBugReports(statusFilter?: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    return [];
  }
  return db.bugReport.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateBugReport(
  reportId: string,
  data: { status: string; adminNotes: string | null }
) {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    return { success: false as const, error: "Unauthorized" };
  }
  await db.bugReport.update({
    where: { id: reportId },
    data: { status: data.status, adminNotes: data.adminNotes },
  });
  revalidatePath("/bug-reports");
  return { success: true as const };
}

export async function getOpenBugReportCount() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    return 0;
  }
  return db.bugReport.count({ where: { status: "open" } });
}
