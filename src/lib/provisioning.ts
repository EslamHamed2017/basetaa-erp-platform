import { prisma } from './prisma'
import { createTenantDatabase, seedTenantDatabase, tenantDatabaseExists } from './tenant-db'
import { validateSubdomain, buildWorkspaceDomain, buildDbName } from './subdomain'
import { SignupInput, SignupResult } from '@/types'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS ?? '14')
const DEFAULT_PLAN = 'growth'

// ─── Input validation schema ──────────────────────────────────────────────────

const signupSchema = z.object({
  fullName:         z.string().min(2).max(100),
  companyName:      z.string().min(2).max(100),
  email:            z.string().email(),
  phone:            z.string().optional(),
  desiredSubdomain: z.string().min(3).max(40),
  password:         z.string().min(8).max(128),
  planCode:         z.string().optional(),
})

// ─── Main provisioning function ───────────────────────────────────────────────

export async function provisionTenant(input: SignupInput): Promise<SignupResult> {
  // 1. Validate input
  const parsed = signupSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? 'general'
      fieldErrors[key] = issue.message
    }
    return { success: false, error: 'Validation failed.', fieldErrors }
  }

  const { fullName, companyName, email, phone, desiredSubdomain, password } = parsed.data
  const planCode = parsed.data.planCode ?? DEFAULT_PLAN

  // 2. Validate & normalize subdomain
  const subResult = validateSubdomain(desiredSubdomain)
  if (!subResult.valid) {
    return { success: false, error: subResult.error, fieldErrors: { desiredSubdomain: subResult.error! } }
  }
  const normalizedSubdomain = subResult.normalized
  const dbName = buildDbName(normalizedSubdomain)
  const fullDomain = buildWorkspaceDomain(normalizedSubdomain)

  // 3. Check uniqueness
  const [emailExists, subdomainExists] = await Promise.all([
    prisma.tenant.findUnique({ where: { email } }),
    prisma.tenant.findUnique({ where: { normalizedSubdomain } }),
  ])
  if (emailExists) return { success: false, error: 'An account with this email already exists.', fieldErrors: { email: 'Email already registered.' } }
  if (subdomainExists) return { success: false, error: 'This subdomain is already taken.', fieldErrors: { desiredSubdomain: 'Subdomain already taken.' } }

  // 4. Resolve plan pricing
  const plan = await prisma.plan.findUnique({ where: { code: planCode } })
  if (!plan) return { success: false, error: 'Invalid plan selected.' }

  // 5. Hash password
  const passwordHash = await bcrypt.hash(password, 12)

  // 6. Set trial window
  const trialStartAt = new Date()
  const trialEndAt = new Date(trialStartAt)
  trialEndAt.setDate(trialEndAt.getDate() + TRIAL_DAYS)

  // 7. Create tenant record in control DB with provisioning=pending
  let tenant: Awaited<ReturnType<typeof prisma.tenant.create>>
  try {
    tenant = await prisma.tenant.create({
      data: {
        fullName,
        companyName,
        email,
        phone: phone?.trim() || null,
        desiredSubdomain,
        normalizedSubdomain,
        fullDomain,
        dbName,
        passwordHash,
        status: 'pending',
        provisioningState: 'provisioning',
        isActive: false,
        planCode: plan.code,
        listPriceAed: plan.listPriceAed,
        discountPercent: plan.discountPercent,
        finalPriceAed: plan.finalPriceAed,
        pricingLabel: plan.discountPercent.toString() === '100'
          ? '100% launch discount'
          : `${plan.discountPercent}% off`,
        trialStartAt,
        trialEndAt,
        provisioningAt: new Date(),
      },
    })
  } catch (err) {
    // Unique constraint violation — concurrent signup with same email or subdomain
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err as Prisma.PrismaClientKnownRequestError).code === 'P2002'
    ) {
      return { success: false, error: 'This email or subdomain is already registered.' }
    }
    throw err
  }

  // 8. Provision tenant database (async — errors are captured, not thrown)
  try {
    const exists = await tenantDatabaseExists(dbName)
    if (!exists) {
      await createTenantDatabase(dbName)
    }
    await seedTenantDatabase(dbName, { companyName, ownerEmail: email })

    // 9. Mark as ready + set status to trial
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        provisioningState: 'ready',
        status: 'trial',
        isActive: true,
        provisioningError: null,
      },
    })
  } catch (err) {
    // Provisioning failed — store error for admin inspection
    const message = err instanceof Error ? err.message : String(err)
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        provisioningState: 'failed',
        provisioningError: message,
        status: 'pending',
      },
    })
    // Still return success from the user's perspective — admin can retry
    return {
      success: true,
      tenantId: tenant.id,
      workspaceUrl: `https://${fullDomain}`,
      error: 'Workspace created but provisioning is pending. We will notify you when it is ready.',
    }
  }

  return {
    success: true,
    tenantId: tenant.id,
    workspaceUrl: `https://${fullDomain}`,
  }
}

// ─── Re-provision a failed tenant ─────────────────────────────────────────────

export async function reprovisionTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return { success: false, error: 'Tenant not found.' }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { provisioningState: 'provisioning', provisioningError: null },
  })

  try {
    const exists = await tenantDatabaseExists(tenant.dbName)
    if (!exists) await createTenantDatabase(tenant.dbName)
    await seedTenantDatabase(tenant.dbName, { companyName: tenant.companyName, ownerEmail: tenant.email })
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { provisioningState: 'ready', status: 'trial', isActive: true, provisioningError: null },
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { provisioningState: 'failed', provisioningError: message },
    })
    return { success: false, error: message }
  }
}
