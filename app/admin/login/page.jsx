import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { adminLoginAction } from "./actions";
import AdminLoginForm from "./LoginForm";

export const metadata = {
  title: "Admin Login | dBug Labs",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await auth();
  if (isStaff(session?.user)) {
    redirect("/admin");
  }

  return (
    <main className="authWrap">
      <div className="formCard authCard" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🕷</div>
        <h1 className="cardTitle" style={{ fontSize: 23, margin: "0 0 10px", color: "var(--red)" }}>
          ADMIN PANEL
        </h1>
        <p className="lede">
          Restricted access — core team and domain leads only.
        </p>

        <AdminLoginForm action={adminLoginAction} />

        <div style={{ marginTop: 22, fontSize: 13.5, color: "#8d8091" }}>
          Candidate?{" "}
          <Link href="/login" style={{ color: "var(--purple-soft)" }}>
            Sign in to your dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
