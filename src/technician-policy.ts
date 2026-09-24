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
  if (actorId === targetId || target?.canManageTechnicians === true) throw new Error('O acesso do administrador não pode ser alterado por esta tela.');
  if (target && target.role !== 'technician') throw new Error('Tipo de acesso incompatível.');
}
