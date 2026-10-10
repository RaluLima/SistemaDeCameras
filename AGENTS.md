# Camera Monitor - Project Instructions

## Tech Stack
- **Framework:** Next.js 14.1 (App Router)
- **Database:** PostgreSQL 18 + Prisma ORM 5.22
- **Cache/Pub-Sub:** Redis (porta 6379) via ioredis
- **Streaming:** MediaMTX (RTSP :8554, HLS :8888, WebRTC :8889)
- **IA:** FastAPI + MediaPipe (`ai-service/`, porta 8000)
- **Auth:** NextAuth v4 (Credentials provider, JWT com `role`)
- **UI:** Tailwind CSS + shadcn/ui components
- **Language:** TypeScript (strict mode)

## Services obrigatórios
| Serviço | Porta | Binário / Estado |
|---|---|---|
| PostgreSQL | 5432 | Serviço Windows `postgresql-x64-18` em `D:\PostgreSQL\18` |
| Redis | 6379 | `tools\redis\redis-server.exe` (startar com `tools\redis\redis.windows.conf`) |
| Next.js | 3000 | `node server.js` (custom server com Socket.IO em `/api/socketio`) |
| AI Service | 8000 | `python ai-service\main.py` |
| MediaMTX | 8554/8888/8889 | `mediamtx.exe mediamtx.yml` |

FFmpeg para testes: `tools\ffmpeg\bin\ffmpeg.exe`

## Commands
```bash
# Iniciar TUDO (Redis, Postgres, migrations, MediaMTX, Next.js, AI Service)
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
# ou
start-server.bat

# Painel grafico de controle dos servicos
abrir-painel.bat          # usa dist\CameraMonitor-Panel.exe ou server_panel.py

# Development
npm run dev

# Production build
npx next build

# Production start (com Socket.IO)
node server.js

# Database
npx prisma migrate deploy        # aplica migrations existentes
npx prisma migrate dev --name X  # cria migration
npm run db:seed
npx prisma studio

# Typecheck
npx tsc --noEmit

# AI Service deps
pip install -r ai-service\requirements.txt
```

## Project Structure
```
src/
├── app/
│   ├── api/          # API routes (todas com export const dynamic = "force-dynamic")
│   ├── admin/        # Páginas de admin (exigem role ADMIN via middleware)
│   ├── user/         # Páginas de usuário
│   └── layout.tsx    # Root layout
├── components/       # React components
├── lib/              # auth, prisma, redis, socket, push, plan, service-auth
├── middleware.ts     # next-auth middleware + bloqueio de /admin para não-ADMIN
└── types/            # TypeScript type definitions
prisma/
├── schema.prisma     # Database schema
├── migrations/       # Migrations versionadas
└── seed.js           # Seed data
ai-service/           # Serviço Python de detecção de queda (MediaPipe)
recorder/             # Worker de gravação (ffmpeg)
tools/                # ffmpeg, redis (binários portáteis)
server.js             # Custom server Next.js + Socket.IO
server_panel.py       # Painel Tkinter de controle dos serviços
```

## Conventions
- Use `@/` path alias for imports from `src/`
- API routes return JSON with consistent error format: `{ error: string }`
- **Toda rota em `src/app/api/**` precisa de `export const dynamic = "force-dynamic"`** — elas usam sessão/DB e não devem ser prerenderizadas
- `params` é Promise no App Router: `const { id } = await params`
- Rotas autenticadas usam `getAuthUser(req)` de `@/lib/auth-helpers` (aceita Bearer JWT ou sessão)
- Mídia autenticada é servida via proxy `/api/live/[cameraId]/[file]` (não exponha a `LIVE_BASE_URL` diretamente)
- Serviços externos (ai-service) autenticam com header `x-service-key: AI_SERVICE_KEY`
- Use Prisma para todas as queries (nunca SQL cru). Relations que devem sumir com o pai usam `onDelete: Cascade`

## Database
- **Connection:** `postgresql://postgres:<senha>@localhost:5432/camera_monitor` (ver `.env`)
- **Admin login:** admin@admin.com / admin123
- **User login:** user@user.com / user123

## Notas de segurança
- `NEXTAUTH_SECRET` e `AI_SERVICE_KEY` do `.env` são valores de desenvolvimento — trocar em produção
- O PostgreSQL local está com `listen_addresses = '*'`; restringir a `localhost` se a máquina estiver exposta
- Redis sem autenticação: aceitável só em rede local
