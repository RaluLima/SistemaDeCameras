const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@admin.com',
      password: adminPassword,
      phone: '11999999999',
      role: Role.ADMIN,
      authProvider: 'credentials',
      address: {
        create: {
          street: 'Rua Admin',
          number: '100',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01001000',
        },
      },
    },
  });

  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@user.com' },
    update: {},
    create: {
      name: 'Usuário Comum',
      email: 'user@user.com',
      password: userPassword,
      phone: '11988888888',
      role: Role.USER,
      authProvider: 'credentials',
      address: {
        create: {
          street: 'Rua User',
          number: '200',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01002000',
        },
      },
    },
  });

  console.log({ admin, user });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
