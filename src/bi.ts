import { distance, estimatedEfficiency, totalLiters, type Trip } from './domain';
export const operationDay = (iso: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(iso));
export const driverKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
export type BiFilter = {from: string; to: string; plate: string; driver: string; status: string; day: string};
export function filterBiTrips(trips: Trip[], f: BiFilter) {
  return trips.filter(t => {
    const day = operationDay(t.startedAt);
    return (!f.from || day >= f.from) && (!f.to || day <= f.to) && (!f.day || day === f.day)
      && (!f.plate || t.plate === f.plate) && (!f.driver || driverKey(t.driver) === f.driver)
      && (f.status === 'all' || (f.status === 'finished' ? !!t.endedAt : f.status === 'cancelled' ? !!t.cancelledAt : !t.endedAt && !t.cancelledAt));
  });
}
export function summarizeBi(trips: Trip[]) {
  const closed = trips.filter(t => t.endedAt);
  const eligible = closed.map(estimatedEfficiency);
  const eligibleKm = eligible.reduce((sum,v) => sum + v.km, 0);
  const eligibleLiters = eligible.reduce((sum,v) => sum + v.liters, 0);
  return { count:trips.length, active:trips.filter(t=>!t.endedAt && !t.cancelledAt).length, cancelled:trips.filter(t=>t.cancelledAt).length, finished:closed.length,
    km:trips.reduce((sum,t) => sum + distance(t),0), liters:trips.reduce((sum,t) => sum + totalLiters(t),0),
    fills:trips.reduce((sum,t) => sum + t.fills.length,0),
    efficiency:eligibleLiters > 0 ? eligibleKm / eligibleLiters : null,
    eligible:eligible.filter(e => e.value !== null).length,
  };
}
export function groupBi(trips: Trip[], kind:'plate'|'driver'|'day') {
  const map = new Map<string,{label:string;trips:Trip[]}>();
  for (const t of trips) {
    const key = kind === 'plate' ? t.plate : kind === 'driver' ? driverKey(t.driver) : operationDay(t.startedAt);
    const existing = map.get(key) ?? {label:kind === 'driver' ? t.driver.trim() : key,trips:[]};
    existing.trips.push(t); map.set(key,existing);
  }
  return [...map].map(([key,v]) => ({key,label:v.label,...summarizeBi(v.trips)}));
}
