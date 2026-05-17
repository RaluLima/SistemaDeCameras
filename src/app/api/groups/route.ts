import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    let groups;
    if (auth.role === "ADMIN") {
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
            { userId: auth.id },
            { members: { some: { userId: auth.id } } },
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
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    const group = await prisma.cameraGroup.create({
      data: {
        name,
        description,
        userId: auth.id,
        members: {
          create: { userId: auth.id, role: "OWNER" },
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
