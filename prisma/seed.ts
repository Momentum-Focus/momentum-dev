import {
  PrismaClient,
  AchievementCode,
  BillingCycle,
  Prisma,
} from '@prisma/client';

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

  // Features do sistema
  const featureDefinitions = [
    {
      code: 'VIDEO_BACKGROUND',
      name: 'Fundo em Vídeo',
      description: 'Permite definir vídeos personalizados como plano de fundo.',
    },
    {
      code: 'PROJECTS',
      name: 'Projetos',
      description: 'Crie e gerencie projetos para organizar suas tarefas.',
    },
    {
      code: 'BASIC_REPORTS',
      name: 'Relatórios Básicos',
      description: 'Visualize seu tempo focado e histórico de sessões.',
    },
    {
      code: 'ADVANCED_REPORTS',
      name: 'Relatórios Avançados',
      description: 'Insights detalhados e análises avançadas de produtividade.',
    },
    {
      code: 'FULL_CUSTOMIZATION',
      name: 'Customização Total',
      description: 'Personalize completamente a interface e experiência.',
    },
    {
      code: 'EXTRA_INTEGRATIONS',
      name: 'Integrações Extras',
      description: 'Acesso a integrações adicionais e APIs.',
    },
    {
      code: 'PRIORITY_SUPPORT',
      name: 'Suporte Prioritário',
      description: 'Atendimento prioritário e suporte dedicado.',
    },
  ];

  for (const feature of featureDefinitions) {
    await prisma.feature.upsert({
      where: { code: feature.code },
      update: {
        name: feature.name,
        description: feature.description,
        deletedAt: null,
      },
      create: feature,
    });
  }

  // Planos: Vibes (Gratuito), Flow (Intermediário), Epic (Premium)
  const planDefinitions = [
    {
      name: 'VIBES',
      description:
        'Plano gratuito com timer básico, gestão de tarefas e fundos em imagem.',
      price: new Prisma.Decimal('0'),
      billingCycle: BillingCycle.MONTHLY,
      featureCodes: [], // Vibes não tem features premium
    },
    {
      name: 'FLOW',
      description:
        'Tudo do Vibes + fundos em vídeo, projetos e relatórios básicos.',
      price: new Prisma.Decimal('19.90'),
      billingCycle: BillingCycle.MONTHLY,
      featureCodes: ['VIDEO_BACKGROUND', 'PROJECTS', 'BASIC_REPORTS'],
    },
    {
      name: 'EPIC',
      description:
        'Tudo do Flow + relatórios avançados, customização total e suporte prioritário.',
      price: new Prisma.Decimal('39.90'),
      billingCycle: BillingCycle.MONTHLY,
      featureCodes: [
        'VIDEO_BACKGROUND',
        'PROJECTS',
        'BASIC_REPORTS',
        'ADVANCED_REPORTS',
        'FULL_CUSTOMIZATION',
        'EXTRA_INTEGRATIONS',
        'PRIORITY_SUPPORT',
      ],
    },
  ];

  for (const definition of planDefinitions) {
    const plan = await prisma.plan.upsert({
      where: { name: definition.name },
      update: {
        description: definition.description,
        price: definition.price,
        billingCycle: definition.billingCycle,
        isActive: true,
        deletedAt: null,
      },
      create: {
        name: definition.name,
        description: definition.description,
        price: definition.price,
        billingCycle: definition.billingCycle,
        isActive: true,
      },
    });

    await prisma.planFeature.deleteMany({
      where: { planId: plan.id },
    });

    if (definition.featureCodes.length > 0) {
      const features = await prisma.feature.findMany({
        where: { code: { in: definition.featureCodes } },
      });

      await prisma.planFeature.createMany({
        data: features.map((feature) => ({
          planId: plan.id,
          featureId: feature.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`Created ${featureDefinitions.length} features and seeded plans`);
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
