import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock db.user.upsert
const mockUpsert = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

// Mock exchangeCodeForTokens
const mockExchangeCode = vi.fn();
vi.mock("@/lib/auth/cognito", () => ({
  exchangeCodeForTokens: (...args: unknown[]) => mockExchangeCode(...args),
}));

// Mock verifyIdToken
const mockVerifyIdToken = vi.fn();
vi.mock("@/lib/auth/verify", () => ({
  verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
}));

// Mock iron-session
const mockSessionSave = vi.fn();
const mockSession: Record<string, unknown> = {};
vi.mock("iron-session", () => ({
  getIronSession: vi.fn().mockImplementation(() => {
    // Return a proxy that captures sets and provides save()
    return new Proxy(mockSession, {
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
      get(target, prop) {
        if (prop === "save") return mockSessionSave;
        return target[prop as string];
      },
    });
  }),
}));

// Mock next/headers (cookies)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

// Mock session options
vi.mock("@/lib/auth/session", () => ({
  sessionOptions: {
    password: "test-secret-at-least-32-chars-long-for-iron-session",
    cookieName: "rf-session",
  },
}));

// Import the handler after all mocks are set up
import { GET } from "@/app/api/auth/callback/route";

describe("User upsert in auth callback", () => {
  const defaultTokens = {
    id_token: "test-id-token",
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
  };

  const defaultPayload = {
    sub: "user-sub-123",
    email: "user@example.com",
    "cognito:username": "Test User",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset session object
    Object.keys(mockSession).forEach((key) => delete mockSession[key]);
    // Default mock implementations
    mockExchangeCode.mockResolvedValue(defaultTokens);
    mockVerifyIdToken.mockResolvedValue(defaultPayload);
    mockSessionSave.mockResolvedValue(undefined);
    mockUpsert.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
    });
  });

  function createCallbackRequest(
    code = "test-code",
    state = "/projects"
  ): NextRequest {
    const url = `http://localhost:3000/api/auth/callback?code=${code}&state=${state}`;
    return new NextRequest(url);
  }

  it("calls db.user.upsert with correct email and name after login", async () => {
    const request = createCallbackRequest();
    await GET(request);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
      update: { name: "Test User" },
      create: {
        email: "user@example.com",
        name: "Test User",
      },
    });
  });

  it("login succeeds even when upsert throws", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("DB connection failed"));

    const request = createCallbackRequest();
    const response = await GET(request);

    // Should still redirect (302) to the return URL
    expect(response.status).toBe(307); // NextResponse.redirect uses 307
    expect(response.headers.get("location")).toContain("/projects");
  });

  it("upsert is called with email-as-name when cognito:username is not set", async () => {
    mockVerifyIdToken.mockResolvedValue({
      sub: "user-sub-456",
      email: "fallback@example.com",
      // No cognito:username — name falls back to email
    });

    const request = createCallbackRequest();
    await GET(request);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { email: "fallback@example.com" },
      update: { name: "fallback@example.com" },
      create: {
        email: "fallback@example.com",
        name: "fallback@example.com",
      },
    });
  });

  it("upsert occurs after session.save()", async () => {
    const callOrder: string[] = [];
    mockSessionSave.mockImplementation(() => {
      callOrder.push("session.save");
      return Promise.resolve();
    });
    mockUpsert.mockImplementation(() => {
      callOrder.push("user.upsert");
      return Promise.resolve({ id: "u1", email: "user@example.com", name: "Test User" });
    });

    const request = createCallbackRequest();
    await GET(request);

    expect(callOrder).toEqual(["session.save", "user.upsert"]);
  });
});
