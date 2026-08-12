"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, SCOPES } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Admin portal sign-in — password only, no email.
 *
 * The password is the whole credential, so it is also the whole identity: it
 * either matches ADMIN_PASSWORD or one staff account's hash (see
 * authorizeStaff in lib/auth.js). That makes brute force the obvious attack,
 * hence the per-IP throttle before anything touches the database.
 *
 * `signIn` signals success by throwing a redirect, so only AuthError is
 * treated as a failed login — everything else has to bubble up.
 */
export async function adminLoginAction(_prevState, formData) {
  const password = formData.get("password")?.toString() ?? "";

  if (!password) {
    return { error: "Password is required." };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "unknown";

  const rate = await checkRateLimit(`admin-login:${ip}`, { limit: 8, windowSeconds: 600 });
  if (!rate.allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  try {
    await signIn("credentials", {
      password,
      scope: SCOPES.ADMIN,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That password was not recognised." };
    }
    throw error;
  }

  return {};
}
