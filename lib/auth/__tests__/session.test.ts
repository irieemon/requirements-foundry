import { describe, it, expect, vi } from "vitest";

// Mock server-only to prevent import errors in test environment
vi.mock("server-only", () => ({}));

// Mock next/headers since we're not in a Next.js context
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock iron-session
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

// Import after mocks are set up
const { sessionOptions } = await import("../session");

describe("sessionOptions", () => {
  it("has cookieName 'rf-session'", () => {
    expect(sessionOptions.cookieName).toBe("rf-session");
  });

  it("has httpOnly: true", () => {
    expect(sessionOptions.cookieOptions?.httpOnly).toBe(true);
  });

  it("has sameSite: 'lax'", () => {
    expect(sessionOptions.cookieOptions?.sameSite).toBe("lax");
  });

  it("has maxAge of 604800 (7 days)", () => {
    expect(sessionOptions.cookieOptions?.maxAge).toBe(604800);
  });

  it("has path '/'", () => {
    expect(sessionOptions.cookieOptions?.path).toBe("/");
  });
});
