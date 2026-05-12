import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AuthGuard } from "@/components/AuthGuard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
