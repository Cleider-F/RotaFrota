import type { Audit, Trip, Vehicle } from "./domain";
import { date, number } from "./domain";
import { Photo } from "./components";
export default function AuditDetails({
  entry,
  vehicles,
}: {
  entry: Audit;
  vehicles: Vehicle[];
}) {
  const describe = (t: Trip | null): Record<string, string> => {
    if (!t) return {};
    const values: Record<string, string> = {
      Motorista: t.driver,
      Veículo: t.plate,
      "Número da nota": t.invoice,
      "Hodômetro inicial": `${number(t.startKm)} km`,
      "Tanque cheio na saída": t.startFull ? "Sim" : "Não",
      Observações: t.notes || "—",
    };
    t.fills.forEach((f, i) => {
      values[`Abastecimento ${i + 1} · hodômetro`] = `${number(f.odometer)} km`;
      values[`Abastecimento ${i + 1} · volume`] = `${number(f.liters, 2)} L`;
      values[`Abastecimento ${i + 1} · tanque cheio`] = f.full ? "Sim" : "Não";
      values[`Abastecimento ${i + 1} · valor`] =
        f.cost === undefined ? "—" : `R$ ${number(f.cost, 2)}`;
    });
    values["Hodômetro final"] =
      t.endKm === undefined ? "Não encerrada" : `${number(t.endKm)} km`;
    values["Encerramento"] = t.endedAt ? date(t.endedAt) : "Em andamento";
    return values;
  };
  const before = describe(entry.before),
    after = describe(entry.after);
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((k) => before[k] !== after[k]);
  const replaced =
    entry.before?.fills.filter(
      (f) =>
        entry.after.fills.find((next) => next.id === f.id)?.photo !== f.photo,
    ) ?? [];
  return (
    <>
      <div className="table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Antes</th>
              <th>Depois</th>
            </tr>
          </thead>
          <tbody>
            {changed.map((key) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{before[key] ?? "—"}</td>
                <td>{after[key] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {replaced.map((f, i) => (
        <div key={f.id}>
          <p>Foto anterior do abastecimento · {number(f.odometer)} km</p>
          <Photo path={f.photo} label={`Evidência anterior ${i + 1}`} />
        </div>
      ))}
      {entry.before?.endPhoto &&
        entry.before.endPhoto !== entry.after.endPhoto && (
          <div>
            <p>Foto final anterior</p>
            <Photo
              path={entry.before.endPhoto}
              label="Evidência final anterior"
            />
          </div>
        )}
      {entry.before?.startPhoto &&
        entry.before.startPhoto !== entry.after.startPhoto && (
          <div>
            <p>Foto inicial anterior</p>
            <Photo
              path={entry.before.startPhoto}
              label="Evidência inicial anterior"
            />
          </div>
        )}
      {entry.before?.fills
        .filter(
          (f) =>
            entry.after.fills.find((next) => next.id === f.id)?.litersPhoto !==
            f.litersPhoto,
        )
        .map((f) => (
          <div key={`liters-${f.id}`}>
            <p>Foto anterior dos litros · {number(f.liters, 2)} L</p>
            <Photo path={f.litersPhoto} label="Evidência anterior dos litros" />
          </div>
        ))}
      {!changed.length && !replaced.length && (
        <p>Evidência atualizada. Os dados da viagem foram mantidos.</p>
      )}
    </>
  );
}
