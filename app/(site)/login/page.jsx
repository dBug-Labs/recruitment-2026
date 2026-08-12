import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { candidateLoginAction } from "./actions";
import CandidateLoginForm from "./LoginForm";

export const metadata = {
  title: "Candidate Login",
  description:
    "Sign in to your dBug Labs candidate dashboard to track your application, task deadline, " +
    "interview slot and result.",
  alternates: { canonical: "/login" },
  // Indexable so "dBug Labs login" finds it, but there is nothing here worth
  // previewing as a snippet beyond the description above.
  robots: { index: true, follow: true, nocache: true },
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(isStaff(session.user) ? "/admin" : "/dashboard");
  }

  return (
    <main className="authWrap">
      <div className="formCard authCard" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🕷</div>
        <h1 className="cardTitle" style={{ fontSize: 23, margin: "0 0 10px", color: "var(--pink)" }}>
          CANDIDATE PORTAL
        </h1>
        <p className="lede">
          Sign in with your SRM email, personal email or registration number,
          plus the password we mailed you when your application was received.
        </p>

        <CandidateLoginForm action={candidateLoginAction} />

        {/* Candidate-facing only — the admin portal is never advertised here. */}
        <div style={{ marginTop: 22, fontSize: 13.5, color: "#8d8091", lineHeight: 1.7 }}>
          Not applied yet?{" "}
          <Link href="/apply" style={{ color: "var(--purple-soft)" }}>
            Fill the application form →
          </Link>
        </div>
      </div>
    </main>
  );
}
