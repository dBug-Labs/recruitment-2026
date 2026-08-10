"use server";

import { AuthError } from "next-auth";
import { signIn, SCOPES } from "@/lib/auth";

/**
 * Admin portal sign-in.
 *
 * `signIn` signals success by throwing a redirect, so only AuthError is
 * treated as a failed login — everything else has to bubble up.
 */
export async function adminLoginAction(_prevState, formData) {
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!password) {
    return { error: "Password is required." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      scope: SCOPES.ADMIN,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Those admin credentials were not recognised." };
    }
    throw error;
  }

  return {};
}
