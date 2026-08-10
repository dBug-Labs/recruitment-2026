"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin",              label: "Overview"     },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/tasks",        label: "Tasks"        },
  { href: "/admin/submissions",  label: "Submissions"  },
  { href: "/admin/interviews",   label: "Interviews"   },
];

/**
 * @param {{ user: { name?: string, email?: string, role?: string },
 *           signOutAction: () => Promise<void> }} props
 */
export default function AdminNav({ user, signOutAction }) {
  const pathname = usePathname();

  const isActive = (href) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <nav className="portalNav admin">
      <div className="wrap inner">
        <Link href="/admin" className="portalBrand">
          <Image src="/logo.png" alt="dBug Labs" width={30} height={30} />
          <span>ADMIN PANEL</span>
        </Link>

        <div className="portalNavRight">
          <div className="portalLinks">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="portalUser">
            <div className="avatar">{initial}</div>
            <div>
              <div className="who">{user?.name ?? user?.email}</div>
              <div className="role">{(user?.role ?? "").replace("_", " ")}</div>
            </div>
          </div>

          <form action={signOutAction}>
            <button type="submit" className="btnQuiet">Sign Out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
