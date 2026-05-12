"use client";
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

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 hidden md:block">
      <div className="text-xl font-bold mb-8">Camera Monitor</div>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 p-2 rounded hover:bg-gray-800 ${
              pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href))
                ? "bg-gray-800"
                : ""
            }`}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-4 left-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          🚪 Sair
        </button>
      </div>
    </aside>
  );
}
