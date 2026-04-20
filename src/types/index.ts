export type TenantStatus = 'pending' | 'trial' | 'active' | 'inactive'
export type ProvisioningState = 'pending' | 'provisioning' | 'ready' | 'failed'

export interface TenantRow {
  id: string
  fullName: string
  companyName: string
  email: string
  phone: string | null
  desiredSubdomain: string
  normalizedSubdomain: string
  fullDomain: string
  dbName: string
  status: TenantStatus
  provisioningState: ProvisioningState
  isActive: boolean
  planCode: string
  listPriceAed: string
  discountPercent: string
  finalPriceAed: string
  pricingLabel: string | null
  trialStartAt: Date | null
  trialEndAt: Date | null
  provisioningError: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PlanRow {
  code: string
  name: string
  billingCycle: string
  listPriceAed: string
  discountPercent: string
  finalPriceAed: string
  isMostPopular: boolean
  isCustom: boolean
  description: string | null
  features: string[]
}

export interface SignupInput {
  fullName: string
  companyName: string
  email: string
  phone?: string
  desiredSubdomain: string
  password: string
  planCode?: string
}

export interface SignupResult {
  success: boolean
  tenantId?: string
  workspaceUrl?: string
  error?: string
  fieldErrors?: Record<string, string>
}
