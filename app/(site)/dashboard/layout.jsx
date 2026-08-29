import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db";
import { isStaff } from "@/lib/rbac";
import DashboardNav from "./_components/DashboardNav";
import WhatsAppPrompt from "./_components/WhatsAppPrompt";

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

  let showWhatsAppPrompt = false;

  if (session.user.applicationId && ObjectId.isValid(session.user.applicationId)) {
    const col = await getCollection("applications");
    const app = await col.findOne(
      { _id: new ObjectId(session.user.applicationId) },
      { projection: { whatsappNumber: 1 } }
    );
    if (app && !app.whatsappNumber) {
      showWhatsAppPrompt = true;
    }
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="portal">
      <DashboardNav user={session.user} signOutAction={signOutAction} />
      <main className="portalMain">
        <div className="wrap" style={{ maxWidth: 1000 }}>
          {children}
        </div>
      </main>
      {showWhatsAppPrompt && <WhatsAppPrompt />}
    </div>
  );
}
