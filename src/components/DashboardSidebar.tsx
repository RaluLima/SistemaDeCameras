"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/users", label: "Usuários", icon: "👥" },
  { href: "/admin/groups", label: "Grupos", icon: "📁" },
  { href: "/admin/cameras", label: "Câmeras", icon: "📷" },
  { href: "/admin/recordings", label: "Gravações", icon: "🎬" },
  { href: "/admin/ai-monitoring", label: "Monitoramento IA", icon: "🤖" },
  { href: "/admin/fall-detection", label: "Detecção de Quedas", icon: "⚠️" },
];

const userLinks = [
  { href: "/user/cameras", label: "Minhas Câmeras", icon: "📷" },
  { href: "/user/recordings", label: "Minhas Gravações", icon: "🎬" },
  { href: "/user/groups", label: "Meus Grupos", icon: "📁" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const role = (session?.user as any)?.role;
  const plan = (session?.user as any)?.plan;
  const isPaying = role === "ADMIN" || plan === "PAID";
  const links = role === "ADMIN" ? adminLinks : userLinks;
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  function NavItems() {
    return (
      <>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-gray-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            CM
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Camera Monitor</div>
            <div className="text-xs text-gray-400">
              {role === "ADMIN" ? "Administrador" : isPaying ? "Usuário · Plano Pagante" : "Usuário · Plano Gratuito"}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(link.href)
                  ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-500"
                  : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-gray-700/50 space-y-2">
          <button
            onClick={toggle}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            {theme === "dark" ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-200 p-2.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-200 transition-all"
        aria-label="Abrir menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:fixed inset-y-0 left-0 z-50 w-64 bg-dark-100 flex flex-col transform transition-all duration-300 ease-out ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } md:translate-x-0 md:shadow-none`}
      >
        <NavItems />
      </aside>
    </>
  );
}
