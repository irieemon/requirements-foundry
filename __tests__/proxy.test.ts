import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock iron-session before importing proxy
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

// Mock auth modules
vi.mock("@/lib/auth/cognito", () => ({
  refreshTokens: vi.fn(),
}));
vi.mock("@/lib/auth/verify", () => ({
  verifyIdToken: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  sessionOptions: {
    password: "test-secret-at-least-32-characters-long",
    cookieName: "rf-session",
  },
}));

import { getIronSession } from "iron-session";
import { refreshTokens } from "@/lib/auth/cognito";
import { verifyIdToken } from "@/lib/auth/verify";
import { proxy } from "@/proxy";

const mockedGetIronSession = vi.mocked(getIronSession);
const mockedRefreshTokens = vi.mocked(refreshTokens);
const mockedVerifyIdToken = vi.mocked(verifyIdToken);

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function mockSession(data: Record<string, unknown> = {}) {
  const session = { save: vi.fn(), destroy: vi.fn(), ...data };
  mockedGetIronSession.mockResolvedValue(session as never);
  return session;
}

const NOW_EPOCH = 1700000000; // fixed timestamp for tests

describe("proxy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_EPOCH * 1000);
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.SESSION_SECRET;
  });

  describe("public routes pass through without auth check", () => {
    it("passes through / (landing page)", async () => {
      const response = await proxy(makeRequest("/"));
      expect(response.status).not.toBe(307);
      // getIronSession should not be called for public routes
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /api/health", async () => {
      const response = await proxy(makeRequest("/api/health"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /api/cron/recover-stale-runs", async () => {
      const response = await proxy(makeRequest("/api/cron/recover-stale-runs"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /_next/static/chunk.js", async () => {
      const response = await proxy(makeRequest("/_next/static/chunk.js"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /favicon.ico", async () => {
      const response = await proxy(makeRequest("/favicon.ico"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /api/auth/callback", async () => {
      const response = await proxy(makeRequest("/api/auth/callback?code=abc"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });

    it("passes through /api/auth/logout", async () => {
      const response = await proxy(makeRequest("/api/auth/logout"));
      expect(response.status).not.toBe(307);
      expect(mockedGetIronSession).not.toHaveBeenCalled();
    });
  });

  describe("unauthenticated requests redirect to / with returnTo", () => {
    it("redirects /projects to /?returnTo=/projects", async () => {
      mockSession({}); // no user
      const response = await proxy(makeRequest("/projects"));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("returnTo")).toBe("/projects");
    });

    it("redirects /projects/abc-123 to /?returnTo=/projects/abc-123", async () => {
      mockSession({}); // no user
      const response = await proxy(makeRequest("/projects/abc-123"));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/");
      expect(location.searchParams.get("returnTo")).toBe("/projects/abc-123");
    });
  });

  describe("authenticated requests pass through", () => {
    it("passes through with valid non-expired session", async () => {
      mockSession({
        user: { sub: "user-1", email: "a@b.com", name: "A", groups: [] },
        expiresAt: NOW_EPOCH + 3600, // 1 hour from now
        refreshToken: "rt-123",
      });
      const response = await proxy(makeRequest("/projects"));
      expect(response.status).not.toBe(307);
    });
  });

  describe("near-expiry token triggers transparent refresh", () => {
    it("refreshes token when session expires within 5 minutes", async () => {
      const session = mockSession({
        user: { sub: "user-1", email: "a@b.com", name: "A", groups: [] },
        expiresAt: NOW_EPOCH + 200, // 200 seconds = within 5 min threshold
        refreshToken: "rt-123",
      });

      mockedRefreshTokens.mockResolvedValue({
        id_token: "new-id-token",
        access_token: "new-access-token",
        expires_in: 3600,
      });
      mockedVerifyIdToken.mockResolvedValue({
        sub: "user-1",
        email: "a@b.com",
        "cognito:username": "A",
        "custom:groups": '["admin"]',
      } as never);

      const response = await proxy(makeRequest("/projects"));
      expect(mockedRefreshTokens).toHaveBeenCalledWith("rt-123");
      expect(session.save).toHaveBeenCalled();
      expect(response.status).not.toBe(307);
    });
  });

  describe("failed token refresh redirects to /", () => {
    it("redirects when refreshTokens throws", async () => {
      const session = mockSession({
        user: { sub: "user-1", email: "a@b.com", name: "A", groups: [] },
        expiresAt: NOW_EPOCH + 200, // near-expiry
        refreshToken: "rt-123",
      });

      mockedRefreshTokens.mockRejectedValue(new Error("token revoked"));

      const response = await proxy(makeRequest("/projects"));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/");
    });
  });

  describe("expired session with no refresh token redirects", () => {
    it("redirects to / when no refresh token available", async () => {
      mockSession({
        user: { sub: "user-1", email: "a@b.com", name: "A", groups: [] },
        expiresAt: NOW_EPOCH - 100, // already expired
        // no refreshToken
      });

      const response = await proxy(makeRequest("/projects"));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/");
    });
  });
});
