import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { CameraCard } from "@/components/CameraCard";

export default async function AdminCamerasPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") redirect("/login");

  const cameras = await prisma.camera.findMany({
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Todas as Câmeras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam) => (
          <CameraCard key={cam.id} camera={cam} isAdmin />
        ))}
        {cameras.length === 0 && <p className="text-gray-500 col-span-full">Nenhuma câmera cadastrada.</p>}
      </div>
    </div>
  );
}
