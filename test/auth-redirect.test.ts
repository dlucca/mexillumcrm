import { describe, it, expect } from "vitest";
import { authRedirectTarget } from "@/lib/supabase/auth-redirect";

describe("authRedirectTarget", () => {
  it("sends an unauthenticated user on a protected route to /login", () => {
    expect(authRedirectTarget("/companies", false)).toBe("/login");
  });

  it("lets an unauthenticated user stay on /login", () => {
    expect(authRedirectTarget("/login", false)).toBeNull();
  });

  it("sends an authenticated user away from /login to /my-actions", () => {
    expect(authRedirectTarget("/login", true)).toBe("/my-actions");
  });

  it("lets an authenticated user stay on a protected route", () => {
    expect(authRedirectTarget("/companies", true)).toBeNull();
  });

  it("sends an unauthenticated user on the root to /login", () => {
    expect(authRedirectTarget("/", false)).toBe("/login");
  });

  it("lets an authenticated user on the root through (page handles the redirect)", () => {
    expect(authRedirectTarget("/", true)).toBeNull();
  });
});
