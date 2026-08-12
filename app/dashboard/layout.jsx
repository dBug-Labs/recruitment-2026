import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/rbac";
import DashboardNav from "./_components/DashboardNav";

export const metadata = {
  title: "Your Dashboard",
  // Personal candidate data — never index, and don't follow links out of it.
  robots: { index: false, follow: false, nocache: true },
};

export default async function DashboardLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Staff belong in the admin panel, not the candidate view
  if (isStaff(session.user)) {
    redirect("/admin");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="portal">
      <DashboardNav user={session.user} signOutAction={signOutAction} />
      <main className="portalMain">
        <div className="wrap" style={{ maxWidth: 1000 }}>{children}</div>
      </main>
    </div>
  );
}
