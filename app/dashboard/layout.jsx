import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ROLES } from "@/lib/rbac";

export default async function DashboardLayout({ children }) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // If the user is an admin or domain lead, redirect them to the admin panel
  if (session.user.role === ROLES.ADMIN || session.user.role === ROLES.DOMAIN_LEAD) {
    redirect("/admin");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      {/* Top Nav */}
      <nav style={{ background: "rgba(14,8,17,.8)", borderBottom: "1px solid var(--line)", padding: "12px 24px", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text)" }}>
            <Image src="/logo.png" alt="dBug Labs" width={32} height={32} />
            <span className="cond" style={{ fontSize: 20, letterSpacing: 1 }}>dBug Labs Portal</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", gap: 16, fontSize: 15 }}>
              <Link href="/dashboard" style={{ color: "#cfc3d2" }}>Overview</Link>
              <Link href="/dashboard/tasks" style={{ color: "#cfc3d2" }}>My Tasks</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 24, borderLeft: "1px solid var(--line)" }}>
              {session.user.image ? (
                <img src={session.user.image} alt="" style={{ width: 32, height: 32, borderRadius: "50%" }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--purple-soft)" }} />
              )}
              <span style={{ fontSize: 14, color: "#a99bad" }}>{session.user.name ?? session.user.email}</span>
            </div>
            <form action={async () => {
              "use server";
              const { signOut } = await import("@/lib/auth");
              await signOut({ redirectTo: "/" });
            }}>
              <button type="submit" style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 12px", borderRadius: 6, fontSize: 13 }}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "40px 24px" }}>
        <div className="wrap" style={{ maxWidth: 1000 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
