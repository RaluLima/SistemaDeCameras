import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-300">
      <DashboardSidebar />
      <main className="md:ml-64 p-4 sm:p-6 lg:p-8 pt-16 md:pt-8 min-h-screen transition-colors duration-200">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
