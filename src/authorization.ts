import type { Member, Trip } from "./domain";
export function authorizeTripChange(
  before: Trip | null,
  next: Trip,
  who: Member,
) {
  if (next.driverId !== (before?.driverId ?? who.userId))
    throw new Error("A autoria da viagem não pode ser alterada.");
  if (before && before.startedAt !== next.startedAt)
    throw new Error("A data inicial não pode ser alterada.");
  if (before?.endedAt && !next.endedAt)
    throw new Error("Uma viagem concluída não pode ser reaberta.");
  if (before?.cancelledAt && (before.cancelledAt !== next.cancelledAt || before.cancellationReason !== next.cancellationReason)) throw new Error('O cancelamento não pode ser removido ou alterado.');
  if (next.cancelledAt && (!before || before.endedAt)) throw new Error('Somente uma viagem em andamento pode ser cancelada.');
  if (who.role === "technician") return;
  if (next.driverId !== who.userId)
    throw new Error("Você só pode registrar sua própria viagem.");
  if (!before) {
    if (next.fills.length || next.endedAt || next.endKm !== undefined)
      throw new Error("Inicie a viagem antes de registrar as próximas etapas.");
    return;
  }
  if (before.endedAt || before.cancelledAt)
    throw new Error("A viagem já foi finalizada. Peça a correção ao técnico.");
  const immutable = [
    "driver",
    "plate",
    "invoice",
    "vehicleId",
    "startKm",
    "startPhoto",
    "startFull",
    "origin",
    "destination",
  ] as const;
  if (immutable.some((k) => before[k] !== next[k]))
    throw new Error("Somente o técnico pode corrigir os dados anteriores.");
  if (
    next.fills.length < before.fills.length ||
    next.fills.length > before.fills.length + 1
  )
    throw new Error("Envie um abastecimento por vez.");
  const canonical = (value: unknown) =>
    JSON.stringify(value, Object.keys(value as object).sort());
  if (before.fills.some((f, i) => canonical(f) !== canonical(next.fills[i])))
    throw new Error(
      "Somente o técnico pode corrigir abastecimentos anteriores.",
    );
  if (next.fills.length > before.fills.length && (next.endedAt || next.cancelledAt))
    throw new Error("Envie o abastecimento antes de finalizar.");
}
