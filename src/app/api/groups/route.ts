import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const role = (session.user as any).role;

    let groups;
    if (role === "ADMIN") {
      groups = await prisma.cameraGroup.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { cameras: true, members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      groups = await prisma.cameraGroup.findMany({
        where: {
          OR: [
            { userId },
            { members: { some: { userId } } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { cameras: true, members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(groups);
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const userId = (session.user as any).id;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    const group = await prisma.cameraGroup.create({
      data: {
        name,
        description,
        userId,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
