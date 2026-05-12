#!/bin/sh
set -e

echo "Aguardando PostgreSQL..."
until pg_isready -h postgres -U postgres 2>/dev/null; do
  sleep 2
done

echo "Rodando migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Rodando seed..."
./node_modules/.bin/prisma db seed

echo "Iniciando Next.js..."
exec node server.js
