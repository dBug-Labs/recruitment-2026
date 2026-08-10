import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isStaff } from "@/lib/rbac";
import AdminNav from "../_components/AdminNav";

export const metadata = {
  title: "Admin Panel | dBug Labs",
};

/**
 * Guards every /admin route except /admin/login, which sits outside this
 * route group on purpose — wrapping it here would bounce signed-out users
 * back to the login page they are already on.
 */
export default async function AdminPanelLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (!isStaff(session.user)) {
    redirect("/dashboard");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="portal">
      <AdminNav user={session.user} signOutAction={signOutAction} />
      <main className="portalMain">
        <div className="wrap">{children}</div>
      </main>
    </div>
  );
}
