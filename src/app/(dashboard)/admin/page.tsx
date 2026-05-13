import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default async function AdminDashboard() {
  const [usersCount, camerasCount, alertsCount, groupsCount] = await Promise.all([
    prisma.user.count(),
    prisma.camera.count(),
    prisma.alert.count({ where: { processed: false } }),
    prisma.cameraGroup.count(),
  ]);
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Dashboard Admin</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle>Usuários</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">{usersCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Grupos</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">{groupsCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Câmeras</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">{camerasCount}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Alertas não processados</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">{alertsCount}</p></CardContent></Card>
      </div>
    </div>
  );
}
