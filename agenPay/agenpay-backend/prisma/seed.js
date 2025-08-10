import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 12);
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@agenpay.com' },
    update: {},
    create: {
      email: 'demo@agenpay.com',
      password: hashedPassword,
      name: 'Demo User',
    },
  });

  console.log('✅ Demo user created:', demoUser.email);

  // Create system configuration
  const configs = [
    {
      key: 'system_version',
      value: '1.0.0',
      description: 'Current system version',
    },
    {
      key: 'default_currency',
      value: 'ETH',
      description: 'Default cryptocurrency for transactions',
    },
    {
      key: 'monitoring_interval',
      value: '10',
      description: 'Default monitoring interval in minutes',
    },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  console.log('✅ System configuration created');

  // Create demo transactions (optional)
  const demoTransactions = [
    
  ];

  for (const transaction of demoTransactions) {
    await prisma.transaction.create({
      data: transaction,
    });
  }

  console.log('✅ Demo transactions created');

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 