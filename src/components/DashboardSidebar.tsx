"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Usuários", icon: "👥" },
  { href: "/admin/groups", label: "Grupos", icon: "📁" },
  { href: "/admin/cameras", label: "Câmeras", icon: "📷" },
  { href: "/admin/ai-monitoring", label: "Monitoramento IA", icon: "🤖" },
];

const userLinks = [
  { href: "/user/cameras", label: "Minhas Câmeras", icon: "📷" },
  { href: "/user/groups", label: "Meus Grupos", icon: "📁" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const links = role === "ADMIN" ? adminLinks : userLinks;
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(link: { href: string }) {
    if (link.href === "/admin") return pathname === "/admin";
    return pathname.startsWith(link.href);
  }

  function NavItems() {
    return (
      <>
        <div className="text-xl font-bold mb-6 md:mb-8">Camera Monitor</div>
        <nav className="space-y-2 flex-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 p-2 rounded hover:bg-gray-800 ${
                isActive(link) ? "bg-gray-800" : ""
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-gray-400 hover:text-white mt-auto pt-4"
        >
          🚪 Sair
        </button>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-900 text-white p-2 rounded-md"
        aria-label="Abrir menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white p-4 flex flex-col transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:min-h-screen`}
      >
        <div className="flex justify-between items-center mb-2 md:hidden">
          <span className="text-lg font-bold">Camera Monitor</span>
          <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white" aria-label="Fechar menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <NavItems />
      </aside>
    </>
  );
}
