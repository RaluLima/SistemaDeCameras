import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.authProvider === "credentials") {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 3600000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpires },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
    }

    return NextResponse.json({ message: "Se este email estiver cadastrado, você receberá um link de redefinição." });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
