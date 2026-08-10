import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { candidateLoginAction } from "./actions";
import CandidateLoginForm from "./LoginForm";

export const metadata = {
  title: "Candidate Login | dBug Labs",
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

        <div style={{ marginTop: 22, fontSize: 13.5, color: "#8d8091", lineHeight: 1.7 }}>
          Not applied yet?{" "}
          <Link href="/apply" style={{ color: "var(--purple-soft)" }}>
            Fill the application form →
          </Link>
          <br />
          <Link href="/admin/login" style={{ color: "#6f6474" }}>
            Core team login
          </Link>
        </div>
      </div>
    </main>
  );
}
