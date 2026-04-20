import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding plans...')

  await prisma.plan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter',
      name: 'Starter',
      billingCycle: 'monthly',
      listPriceAed: 149,
      discountPercent: 100,
      finalPriceAed: 0,
      isMostPopular: false,
      isCustom: false,
      description: 'For small businesses getting started.',
      features: [
        'Up to 3 users',
        'Accounting & Invoicing',
        'Sales management',
        'Email support',
        '5 GB storage',
      ],
    },
  })

  await prisma.plan.upsert({
    where: { code: 'growth' },
    update: {},
    create: {
      code: 'growth',
      name: 'Growth',
      billingCycle: 'monthly',
      listPriceAed: 349,
      discountPercent: 100,
      finalPriceAed: 0,
      isMostPopular: true,
      isCustom: false,
      description: 'For growing teams that need more power.',
      features: [
        'Up to 15 users',
        'Accounting, Sales & Purchasing',
        'Inventory management',
        'HR & Employees',
        'Priority email support',
        '25 GB storage',
      ],
    },
  })

  await prisma.plan.upsert({
    where: { code: 'business' },
    update: {},
    create: {
      code: 'business',
      name: 'Business',
      billingCycle: 'monthly',
      listPriceAed: 699,
      discountPercent: 100,
      finalPriceAed: 0,
      isMostPopular: false,
      isCustom: false,
      description: 'For established businesses with complex needs.',
      features: [
        'Unlimited users',
        'Full ERP suite',
        'Advanced reporting',
        'Multi-company support',
        'Dedicated support',
        '100 GB storage',
      ],
    },
  })

  await prisma.plan.upsert({
    where: { code: 'enterprise' },
    update: {},
    create: {
      code: 'enterprise',
      name: 'Enterprise',
      billingCycle: 'custom',
      listPriceAed: 0,
      discountPercent: 0,
      finalPriceAed: 0,
      isMostPopular: false,
      isCustom: true,
      description: 'Custom deployment and pricing for large organizations.',
      features: [
        'Custom user count',
        'Dedicated infrastructure',
        'Custom integrations',
        'SLA agreement',
        'On-site support available',
        'Unlimited storage',
      ],
    },
  })

  console.log('Plans seeded successfully.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
