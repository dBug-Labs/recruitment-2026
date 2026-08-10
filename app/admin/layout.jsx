import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ROLES } from "@/lib/rbac";

export default async function AdminLayout({ children }) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Only Admin or Domain Lead can access
  if (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.DOMAIN_LEAD) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      {/* Admin Nav */}
      <nav style={{ background: "rgba(255,45,79,.1)", borderBottom: "1px solid rgba(255,45,79,.2)", padding: "12px 24px", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--red)" }}>
            <Image src="/logo.png" alt="dBug Labs" width={32} height={32} />
            <span className="cond" style={{ fontSize: 20, letterSpacing: 1 }}>ADMIN PANEL</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 15 }}>
              <Link href="/admin" style={{ color: "var(--red-soft)" }}>Applications</Link>
              <Link href="/admin/tasks" style={{ color: "var(--red-soft)" }}>Tasks</Link>
              <Link href="/admin/interviews" style={{ color: "var(--red-soft)" }}>Interviews</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 24, borderLeft: "1px solid rgba(255,45,79,.2)" }}>
              {session.user.image ? (
                <img src={session.user.image} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--red)" }} />
              )}
              <span style={{ fontSize: 14, color: "var(--red-soft)" }}>{session.user.name ?? session.user.email} ({session.user.role})</span>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "40px 24px" }}>
        <div className="wrap">
          {children}
        </div>
      </main>
    </div>
  );
}
