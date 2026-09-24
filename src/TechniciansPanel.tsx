import { useEffect, useState } from 'react';
import * as api from './data';

export default function TechniciansPanel() {
  const [users, setUsers] = useState<api.TechnicianAccess[]>([]);
  const [name, setName] = useState(''), [email, setEmail] = useState('');
  const [manager, setManager] = useState(false), [self, setSelf] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [confirm, setConfirm] = useState<api.TechnicianAccess | null>(null);
  const refresh = async () => {
    const result = await api.manageTechnicians({action: 'list'});
    setUsers((result.users ?? []).sort((a,b) => Number(b.manager) - Number(a.manager) || a.name.localeCompare(b.name)));
    setTruncated(result.truncated === true); setSelf(result.currentUserId ?? "");
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
    <section className="access-card"><h2>Autorizar e-mail</h2><p>Autorize o e-mail e escolha o perfil. A pessoa criará sua conta pelo botão Criar conta na tela de acesso.</p>
      <form onSubmit={event => {event.preventDefault(); void run(async () => {
        await api.manageTechnicians({action: 'authorize', name, email, manager, active:true});
        setMessage('E-mail autorizado. A pessoa já pode usar Criar conta na tela de acesso, escolher sua senha e confirmar o e-mail.');
        setName(''); setEmail(''); await refresh();
      });}}><fieldset disabled={busy || loading || api.isDemo}>
        <label>Nome completo<input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
        <label>E-mail do técnico<input type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" placeholder="nome@empresa.com" /></label>
        <label>Perfil<select value={manager ? "admin" : "tech"} onChange={e => setManager(e.target.value === "admin")}><option value="tech">Apenas técnico</option><option value="admin">Administrador</option></select></label><button className="primary" type="submit">{busy ? 'Aguarde…' : 'Autorizar e-mail'}</button>
      </fieldset></form>
    </section>
    <section className="access-card"><div className="access-heading"><h2>E-mails e permissões</h2><button className="secondary" disabled={busy || loading || api.isDemo} onClick={() => void run(refresh)}>Atualizar lista</button></div>
      <p>Desativar bloqueia o acesso aos dados da frota. A conta e os registros anteriores são preservados.</p>
      {loading ? <p role="status">Carregando acessos…</p> : !users.length ? <p>Nenhum acesso listado.</p> : <ul className="access-list">{users.map(user => <li key={user.id}>
        <div><strong>{user.name}</strong><span>{user.email}</span><small>{user.manager ? 'Administrador' : 'Técnico'} · {user.active ? 'Autorizado' : 'Desativado'} · {user.registered ? 'Conta cadastrada' : 'Aguardando cadastro'}</small></div>
        {user.userId !== self && <div className="access-actions"><button className="secondary" disabled={busy} onClick={() => setConfirm({...user,manager:!user.manager})}>{user.manager ? 'Tornar apenas técnico' : 'Tornar administrador'}</button><button className="secondary" disabled={busy} onClick={() => setConfirm({...user,active:!user.active})}>{user.active ? 'Desativar acesso' : 'Ativar acesso'}</button></div>}
      </li>)}</ul>}
      {truncated && <p role="status">Exibindo os primeiros 200 acessos. Consulte o responsável pelo sistema para gerenciar uma lista maior.</p>}
      {confirm && <div className="access-confirm" role="group" aria-label="Confirmar alteração de acesso"><p>Salvar acesso {confirm.active ? 'ativo' : 'desativado'} como {confirm.manager ? 'administrador' : 'apenas técnico'} para <b>{confirm.name}</b> ({confirm.email})?</p><button className="primary" disabled={busy} onClick={() => void run(async () => {await api.manageTechnicians({action:'update', email:confirm.email, name:confirm.name, active:confirm.active, manager:confirm.manager}); setConfirm(null); setMessage('Acesso atualizado.'); await refresh();})}>Confirmar</button><button className="secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button></div>}
    </section>
  </div>;
}

