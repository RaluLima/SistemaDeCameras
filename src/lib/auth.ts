import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    ...(googleConfigured
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Credenciais inválidas");
        }
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.email },
              { nickname: credentials.email },
            ],
          },
        });
        if (!user || !user.password) {
          throw new Error("Usuário não encontrado");
        }
        if (user.authProvider !== "credentials") {
          throw new Error("Use o Google ou celular para entrar");
        }
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Senha incorreta");
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          planExpiresAt: user.planExpiresAt,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (existingUser) {
          if (existingUser.authProvider !== "google" && existingUser.password) {
            throw new Error("Esta conta já possui login por email/senha. Use o login com email.");
          }
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { providerId: account.providerAccountId },
          });
          user.id = existingUser.id;
          (user as any).role = existingUser.role;
          (user as any).plan = existingUser.plan;
          (user as any).planExpiresAt = existingUser.planExpiresAt;
          return true;
        }
        const newUser = await prisma.user.create({
          data: {
            name: user.name || "Usuário Google",
            email: user.email!,
            authProvider: "google",
            providerId: account.providerAccountId,
            emailVerified: new Date(),
          },
        });
        user.id = newUser.id;
        (user as any).role = newUser.role;
        (user as any).plan = newUser.plan;
        (user as any).planExpiresAt = newUser.planExpiresAt;
      }
      return true;
    },
    async jwt({ token, user, trigger, session: triggerSession }) {
      if (user) {
        token.role = (user as any).role || "USER";
        token.id = user.id;
        token.plan = (user as any).plan || "FREE";
        token.planExpiresAt = (user as any).planExpiresAt || null;
        token.mustChangePassword = (user as any).mustChangePassword || false;
      }
      if (trigger === "update" && triggerSession) {
        token.mustChangePassword = (triggerSession as any).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).plan = token.plan;
        (session.user as any).planExpiresAt = token.planExpiresAt;
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
