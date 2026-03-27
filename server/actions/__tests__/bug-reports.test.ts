import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/navigation (getCurrentUser may call redirect)
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock auth
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock authorization
const mockIsAdmin = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

// Mock next/cache
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Mock db
const mockBugReportCreate = vi.fn();
const mockBugReportFindMany = vi.fn();
const mockBugReportUpdate = vi.fn();
const mockBugReportCount = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    bugReport: {
      create: (...args: unknown[]) => mockBugReportCreate(...args),
      findMany: (...args: unknown[]) => mockBugReportFindMany(...args),
      update: (...args: unknown[]) => mockBugReportUpdate(...args),
      count: (...args: unknown[]) => mockBugReportCount(...args),
    },
  },
}));

// Mock email
const mockSendBugReportEmail = vi.fn();
vi.mock("@/lib/email/bug-report-email", () => ({
  sendBugReportEmail: (...args: unknown[]) => mockSendBugReportEmail(...args),
}));

import {
  submitBugReport,
  getBugReports,
  updateBugReport,
  getOpenBugReportCount,
} from "../bug-reports";

describe("submitBugReport", () => {
  const validInput = {
    description: "The button is broken on the projects page",
    pageUrl: "/projects/abc123",
    browserMetadata:
      '{"userAgent":"Mozilla/5.0","viewport":{"width":1920,"height":1080}}',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Test User",
      groups: ["users"],
    });
    mockBugReportCreate.mockResolvedValue({
      id: "report-1",
      ...validInput,
      submitterEmail: "user@example.com",
      submitterName: "Test User",
      status: "open",
      createdAt: new Date("2026-03-26T12:00:00Z"),
    });
    mockSendBugReportEmail.mockResolvedValue(undefined);
  });

  it("calls getCurrentUser for auth check", async () => {
    await submitBugReport(validInput);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("saves report to database with correct fields", async () => {
    await submitBugReport(validInput);
    expect(mockBugReportCreate).toHaveBeenCalledWith({
      data: {
        description: "The button is broken on the projects page",
        pageUrl: "/projects/abc123",
        submitterEmail: "user@example.com",
        submitterName: "Test User",
        browserMetadata: expect.any(String),
        status: "open",
      },
    });
  });

  it("returns success true on valid input", async () => {
    const result = await submitBugReport(validInput);
    expect(result).toEqual({ success: true });
  });

  it("sends email after saving to DB", async () => {
    await submitBugReport(validInput);
    expect(mockSendBugReportEmail).toHaveBeenCalledTimes(1);
    expect(mockSendBugReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "The button is broken on the projects page",
        submitterEmail: "user@example.com",
      })
    );
  });

  it("returns success true even when email fails (fire-and-forget)", async () => {
    mockSendBugReportEmail.mockRejectedValueOnce(new Error("SES error"));
    const result = await submitBugReport(validInput);
    expect(result).toEqual({ success: true });
  });

  it("logs error when email fails with [BugReport] prefix", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSendBugReportEmail.mockRejectedValueOnce(new Error("SES error"));
    await submitBugReport(validInput);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[BugReport]"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("rejects description shorter than 10 characters", async () => {
    const result = await submitBugReport({
      ...validInput,
      description: "short",
    });
    expect(result).toEqual({
      success: false,
      error: "Description must be at least 10 characters",
    });
  });

  it("rejects empty description", async () => {
    const result = await submitBugReport({
      ...validInput,
      description: "",
    });
    expect(result).toEqual(
      expect.objectContaining({ success: false })
    );
  });

  it("does not save to DB when validation fails", async () => {
    await submitBugReport({ ...validInput, description: "short" });
    expect(mockBugReportCreate).not.toHaveBeenCalled();
  });
});

const mockReports = [
  {
    id: "report-1",
    description: "Button broken",
    pageUrl: "/projects",
    submitterEmail: "user@example.com",
    submitterName: "Test User",
    browserMetadata: '{"userAgent":"Mozilla/5.0"}',
    status: "open",
    adminNotes: null,
    createdAt: new Date("2026-03-27T12:00:00Z"),
    updatedAt: new Date("2026-03-27T12:00:00Z"),
  },
  {
    id: "report-2",
    description: "Page not loading",
    pageUrl: "/runs",
    submitterEmail: "other@example.com",
    submitterName: "Other User",
    browserMetadata: '{"userAgent":"Chrome"}',
    status: "resolved",
    adminNotes: "Fixed in v5.0",
    createdAt: new Date("2026-03-26T12:00:00Z"),
    updatedAt: new Date("2026-03-27T10:00:00Z"),
  },
];

describe("getBugReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      sub: "admin-123",
      email: "sean.mcinerney@merkle.com",
      name: "Admin User",
      groups: ["admins"],
    });
    mockIsAdmin.mockReturnValue(true);
    mockBugReportFindMany.mockResolvedValue(mockReports);
  });

  it("returns reports array from db.bugReport.findMany for admin user", async () => {
    const result = await getBugReports();
    expect(result).toEqual(mockReports);
  });

  it("calls findMany with orderBy createdAt desc", async () => {
    await getBugReports();
    expect(mockBugReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("filters by status when statusFilter is provided", async () => {
    mockBugReportFindMany.mockResolvedValue([mockReports[0]]);
    await getBugReports("open");
    expect(mockBugReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "open" },
      })
    );
  });

  it("does not include status where clause when no statusFilter is passed", async () => {
    await getBugReports();
    expect(mockBugReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      })
    );
  });

  it("returns empty array for non-admin user", async () => {
    mockIsAdmin.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Regular User",
      groups: ["users"],
    });
    const result = await getBugReports();
    expect(result).toEqual([]);
  });
});

describe("updateBugReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      sub: "admin-123",
      email: "sean.mcinerney@merkle.com",
      name: "Admin User",
      groups: ["admins"],
    });
    mockIsAdmin.mockReturnValue(true);
    mockBugReportUpdate.mockResolvedValue({ id: "report-1", status: "in-progress" });
  });

  it("calls db.bugReport.update with correct parameters for admin", async () => {
    await updateBugReport("report-1", { status: "in-progress", adminNotes: "Looking into it" });
    expect(mockBugReportUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: { status: "in-progress", adminNotes: "Looking into it" },
    });
  });

  it("returns success true for admin user", async () => {
    const result = await updateBugReport("report-1", { status: "resolved", adminNotes: null });
    expect(result).toEqual({ success: true });
  });

  it("calls revalidatePath for /bug-reports after successful update", async () => {
    await updateBugReport("report-1", { status: "closed", adminNotes: "Done" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/bug-reports");
  });

  it("returns unauthorized error for non-admin user", async () => {
    mockIsAdmin.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Regular User",
      groups: ["users"],
    });
    const result = await updateBugReport("report-1", { status: "closed", adminNotes: null });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("does not call db.bugReport.update for non-admin user", async () => {
    mockIsAdmin.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Regular User",
      groups: ["users"],
    });
    await updateBugReport("report-1", { status: "closed", adminNotes: null });
    expect(mockBugReportUpdate).not.toHaveBeenCalled();
  });
});

describe("getOpenBugReportCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      sub: "admin-123",
      email: "sean.mcinerney@merkle.com",
      name: "Admin User",
      groups: ["admins"],
    });
    mockIsAdmin.mockReturnValue(true);
    mockBugReportCount.mockResolvedValue(5);
  });

  it("calls db.bugReport.count with status open for admin", async () => {
    await getOpenBugReportCount();
    expect(mockBugReportCount).toHaveBeenCalledWith({ where: { status: "open" } });
  });

  it("returns the count number for admin user", async () => {
    const result = await getOpenBugReportCount();
    expect(result).toBe(5);
  });

  it("returns 0 for non-admin user", async () => {
    mockIsAdmin.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Regular User",
      groups: ["users"],
    });
    const result = await getOpenBugReportCount();
    expect(result).toBe(0);
  });

  it("does not call db.bugReport.count for non-admin user", async () => {
    mockIsAdmin.mockReturnValue(false);
    mockGetCurrentUser.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      name: "Regular User",
      groups: ["users"],
    });
    await getOpenBugReportCount();
    expect(mockBugReportCount).not.toHaveBeenCalled();
  });
});
