"use server";

import { AuthError } from "next-auth";
import { signIn, SCOPES } from "@/lib/auth";

/**
 * Candidate portal sign-in.
 *
 * Always scoped to `candidate`, so submitting ADMIN_PASSWORD here can never
 * produce an admin session — the admin portal lives at /admin/login.
 */
export async function candidateLoginAction(_prevState, formData) {
  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return { error: "Enter your email or registration number and your password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      scope: SCOPES.CANDIDATE,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "We could not match those details to an application." };
    }
    throw error;
  }

  return {};
}
