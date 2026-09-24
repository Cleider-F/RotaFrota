import { describe, it, expect } from 'vitest';
import { tripsToCsv, tripCsvColumns } from '../src/trip-csv';
import type { Trip } from '../src/domain';
const trip: Trip = {
  id:'1', driverId:'driver', driver:'João Silva', plate:'ABC1D23', vehicleId:'ABC1D23',
  invoice:'1234', startKm:1000, startPhoto:'start', startFull:false,
  startedAt:'2026-09-23T13:30:00Z', origin:'', destination:'', notes:'', version:1,
  endKm:1400, endPhoto:'end', endedAt:'2026-09-23T20:00:00Z',
  fills:[{id:'f1',at:'2026-09-23T14:00:00Z',odometer:1100,liters:20.25,photo:'p',litersPhoto:'p2',full:false},
    {id:'f2',at:'2026-09-23T17:00:00Z',odometer:1250,liters:30.5,photo:'p',litersPhoto:'p2',full:false}],
};
describe('relatório CSV de km e combustível', () => {
  it('exporta título, colunas na ordem, data local e múltiplas paradas sem duplicar a viagem', () => {
    const lines = tripsToCsv([trip]).split('\r\n');
    expect(lines[0]).toBe('\ufeff"CONTROLE DE KM E COMBUSTIVEL";"";"";"";"";"";"";"";""');
    expect(lines[1]).toBe(tripCsvColumns.map(c=>`"${c}"`).join(';'));
    expect(lines[2]).toBe('"23/09/2026";"10:30";"1234";"1000";"1400";"50,75";"1100 | 1250";"400";"João Silva"');
    expect(lines).toHaveLength(4);
  });
  it('deixa encerramento e hodômetro de abastecimento vazios quando não existem', () => {
    const csv = tripsToCsv([{...trip,endKm:undefined,endedAt:undefined,endPhoto:undefined,fills:[]}]);
    expect(csv).toContain(';"1000";"";"0,00";"";"";"João Silva"');
    expect(tripsToCsv([]).split('\r\n')).toHaveLength(3);
  });
  it('preserva aspas e separadores e neutraliza fórmulas em campos digitados', () => {
    const csv = tripsToCsv([{...trip,driver:'  =HYPERLINK("teste");nome',invoice:'+123'}]);
    expect(csv).toContain('"\'+123"');
    expect(csv).toContain('"  \'=HYPERLINK(""teste"");nome"');
  });
});
