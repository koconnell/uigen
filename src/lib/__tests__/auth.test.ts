// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(
  payload: Record<string, unknown>,
  expiresIn: string | number = "7d"
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(TEST_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookies.set).toHaveBeenCalledOnce();
    const [name, , options] = mockCookies.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("embeds userId and email in the JWT", async () => {
    await createSession("user-1", "test@example.com");

    const token = mockCookies.set.mock.calls[0][1];
    const { payload } = await jwtVerify(token, TEST_SECRET);
    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });

  test("sets secure: false outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookies.set.mock.calls[0];
    expect(options.secure).toBe(false);
    vi.unstubAllEnvs();
  });

  test("sets secure: true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-1", "test@example.com");
    const [, , options] = mockCookies.set.mock.calls[0];
    expect(options.secure).toBe(true);
    vi.unstubAllEnvs();
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookies.set.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs);
  });

  test("JWT expires approximately 7 days from now", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "test@example.com");
    const after = Math.ceil(Date.now() / 1000);

    const token = mockCookies.set.mock.calls[0][1];
    const { payload } = await jwtVerify(token, TEST_SECRET);
    const sevenDaysSec = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysSec);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDaysSec);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookies.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const token = await makeToken({ userId: "user-1", email: "test@example.com" });
    mockCookies.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for a malformed token", async () => {
    mockCookies.get.mockReturnValue({ value: "not-a-jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user-1", email: "test@example.com" },
      Math.floor(Date.now() / 1000) - 1
    );
    mockCookies.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookies.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  function makeRequest(cookie?: string) {
    return new NextRequest("http://localhost/", {
      headers: cookie ? { Cookie: cookie } : {},
    });
  }

  test("returns null when request has no auth-token cookie", async () => {
    expect(await verifySession(makeRequest())).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({ userId: "user-2", email: "other@example.com" });
    const session = await verifySession(makeRequest(`auth-token=${token}`));
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("other@example.com");
  });

  test("returns null for an invalid token", async () => {
    expect(await verifySession(makeRequest("auth-token=garbage"))).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user-1", email: "test@example.com" },
      Math.floor(Date.now() / 1000) - 1
    );
    expect(await verifySession(makeRequest(`auth-token=${token}`))).toBeNull();
  });
});
