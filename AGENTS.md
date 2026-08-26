# Camera Monitor - Project Instructions

## Tech Stack
- **Framework:** Next.js 14.1 (App Router)
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** NextAuth v4 (Credentials provider)
- **UI:** Tailwind CSS + shadcn/ui components
- **Language:** TypeScript (strict mode)

## Commands
```bash
# Development
npm run dev

# Production build
npx next build

# Production start
npx next start -p 3000 -H 0.0.0.0

# Database
npx prisma migrate dev
npx prisma db seed
npx prisma studio

# Lint
npm run lint
```

## Project Structure
```
src/
├── app/
│   ├── api/          # API routes (Route Handlers)
│   ├── (auth)/       # Auth pages (login, register)
│   ├── (main)/       # Main app pages
│   └── layout.tsx    # Root layout
├── components/       # React components
├── lib/              # Utilities, auth config, prisma client
└── types/            # TypeScript type definitions
prisma/
├── schema.prisma     # Database schema
└── seed.js           # Seed data
```

## Conventions
- Use `@/` path alias for imports from `src/`
- API routes return JSON with consistent error format: `{ error: string }`
- Use Prisma for all database queries (never raw SQL)
- Components use `React.memo()` for performance
- Server components by default, `'use client'` only when needed
- Use `next/navigation` hooks (not `next/router`)
- Use `params` as Promise in Next.js 14: `const { id } = await params`

## Database
- **Connection:** `postgresql://postgres:postgres@localhost:5432/camera_monitor`
- **Admin login:** admin@admin.com / admin123
- **User login:** user@user.com / user123
