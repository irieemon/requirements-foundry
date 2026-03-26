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

// Mock db
const mockBugReportCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    bugReport: {
      create: (...args: unknown[]) => mockBugReportCreate(...args),
    },
  },
}));

// Mock email
const mockSendBugReportEmail = vi.fn();
vi.mock("@/lib/email/bug-report-email", () => ({
  sendBugReportEmail: (...args: unknown[]) => mockSendBugReportEmail(...args),
}));

import { submitBugReport } from "../bug-reports";

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
