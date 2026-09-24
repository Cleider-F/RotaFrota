import { totalLiters, type Trip } from './domain';

export const tripCsvColumns = [
  'DATA', 'HORÁRIO', 'Nº DA NOTA', 'KM INICIAL', 'KM FINAL',
  'ABASTECIMENTO EM L', 'KM DE ABASTECIMENTO', 'KM TOTAL', 'NOME DO MOTORISTA',
];

const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const decimal = (value: number) => value.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 });
const cell = (value: unknown) => `"${String(value ?? '')
  .replace(/^(\s*)([=+@-])/, "$1'$2")
  .replace(/^[\t\r\n]/, "'$&")
  .replaceAll('"', '""')}"`;

// One row per trip avoids counting its distance more than once when summing in Excel.
export function tripsToCsv(trips: Trip[]): string {
  const rows: unknown[][] = [
    ['CONTROLE DE KM E COMBUSTIVEL', ...Array(8).fill('')],
    tripCsvColumns,
    ...trips.map(trip => {
      const start = new Date(trip.startedAt);
      const finished = !!trip.endedAt && trip.endKm !== undefined;
      return [
        dateFormat.format(start), timeFormat.format(start), trip.invoice,
        decimal(trip.startKm), finished ? decimal(trip.endKm!) : '',
        totalLiters(trip).toFixed(2).replace('.', ','),
        trip.fills.map(fill => decimal(fill.odometer)).join(' | '),
        finished ? decimal(trip.endKm! - trip.startKm) : '', trip.driver,
      ];
    }),
  ];
  return '\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
