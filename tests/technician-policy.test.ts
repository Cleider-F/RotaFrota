import { describe, expect, it } from 'vitest';
import { requireAccessManager, validateTechnicianTarget, requireEmailAuthorization, validateSignupPassword } from '../src/technician-policy';
const manager = {tenantId:'company-a', role:'technician', active:true, canManageTechnicians:true};
describe('gestão de técnicos', () => {
  it('autoriza somente administrador ativo autenticado', () => {
    expect(requireAccessManager(manager, false)).toBe('company-a');
    for (const member of [undefined, {...manager, active:false}, {...manager, canManageTechnicians:false}, {...manager, role:'driver'}, {...manager, tenantId:''}]) {
      expect(() => requireAccessManager(member, false)).toThrow();
    }
    expect(() => requireAccessManager(manager, true)).toThrow();
  });
  it('bloqueia autoalteração e permite gerenciar outros administradores da empresa', () => {
    expect(() => validateTechnicianTarget('owner','owner','company-a',manager)).toThrow();
    expect(() => validateTechnicianTarget('owner','other','company-a',manager)).not.toThrow();
  });
  it('exige autorização ativa e vínculo correto, sem confirmação de e-mail', () => {
    expect(() => requireEmailAuthorization(undefined,'new')).toThrow('autorização');
    expect(() => requireEmailAuthorization({active:false},'new')).toThrow('autorização');
    expect(() => requireEmailAuthorization({active:true,userId:'other'},'new')).toThrow('autorização');
    expect(() => requireEmailAuthorization({active:true},'new')).not.toThrow();
  });
  it('bloqueia acesso cruzado entre empresas e papéis incompatíveis', () => {
    expect(() => validateTechnicianTarget('owner','other','company-a',{tenantId:'company-b',role:'technician'})).toThrow();
    expect(() => validateTechnicianTarget('owner','other','company-a',{tenantId:'company-a',role:'driver'})).toThrow();
  });
  it('permite novo cadastro e alteração de técnico da própria empresa', () => {
    expect(() => validateTechnicianTarget('owner','new','company-a',undefined)).not.toThrow();
    expect(() => validateTechnicianTarget('owner','other','company-a',{...manager,canManageTechnicians:false,active:false})).not.toThrow();
  });
});

it('aceita senha a partir de 6 caracteres e rejeita limites inválidos', () => {
  expect(() => validateSignupPassword('123456')).not.toThrow();
  expect(() => validateSignupPassword('a'.repeat(128))).not.toThrow();
  for (const password of ['12345','',null,'a'.repeat(129)]) expect(() => validateSignupPassword(password)).toThrow();
});
