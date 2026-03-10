import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  exchangeCodeForTokens,
  refreshTokens,
} from "../cognito";

const TEST_ENV = {
  COGNITO_DOMAIN: "myapp.auth.us-east-1.amazoncognito.com",
  COGNITO_CLIENT_ID: "test-client-id-123",
  COGNITO_REDIRECT_URI: "https://app.example.com/api/auth/callback",
  COGNITO_CLIENT_SECRET: "test-client-secret-456",
};

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    Object.assign(process.env, TEST_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(TEST_ENV)) {
      delete process.env[key];
    }
  });

  it("returns URL starting with https://{COGNITO_DOMAIN}/oauth2/authorize", () => {
    const url = buildAuthorizeUrl();
    expect(url).toMatch(
      /^https:\/\/myapp\.auth\.us-east-1\.amazoncognito\.com\/oauth2\/authorize/
    );
  });

  it("includes response_type=code", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("includes correct client_id", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("client_id")).toBe("test-client-id-123");
  });

  it("includes correct redirect_uri", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/callback"
    );
  });

  it("includes scope=openid profile email", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("scope")).toBe("openid profile email");
  });

  it("includes identity_provider=Okta", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("identity_provider")).toBe("Okta");
  });

  it("encodes return path in state parameter", () => {
    const url = new URL(buildAuthorizeUrl("/projects/123"));
    expect(url.searchParams.get("state")).toBe("/projects/123");
  });

  it("defaults state to '/' when no returnTo provided", () => {
    const url = new URL(buildAuthorizeUrl());
    expect(url.searchParams.get("state")).toBe("/");
  });
});

describe("buildLogoutUrl", () => {
  beforeEach(() => {
    Object.assign(process.env, TEST_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(TEST_ENV)) {
      delete process.env[key];
    }
  });

  it("returns URL starting with https://{COGNITO_DOMAIN}/logout", () => {
    const url = buildLogoutUrl();
    expect(url).toMatch(
      /^https:\/\/myapp\.auth\.us-east-1\.amazoncognito\.com\/logout/
    );
  });

  it("includes correct client_id", () => {
    const url = new URL(buildLogoutUrl());
    expect(url.searchParams.get("client_id")).toBe("test-client-id-123");
  });

  it("includes logout_uri pointing to app root", () => {
    const url = new URL(buildLogoutUrl());
    expect(url.searchParams.get("logout_uri")).toBe("https://app.example.com/");
  });
});

describe("exchangeCodeForTokens", () => {
  beforeEach(() => {
    Object.assign(process.env, TEST_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(TEST_ENV)) {
      delete process.env[key];
    }
    vi.restoreAllMocks();
  });

  it("sends POST to Cognito token endpoint", async () => {
    const mockResponse = {
      id_token: "mock-id-token",
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await exchangeCodeForTokens("test-auth-code");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://myapp.auth.us-east-1.amazoncognito.com/oauth2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
  });

  it("sends correct body parameters", async () => {
    const mockResponse = {
      id_token: "mock-id-token",
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await exchangeCodeForTokens("test-auth-code");

    const call = fetchSpy.mock.calls[0];
    const body = new URLSearchParams(call[1]?.body as string);

    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("test-auth-code");
    expect(body.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/callback"
    );
    expect(body.get("client_id")).toBe("test-client-id-123");
    expect(body.get("client_secret")).toBe("test-client-secret-456");
  });

  it("returns parsed JSON with tokens", async () => {
    const mockResponse = {
      id_token: "mock-id-token",
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await exchangeCodeForTokens("test-auth-code");

    expect(result).toEqual({
      id_token: "mock-id-token",
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    });
  });
});

describe("refreshTokens", () => {
  beforeEach(() => {
    Object.assign(process.env, TEST_ENV);
  });

  afterEach(() => {
    for (const key of Object.keys(TEST_ENV)) {
      delete process.env[key];
    }
    vi.restoreAllMocks();
  });

  it("sends POST with grant_type=refresh_token", async () => {
    const mockResponse = {
      id_token: "new-id-token",
      access_token: "new-access-token",
      expires_in: 3600,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await refreshTokens("mock-refresh-token");

    const call = fetchSpy.mock.calls[0];
    const body = new URLSearchParams(call[1]?.body as string);

    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("mock-refresh-token");
    expect(body.get("client_id")).toBe("test-client-id-123");
    expect(body.get("client_secret")).toBe("test-client-secret-456");
  });

  it("returns parsed JSON with new tokens", async () => {
    const mockResponse = {
      id_token: "new-id-token",
      access_token: "new-access-token",
      expires_in: 3600,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await refreshTokens("mock-refresh-token");

    expect(result).toEqual({
      id_token: "new-id-token",
      access_token: "new-access-token",
      expires_in: 3600,
    });
  });
});
