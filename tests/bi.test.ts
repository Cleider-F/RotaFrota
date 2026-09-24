import { describe, expect, it } from 'vitest';
import { filterBiTrips, groupBi, summarizeBi, operationDay, type BiFilter } from '../src/bi';
import type { Trip } from '../src/domain';
const trip = (id:string,km:number,liters:number,ended=true):Trip => ({id,driverId:id,driver:'Ana',plate:'ABC1D23',invoice:id,vehicleId:'ABC1D23',startKm:100,startPhoto:'p',startFull:false,startedAt:'2026-09-23T02:30:00Z',origin:'',destination:'',notes:'',version:1,fills:[{id:'f',at:'2026-09-23T03:30:00Z',odometer:100+km,liters,photo:'p',litersPhoto:'p',full:false}],...(ended?{endKm:100+km,endedAt:'2026-09-23T04:30:00Z',endPhoto:'p'}:{})});
const all:BiFilter={from:'',to:'',plate:'',driver:'',day:'',status:'all'};
describe('BI da operação',()=>{
  it('pondera rendimento por litros e exclui viagens abertas da estimativa',()=>{
    const summary=summarizeBi([trip('a',100,10),trip('b',300,60),trip('c',50,5,false)]);
    expect(summary.km).toBe(450);expect(summary.liters).toBe(75);expect(summary.efficiency).toBeCloseTo(400/70);expect(summary.eligible).toBe(2);expect(summary.active).toBe(1);
  });
  it('não inventa rendimento quando não há litros ou viagens',()=>{
    expect(summarizeBi([]).efficiency).toBeNull();expect(summarizeBi([{...trip('a',100,0),fills:[]}]).efficiency).toBeNull();
  });
  it('filtra por dia de Brasília, limites inclusivos e seleção combinada',()=>{
    const t=trip('a',100,10);expect(operationDay(t.startedAt)).toBe('2026-09-22');
    expect(filterBiTrips([t],{...all,from:'2026-09-22',to:'2026-09-22',plate:t.plate,driver:'ana',status:'finished'})).toHaveLength(1);
    for(const f of [{from:'2026-09-23'},{plate:'XYZ1234'},{driver:'outro'},{status:'active'},{day:'2026-09-23'}]) expect(filterBiTrips([t],{...all,...f})).toHaveLength(0);
  });
  it('agrupa nomes informados sem depender da sessão do aparelho',()=>{
    const a=trip('a',100,10),b={...trip('b',200,20),driver:' ANA '};
    expect(groupBi([a,b],'driver')).toHaveLength(1);expect(groupBi([a,b],'driver')[0].km).toBe(300);
    expect(groupBi([a,{...b,plate:'XYZ1234'}],'plate')).toHaveLength(2);
  });
});
