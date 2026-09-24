import { describe, it, expect } from "vitest";
import { authorizeTripChange } from "../src/authorization";
import { validateTrip, type Trip, type Member } from "../src/domain";
const who: Member = {
  userId: "driver1",
  tenantId: "company1",
  name: "João",
  company: "Teste",
  role: "driver",
};
const base = (): Trip => ({
  id: "trip1",
  driverId: "driver1",
  driver: "João",
  plate: "ABC1D23",
  vehicleId: "ABC1D23",
  invoice: "123",
  startKm: 100,
  startPhoto: "start",
  origin: "",
  destination: "",
  startFull: false,
  startedAt: "2026-09-23T10:00:00Z",
  fills: [],
  notes: "",
  version: 0,
});
describe("permissões do motorista", () => {
  it("aceita início sem origem, destino ou campos administrativos", () => {
    expect(() => validateTrip(base())).not.toThrow();
    expect(() => authorizeTripChange(null, base(), who)).not.toThrow();
  });
  it("bloqueia autoria de outro motorista", () =>
    expect(() =>
      authorizeTripChange(null, { ...base(), driverId: "other" }, who),
    ).toThrow("autoria"));
  it("bloqueia adulteração de nota, km, placa e foto inicial", () => {
    for (const delta of [
      { invoice: "999" },
      { startKm: 1 },
      { plate: "XYZ1A23" },
      { startPhoto: "other" },
    ])
      expect(() =>
        authorizeTripChange(base(), { ...base(), ...delta }, who),
      ).toThrow("técnico");
  });
  it("permite um novo abastecimento com ambas as evidências", () => {
    const t = base();
    t.fills.push({
      id: "f1",
      at: "2026-09-23T11:00:00Z",
      odometer: 120,
      liters: 20,
      photo: "km",
      litersPhoto: "pump",
      full: false,
    });
    expect(() => validateTrip(t)).not.toThrow();
    expect(() => authorizeTripChange(base(), t, who)).not.toThrow();
  });
  it("exige foto inicial e foto dos litros", () => {
    expect(() => validateTrip({ ...base(), startPhoto: "" })).toThrow("foto");
    const t = base();
    t.fills.push({
      id: "f1",
      at: "2026-09-23T11:00:00Z",
      odometer: 120,
      liters: 20,
      photo: "km",
      litersPhoto: "",
      full: false,
    });
    expect(() => validateTrip(t)).toThrow("litros");
  });
  it("bloqueia alterações em abastecimentos anteriores", () => {
    const old = base();
    old.fills.push({
      id: "f1",
      at: "2026-09-23T11:00:00Z",
      odometer: 120,
      liters: 20,
      photo: "km",
      litersPhoto: "pump",
      full: false,
    });
    expect(() =>
      authorizeTripChange(
        old,
        { ...old, fills: [{ ...old.fills[0], liters: 1 }] },
        who,
      ),
    ).toThrow("técnico");
  });
  it("permite correção auditada pelo técnico, mantendo autoria", () =>
    expect(() =>
      authorizeTripChange(
        base(),
        { ...base(), invoice: "999" },
        { ...who, role: "technician", userId: "tech" },
      ),
    ).not.toThrow());
  it("bloqueia reabertura e alteração da data de início mesmo para técnico", () => {
    const admin = { ...who, role: "technician" as const };
    expect(() =>
      authorizeTripChange(
        { ...base(), endedAt: "2026-09-23T12:00:00Z" },
        base(),
        admin,
      ),
    ).toThrow("reaberta");
    expect(() =>
      authorizeTripChange(
        base(),
        { ...base(), startedAt: "2000-01-01" },
        admin,
      ),
    ).toThrow("data");
  });
});
