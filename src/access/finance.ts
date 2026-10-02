import type { Access, FieldAccess } from 'payload'

export const hasFinanceAccess = (user: unknown): boolean => {
  const u = user as { collection?: string; financeAccess?: boolean; financeAdmin?: boolean } | null
  return !!u && u.collection === 'users' && (u.financeAccess === true || u.financeAdmin === true)
}
export const isFinanceAdmin = (user: unknown): boolean =>
  !!user &&
  (user as { collection?: string }).collection === 'users' &&
  (user as { financeAdmin?: boolean }).financeAdmin === true
export const financeAccess: Access = ({ req }) => hasFinanceAccess(req.user)
export const financeAdminField: FieldAccess = ({ req }) => isFinanceAdmin(req.user)
