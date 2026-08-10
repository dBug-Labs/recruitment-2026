"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard",       label: "Overview" },
  { href: "/dashboard/tasks", label: "My Tasks" },
];

export default function DashboardNav({ user, signOutAction }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <nav className="portalNav">
      <div className="wrap inner">
        <Link href="/dashboard" className="portalBrand">
          <Image src="/logo.png" alt="dBug Labs" width={30} height={30} />
          <span>dBug Labs Portal</span>
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
            <div className="who">{user?.name ?? user?.email}</div>
          </div>

          <form action={signOutAction}>
            <button type="submit" className="btnQuiet">Sign Out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
