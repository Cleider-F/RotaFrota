import { useMemo, useState } from 'react';
import { ArrowLeft, Download, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { date, number, distance, totalLiters, type Trip } from './domain';
import { driverKey, filterBiTrips, groupBi, operationDay, summarizeBi, type BiFilter } from './bi';
import { tripsToCsv } from './trip-csv';
import './bi.css';

type Measure = 'km'|'liters'|'count'|'efficiency';
const measures: Record<Measure,string> = {km:'Distância registrada',liters:'Litros abastecidos',count:'Viagens',efficiency:'Km/L estimado'};
const units: Record<Measure,string> = {km:'km',liters:'L',count:'viagens',efficiency:'km/L'};
const dayLabel = (day:string) => day.split('-').reverse().join('/');
export default function BiPanel({trips,onOpenTrip}:{trips:Trip[];onOpenTrip:(trip:Trip)=>void}) {
  const [filter,setFilter] = useState<BiFilter>(() => ({from:operationDay(new Date(Date.now()-29*86400000).toISOString()),to:operationDay(new Date().toISOString()),plate:'',driver:'',status:'all',day:''}));
  const [measure,setMeasure] = useState<Measure>('km');
  const [limit,setLimit] = useState(20);
  const update = (changes:Partial<BiFilter>) => {setFilter(f=>({...f,...changes}));setLimit(20);};
  const drill = (changes:Partial<BiFilter>) => {update(changes); requestAnimationFrame(() => document.getElementById('bi-selection')?.scrollIntoView({behavior:'smooth',block:'start'}));};
  const invalid = !!filter.from && !!filter.to && filter.from > filter.to;
  const scoped = useMemo(()=>invalid ? [] : filterBiTrips(trips,filter).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)),[trips,filter,invalid]);
  const summary = summarizeBi(scoped);
  const plates = [...new Set(trips.map(t=>t.plate))].sort();
  const drivers = [...new Map(trips.map(t=>[driverKey(t.driver),t.driver.trim()])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const timeline = groupBi(invalid ? [] : filterBiTrips(trips,{...filter,day:''}),'day').sort((a,b)=>a.key.localeCompare(b.key));
  const maxDay = Math.max(1,...timeline.map(g=>g.count));
  const exportSelection = () => {
    const url=URL.createObjectURL(new Blob([tripsToCsv(scoped)],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='controle-km-combustivel-bi.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const ranking = (kind:'plate'|'driver',title:string) => {
    const groups = groupBi(scoped,kind).sort((a,b)=>(b[measure]??-1)-(a[measure]??-1));
    const max = Math.max(1,...groups.map(g=>g[measure]??0));
    return <section className="bi-card"><h2>{title}</h2><p>{measures[measure]} · clique para detalhar</p>
      {!groups.length ? <p className="bi-empty">Sem dados neste recorte.</p> : <div className="bi-ranking">{groups.slice(0,10).map((g,i)=><button key={g.key} aria-label={`Detalhar ${kind === 'plate' ? 'veículo' : 'motorista'} ${g.label}`} onClick={()=>drill(kind === 'plate' ? {plate:g.key} : {driver:g.key})}>
        <span className="bi-rank-label"><span>{String(i+1).padStart(2,'0')}</span><b>{g.label}</b><strong>{g[measure] === null ? '—' : number(g[measure]!,measure === 'count' ? 0 : 2)} <small>{units[measure]}</small></strong></span>
        <span className="bi-track"><span style={{width:`${100*(g[measure]??0)/max}%`}} /></span>
        <small>{g.count} viagens · {g.active} em andamento{measure === 'efficiency' ? ` · ${g.eligible} com base para estimativa` : ''}</small>
      </button>)}</div>}
      {groups.length > 10 && <p>Mostrando os 10 primeiros. Use o filtro acima para selecionar qualquer {kind === 'plate' ? 'veículo' : 'motorista'}.</p>}
    </section>;
  };
  return <div className="bi-panel">
    <section className="bi-filters" aria-label="Filtros do BI"><div className="bi-filter-heading"><b><SlidersHorizontal size={18}/> Analisar operação</b><button className="secondary" onClick={()=>update({from:'',to:'',plate:'',driver:'',status:'all',day:''})}>Limpar filtros</button></div>
      <div className="bi-filter-fields">
        <label>De<input type="date" value={filter.from} onChange={e=>update({from:e.target.value,day:''})}/></label>
        <label>Até<input type="date" value={filter.to} onChange={e=>update({to:e.target.value,day:''})}/></label>
        <label>Veículo<select value={filter.plate} onChange={e=>update({plate:e.target.value})}><option value="">Todos os veículos</option>{plates.map(p=><option key={p}>{p}</option>)}</select></label>
        <label>Motorista<select value={filter.driver} onChange={e=>update({driver:e.target.value})}><option value="">Todos os motoristas</option>{drivers.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Situação<select value={filter.status} onChange={e=>update({status:e.target.value})}><option value="all">Todas</option><option value="active">Em andamento</option><option value="finished">Concluídas</option></select></label>
      </div>
      <p>Período pela data de início da viagem, no horário de Brasília. Os registros recebidos atualizam esta análise.</p>
      {invalid && <p role="alert">A data inicial deve ser anterior ou igual à final.</p>}
    </section>
    <div className="bi-context" id="bi-selection" aria-live="polite"><div><span className="eyebrow">{filter.plate || filter.driver ? 'ANÁLISE INDIVIDUAL' : 'VISÃO DA OPERAÇÃO'}</span><h2>{filter.plate || 'Toda a frota'}{filter.driver ? ` · ${drivers.find(([key])=>key===filter.driver)?.[1] ?? filter.driver}` : ''}</h2>{filter.day && <button className="secondary" onClick={()=>update({day:''})}>Dia {dayLabel(filter.day)} · remover filtro</button>}</div>
      {(filter.plate || filter.driver) && <button className="secondary" onClick={()=>update({plate:'',driver:'',day:''})}><ArrowLeft size={17}/> Voltar ao geral</button>}
    </div>
    <div className="bi-kpis">
      {[['Viagens',number(summary.count),'No recorte selecionado'],['Distância registrada',`${number(summary.km)} km`,'Até o último hodômetro enviado'],['Combustível abastecido',`${number(summary.liters,2)} L`,`${summary.fills} abastecimentos`],['Rendimento estimado',summary.efficiency === null ? '—' : `${number(summary.efficiency,2)} km/L`,`${summary.eligible} viagens concluídas com litros`]].map(([label,value,hint])=><section className="bi-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small></section>)}
    </div>
    <p className="bi-note">Km/L estimado = soma das distâncias ÷ soma dos litros das viagens concluídas com abastecimento. Não mede consumo exato sem conhecer o combustível inicial e final. Motoristas são agrupados pelo nome informado; homônimos podem aparecer juntos.</p>
    <div className="bi-chart-grid">
      <section className="bi-card"><h2>Viagens por dia</h2><p>Clique em uma barra para ver as viagens iniciadas naquele dia.</p>
        <div className="bi-timeline">{timeline.length ? timeline.map(g=><button key={g.key} className={filter.day===g.key?'selected':''} aria-label={`Filtrar dia ${dayLabel(g.key)}: ${g.count} viagens`} aria-pressed={filter.day===g.key} onClick={()=>update({day:filter.day===g.key?'':g.key})}><strong>{g.count}</strong><span className="bi-column-area"><span style={{height:`${Math.max(3,g.count/maxDay*100)}%`}}/></span><small>{dayLabel(g.key).slice(0,5)}</small></button>) : <p className="bi-empty">Nenhuma viagem no período selecionado.</p>}</div>
      </section>
      <section className="bi-card"><h2>Situação das viagens</h2><p>Clique em uma situação para filtrar o painel.</p><div className="bi-status">
        <button aria-pressed={filter.status==='active'} onClick={()=>update({status:filter.status==='active'?'all':'active'})}><span className="bi-status-dot active"/><span>Em andamento</span><strong>{summary.active}</strong></button>
        <button aria-pressed={filter.status==='finished'} onClick={()=>update({status:filter.status==='finished'?'all':'finished'})}><span className="bi-status-dot"/><span>Concluídas</span><strong>{summary.finished}</strong></button>
        <div className="bi-status-bar" style={{background:summary.count ? undefined : "#e4ece0"}} aria-label={`${summary.active} em andamento e ${summary.finished} concluídas`}><span style={{width:`${summary.count ? 100*summary.active/summary.count : 0}%`}}/></div>
        <small>{summary.count ? number(summary.finished/summary.count*100,1) : '0'}% concluídas no recorte</small>
      </div></section>
    </div>
    <div className="bi-compare-heading"><h2><BarChart3 size={22}/> Comparativo da operação</h2><label>Comparar por<select value={measure} onChange={e=>setMeasure(e.target.value as Measure)}>{Object.entries(measures).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="bi-chart-grid">{ranking('plate','Por veículo')}{ranking('driver','Por motorista')}</div>
    <section className="bi-card"><div className="bi-compare-heading"><div><h2>Viagens deste recorte</h2><p>Abra uma viagem para conferir registros, fotos e correções.</p></div><button className="secondary" disabled={!scoped.length} onClick={exportSelection}><Download size={17}/> Exportar recorte</button></div>
      {!scoped.length ? <p className="bi-empty">Nenhuma viagem encontrada. Ajuste os filtros.</p> : <div className="bi-table-scroll"><table><thead><tr><th>Início</th><th>Motorista / veículo</th><th>Nota</th><th>Distância</th><th>Litros</th><th>Situação</th><th>Detalhes</th></tr></thead><tbody>{scoped.slice(0,limit).map(t=><tr key={t.id}><td>{date(t.startedAt)}</td><td><b>{t.driver}</b><br/>{t.plate}</td><td>{t.invoice}</td><td>{number(distance(t))} km</td><td>{number(totalLiters(t),2)} L</td><td>{t.endedAt?'Concluída':'Em andamento'}</td><td><button className="secondary" aria-label={`Abrir viagem de ${t.driver}, nota ${t.invoice}`} onClick={()=>onOpenTrip(t)}>Abrir viagem</button></td></tr>)}</tbody></table></div>}
      <div className="bi-table-footer"><small>{Math.min(limit,scoped.length)} de {scoped.length} viagens</small>{limit<scoped.length && <button className="secondary" onClick={()=>setLimit(n=>n+20)}>Mostrar mais</button>}</div>
    </section>
  </div>;
}

