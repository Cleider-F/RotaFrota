export type AccessRecord = {
  tenantId?: string; role?: string; active?: boolean; canManageTechnicians?: boolean;
};
export function requireAccessManager(member: AccessRecord | undefined, anonymous: boolean) {
  if (anonymous || !member?.tenantId || member.active !== true || member.role !== 'technician' || member.canManageTechnicians !== true)
    throw new Error('Somente o administrador pode gerenciar técnicos.');
  return member.tenantId;
}
export function validateTechnicianTarget(actorId: string, targetId: string, tenantId: string, target: AccessRecord | undefined) {
  if (target && target.tenantId !== tenantId) throw new Error('Esta conta não pode ser gerenciada nesta empresa.');
  if (actorId === targetId) throw new Error('Você não pode alterar o próprio acesso.');
  if (target && target.role !== 'technician') throw new Error('Tipo de acesso incompatível.');
}
export function requireVerifiedAuthorization(permission: {active?: boolean; userId?: string | null} | undefined, uid: string, verified: boolean) {
  if (!permission || permission.active !== true || (permission.userId && permission.userId !== uid)) throw new Error('Este e-mail não possui autorização. Entre em contato com o administrador.');
  if (!verified) throw new Error('Confirme seu e-mail antes de entrar. Use o botão Reenviar confirmação.');
}
