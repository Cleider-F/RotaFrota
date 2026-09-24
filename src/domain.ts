export type Role = "technician" | "driver";
export type Member = {
  userId: string;
  tenantId: string;
  name: string;
  company: string;
  role: Role;
};
export type Vehicle = { id: string; plate: string; name: string; fuel: string };
export type Fill = {
  id: string;
  at: string;
  odometer: number;
  liters: number;
  full: boolean;
  photo: string;
  litersPhoto: string;
  cost?: number;
};
export type Trip = {
  id: string;
  vehicleId: string;
  driverId: string;
  driver: string;
  plate: string;
  invoice: string;
  startPhoto: string;
  destination: string;
  origin: string;
  startKm: number;
  startFull: boolean;
  startedAt: string;
  fills: Fill[];
  endKm?: number;
  endPhoto?: string;
  endedAt?: string;
  notes: string;
  version: number;
};
export type Audit = {
  id: string;
  tripId: string;
  at: string;
  actor: string;
  reason: string;
  before: Trip | null;
  after: Trip;
};
export const number = (n: number, digits = 0) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
export const date = (s: string) =>
  new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const totalLiters = (t: Trip) =>
  t.fills.reduce((sum, f) => sum + f.liters, 0);
export const distance = (t: Trip) =>
  (t.endKm ?? t.fills.at(-1)?.odometer ?? t.startKm) - t.startKm;
export function estimatedEfficiency(t: Trip) {
  const liters = t.endedAt ? totalLiters(t) : 0,
    km = liters > 0 ? distance(t) : 0;
  return { liters, km, value: liters > 0 ? km / liters : null };
}
export function efficiency(t: Trip): {
  km: number;
  liters: number;
  value: number | null;
} {
  let baseline: number | null = t.startFull ? t.startKm : null;
  let pending = 0,
    km = 0,
    liters = 0;
  for (const f of t.fills) {
    if (baseline !== null) pending += f.liters;
    if (f.full) {
      if (baseline !== null && pending > 0 && f.odometer > baseline) {
        km += f.odometer - baseline;
        liters += pending;
      }
      baseline = f.odometer;
      pending = 0;
    }
  }
  return { km, liters, value: liters > 0 ? km / liters : null };
}
export function validateTrip(t: Trip) {
  if (
    !t.driver.trim() ||
    !t.vehicleId ||
    !t.invoice?.trim() ||
    !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(t.plate ?? "")
  )
    throw new Error("Preencha seu nome, uma placa válida e o número da nota.");
  if (!t.startPhoto)
    throw new Error("Adicione a foto do painel mostrando o km inicial.");
  if (t.driver.length > 100 || t.invoice.length > 100)
    throw new Error("Nome ou número da nota muito longo.");
  if (!Number.isFinite(t.startKm) || t.startKm < 0 || t.startKm > 9999999)
    throw new Error("Informe um hodômetro inicial válido.");
  if (!Number.isFinite(Date.parse(t.startedAt)))
    throw new Error("Data inicial inválida.");
  let km = t.startKm,
    at = t.startedAt;
  const ids = new Set<string>();
  for (const f of t.fills) {
    if (ids.has(f.id)) throw new Error("Abastecimento duplicado.");
    ids.add(f.id);
    if (!Number.isFinite(f.odometer) || f.odometer < km || f.odometer > 9999999)
      throw new Error("O hodômetro não pode diminuir ao longo da viagem.");
    if (!Number.isFinite(f.liters) || f.liters <= 0 || f.liters > 2000)
      throw new Error("Informe uma quantidade entre 0 e 2.000 litros.");
    if (f.cost !== undefined && (!Number.isFinite(f.cost) || f.cost < 0))
      throw new Error("Valor do abastecimento inválido.");
    if (!f.photo) throw new Error("Anexe a foto do abastecimento.");
    if (!f.litersPhoto)
      throw new Error("Adicione a foto da bomba ou nota mostrando os litros.");
    if (!Number.isFinite(Date.parse(f.at)) || new Date(f.at) < new Date(at))
      throw new Error("Data de abastecimento inválida.");
    km = f.odometer;
    at = f.at;
  }
  if (t.endKm !== undefined) {
    if (!Number.isFinite(t.endKm) || t.endKm < km || t.endKm > 9999999)
      throw new Error(
        "O hodômetro final deve ser igual ou maior que o último registro.",
      );
    if (!t.endPhoto) throw new Error("Anexe a foto do hodômetro final.");
    if (
      !t.endedAt ||
      !Number.isFinite(Date.parse(t.endedAt)) ||
      new Date(t.endedAt) < new Date(at)
    )
      throw new Error("Data de encerramento inválida.");
  } else if (t.endedAt || t.endPhoto)
    throw new Error("Informe o hodômetro final para encerrar.");
}
