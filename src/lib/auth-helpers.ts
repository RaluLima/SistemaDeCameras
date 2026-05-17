import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyToken } from '@/lib/jwt';

export interface AuthUser {
  id: string;
  role: string;
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const payload = await verifyToken(auth.slice(7));
    if (payload?.sub) {
      return {
        id: payload.sub as string,
        role: (payload.role as string) || 'USER',
      };
    }
  }

  const session = await getServerSession(authOptions);
  if (session?.user) {
    const user = session.user as any;
    if (user.id) {
      return { id: user.id, role: user.role || 'USER' };
    }
  }

  return null;
}
