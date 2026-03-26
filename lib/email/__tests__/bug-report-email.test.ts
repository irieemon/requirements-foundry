import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @aws-sdk/client-ses
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: vi.fn(),
}));

import {
  escapeHtml,
  buildEmailHtml,
  sendBugReportEmail,
  type BugReportEmailData,
} from "../bug-report-email";

describe("bug-report-email", () => {
  const sampleReport: BugReportEmailData = {
    description: "Button broken",
    pageUrl: "/projects/abc",
    submitterEmail: "user@example.com",
    submitterName: "Test User",
    browserMetadata:
      '{"userAgent":"Mozilla/5.0","viewport":{"width":1920,"height":1080}}',
    createdAt: new Date("2026-03-26T12:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUG_REPORT_ADMIN_EMAIL = "admin@example.com";
    process.env.SES_SENDER_EMAIL = "noreply@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    delete process.env.BUG_REPORT_ADMIN_EMAIL;
    delete process.env.SES_SENDER_EMAIL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe("escapeHtml", () => {
    it("escapes &, <, >, double quote, and single quote", () => {
      const input = '<script>alert("xss")</script>';
      const expected =
        "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;";
      expect(escapeHtml(input)).toBe(expected);
    });

    it("escapes ampersand", () => {
      expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
    });

    it("escapes single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#039;s");
    });
  });

  describe("buildEmailHtml", () => {
    it("contains submitter name", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("Test User");
    });

    it("contains submitter email", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("user@example.com");
    });

    it("contains page URL", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("/projects/abc");
    });

    it("contains description", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("Button broken");
    });

    it("contains viewport dimensions", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("1920x1080");
    });

    it("contains timestamp", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("2026-03-26T12:00:00.000Z");
    });

    it("contains dashboard link with /bug-reports", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("href=");
      expect(html).toContain("/bug-reports");
    });

    it("contains View in Dashboard text", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("View in Dashboard");
    });

    it("HTML-escapes XSS in description", () => {
      const xssReport: BugReportEmailData = {
        ...sampleReport,
        description: '<img src=x onerror=alert(1)>',
      };
      const html = buildEmailHtml(xssReport);
      expect(html).not.toContain("<img");
    });

    it("HTML-escapes special chars in submitter name", () => {
      const specialReport: BugReportEmailData = {
        ...sampleReport,
        submitterName: 'O\'Brien <admin>',
      };
      const html = buildEmailHtml(specialReport);
      expect(html).not.toContain("<admin>");
      expect(html).toContain("O&#039;Brien");
    });

    it("parses browserMetadata JSON to extract viewport", () => {
      const html = buildEmailHtml(sampleReport);
      expect(html).toContain("1920x1080");
    });
  });

  describe("sendBugReportEmail", () => {
    it("skips silently when BUG_REPORT_ADMIN_EMAIL is undefined", async () => {
      delete process.env.BUG_REPORT_ADMIN_EMAIL;
      await sendBugReportEmail(sampleReport);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("skips silently when SES_SENDER_EMAIL is undefined", async () => {
      delete process.env.SES_SENDER_EMAIL;
      await sendBugReportEmail(sampleReport);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("calls SESClient.send with correct parameters", async () => {
      const { SendEmailCommand } = await import("@aws-sdk/client-ses");
      mockSend.mockResolvedValueOnce({});
      await sendBugReportEmail(sampleReport);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: "noreply@example.com",
          Destination: {
            ToAddresses: ["admin@example.com"],
          },
        })
      );
    });
  });
});
