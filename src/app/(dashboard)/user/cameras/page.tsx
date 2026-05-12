import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { CameraCard } from "@/components/CameraCard";

export default async function UserCamerasPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = (session.user as any).id;
  const cameras = await prisma.camera.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Minhas Câmeras</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam) => (
          <CameraCard key={cam.id} camera={cam} />
        ))}
        {cameras.length === 0 && (
          <p className="text-gray-500 col-span-full">Você ainda não possui câmeras. Peça ao administrador para cadastrar.</p>
        )}
      </div>
    </div>
  );
}
