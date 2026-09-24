import { describe, expect, it } from "vitest";
import { efficiency, estimatedEfficiency, validateTrip, type Trip } from "../src/domain";
const base = (): Trip => ({
  id: "t1",
  driverId: "d1",
  vehicleId: "v1",
  driver: "Ana",
  plate: "ABC1D23",
  invoice: "123",
  startPhoto: "start-evidence",
  origin: "São Paulo",
  destination: "Campinas",
  startKm: 1000,
  startFull: true,
  startedAt: "2026-09-20T10:00:00Z",
  fills: [],
  notes: "",
  version: 0,
});
const fill = (km: number, liters: number, full: boolean, i = 1) => ({
  id: `f${i}`,
  odometer: km,
  liters,
  full,
  photo: "evidence",
  litersPhoto: "liters-evidence",
  at: `2026-09-20T${10 + i}:00:00Z`,
});
describe("consumo real", () => {
  it("estima km/L apenas em viagens concluídas com litros informados", () => {
    const t = {...base(), fills: [fill(1200, 40, false)]};
    expect(estimatedEfficiency(t).value).toBeNull();
    expect(estimatedEfficiency({...t, endKm: 1300, endedAt: "2026-09-20T14:00:00Z"})).toEqual({km:300,liters:40,value:7.5});
    expect(estimatedEfficiency({...t, fills: [], endKm: 1300, endedAt: "2026-09-20T14:00:00Z"}).value).toBeNull();
  });
  it("inclui os abastecimentos parciais entre tanques cheios", () => {
    const t = base();
    t.fills = [fill(1100, 20, false), fill(1300, 40, true, 2)];
    expect(efficiency(t).value).toBe(5);
  });
  it("exclui litros antes do primeiro tanque cheio quando a saída é desconhecida", () => {
    const t = base();
    t.startFull = false;
    t.fills = [fill(1100, 30, true), fill(1400, 50, true, 2)];
    expect(efficiency(t)).toEqual({ km: 300, liters: 50, value: 6 });
  });
  it("não apresenta uma média enganosa sem intervalo completo", () => {
    const t = base();
    t.startFull = false;
    t.fills = [fill(1400, 50, false)];
    expect(efficiency(t).value).toBeNull();
  });
  it("pondera múltiplos intervalos e ignora o último parcial", () => {
    const t = base();
    t.fills = [
      fill(1100, 20, true),
      fill(1500, 50, true, 2),
      fill(1600, 20, false, 3),
    ];
    expect(efficiency(t)).toEqual({ km: 500, liters: 70, value: 500 / 70 });
  });
});
describe("consistência dos registros", () => {
  it("aceita viagem com mais de um abastecimento e foto final", () => {
    const t = {
      ...base(),
      fills: [fill(1200, 40, false), fill(1400, 50, true, 2)],
      endKm: 1500,
      endPhoto: "end",
      endedAt: "2026-09-20T14:00:00Z",
    };
    expect(() => validateTrip(t)).not.toThrow();
  });
  it("impede hodômetro decrescente", () => {
    const t = base();
    t.fills = [fill(1100, 20, false), fill(1099, 40, true, 2)];
    expect(() => validateTrip(t)).toThrow("hodômetro");
  });
  it("exige fotos em cada etapa obrigatória", () => {
    const t = base();
    t.fills = [{ ...fill(1200, 40, false), photo: "" }];
    expect(() => validateTrip(t)).toThrow("foto");
    expect(() =>
      validateTrip({ ...base(), endKm: 1200, endedAt: "2026-09-20T14:00:00Z" }),
    ).toThrow("foto");
  });
  it("rejeita litros zero, números não finitos e eventos duplicados", () => {
    for (const liters of [0, -1, NaN, Infinity])
      expect(() =>
        validateTrip({ ...base(), fills: [fill(1200, liters, false)] }),
      ).toThrow();
    const f = fill(1200, 40, false);
    expect(() => validateTrip({ ...base(), fills: [f, f] })).toThrow(
      "duplicado",
    );
  });
  it("rejeita encerramento antes do último abastecimento", () => {
    expect(() =>
      validateTrip({
        ...base(),
        fills: [fill(1400, 50, true)],
        endKm: 1300,
        endPhoto: "end",
        endedAt: "2026-09-20T14:00:00Z",
      }),
    ).toThrow("final");
  });
});
