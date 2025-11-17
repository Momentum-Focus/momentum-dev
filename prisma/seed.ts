import { PrismaClient, AchievementCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const roleAdmin = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
    },
  });

  const roleUser = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
    },
  });

  console.log(`Created roles:`, { roleAdmin, roleUser });

  const achievements = [
    {
      code: AchievementCode.STREAK_3_DAYS,
      name: 'Maratonista Iniciante',
      description: 'Manteve um streak de 3 dias consecutivos',
    },
    {
      code: AchievementCode.STREAK_7_DAYS,
      name: 'Maratonista Semanal',
      description: 'Manteve um streak de 7 dias consecutivos',
    },
    {
      code: AchievementCode.STREAK_30_DAYS,
      name: 'Maratonista Mensal',
      description: 'Manteve um streak de 30 dias consecutivos',
    },
    {
      code: AchievementCode.FIRST_TASK_COMPLETED,
      name: 'Primeiro Passo',
      description: 'Completou sua primeira tarefa',
    },
    {
      code: AchievementCode.TASKS_10_COMPLETED,
      name: 'Produtivo',
      description: 'Completou 10 tarefas',
    },
    {
      code: AchievementCode.TASKS_100_COMPLETED,
      name: 'Máquina de Produtividade',
      description: 'Completou 100 tarefas',
    },
    {
      code: AchievementCode.FIRST_PROJECT_COMPLETED,
      name: 'Realizador',
      description: 'Completou seu primeiro projeto',
    },
    {
      code: AchievementCode.FOCUS_10_HOURS,
      name: 'Focado',
      description: 'Acumulou 10 horas de foco',
    },
    {
      code: AchievementCode.FOCUS_100_HOURS,
      name: 'Mestre da Concentração',
      description: 'Acumulou 100 horas de foco',
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {},
      create: achievement,
    });
  }

  console.log(`Created ${achievements.length} achievements`);
  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });