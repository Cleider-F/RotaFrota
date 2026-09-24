import { useEffect, useState } from 'react';
import * as api from './data';

export default function TechniciansPanel() {
  const [users, setUsers] = useState<api.TechnicianAccess[]>([]);
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [confirm, setConfirm] = useState<api.TechnicianAccess | null>(null);
  const refresh = async () => {
    const result = await api.manageTechnicians({action: 'list'});
    setUsers((result.users ?? []).sort((a,b) => Number(b.manager) - Number(a.manager) || a.name.localeCompare(b.name)));
    setTruncated(result.truncated === true);
  };
  useEffect(() => {
    if (api.isDemo) { setLoading(false); return; }
    void refresh().catch(e => setError(api.friendlyError(e))).finally(() => setLoading(false));
  }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(api.friendlyError(e)); }
    finally { setBusy(false); }
  };
  return <div className="technicians-panel">
    {api.isDemo && <p className="info-note">Demonstração: a criação de acessos reais está desabilitada.</p>}
    {error && <p className="alert" role="alert">{error}</p>}
    {message && <p className="info-note" role="status">{message}</p>}
    <section className="access-card"><h2>Cadastrar técnico</h2><p>O técnico poderá consultar viagens, visualizar fotos, exportar relatórios e corrigir registros da sua empresa.</p>
      <form onSubmit={event => {event.preventDefault(); void run(async () => {
        await api.manageTechnicians({action: 'create', name, email});
        setMessage('Técnico cadastrado. Use “Enviar e-mail para definir senha” na lista, ou peça que ele use “Esqueci minha senha” no login. Se já possui conta, a senha atual foi preservada.');
        setName(''); setEmail(''); await refresh();
      });}}><fieldset disabled={busy || loading || api.isDemo}>
        <label>Nome completo<input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
        <label>E-mail do técnico<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" placeholder="nome@empresa.com" /></label>
        <button className="primary" type="submit">{busy ? 'Aguarde…' : 'Cadastrar técnico'}</button>
      </fieldset></form>
    </section>
    <section className="access-card"><div className="access-heading"><h2>Técnicos com acesso</h2><button className="secondary" disabled={busy || loading || api.isDemo} onClick={() => void run(refresh)}>Atualizar lista</button></div>
      <p>Desativar bloqueia o acesso aos dados da frota. A conta e os registros anteriores são preservados.</p>
      {loading ? <p role="status">Carregando acessos…</p> : !users.length ? <p>Nenhum acesso listado.</p> : <ul className="access-list">{users.map(user => <li key={user.id}>
        <div><strong>{user.name}</strong><span>{user.email}</span><small>{user.manager ? 'Administrador' : 'Técnico'} · {user.active ? 'Ativo' : 'Desativado'}</small></div>
        {!user.manager && <div className="access-actions"><button className="secondary" disabled={busy || !user.active || !user.email} onClick={() => void run(async () => { await api.resetPassword(user.email); setMessage(`Solicitação enviada ao Firebase para ${user.email}. Oriente o técnico a verificar a caixa de entrada e o spam.`); })}>Enviar e-mail para definir senha</button><button className="secondary" disabled={busy} onClick={() => setConfirm(user)}>{user.active ? 'Desativar acesso' : 'Ativar acesso'}</button></div>}
      </li>)}</ul>}
      {truncated && <p role="status">Exibindo os primeiros 200 acessos. Consulte o responsável pelo sistema para gerenciar uma lista maior.</p>}
      {confirm && <div className="access-confirm" role="group" aria-label="Confirmar alteração de acesso"><p>{confirm.active ? 'Desativar' : 'Ativar'} o acesso de <b>{confirm.name}</b> ({confirm.email})?</p><button className="primary" disabled={busy} onClick={() => void run(async () => {await api.manageTechnicians({action:'setActive', userId:confirm.id, active:!confirm.active}); setConfirm(null); setMessage('Acesso atualizado.'); await refresh();})}>Confirmar</button><button className="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button></div>}
    </section>
  </div>;
}
