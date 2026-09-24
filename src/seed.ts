import type { Trip, Vehicle } from "./domain";
export const demoVehicles: Vehicle[] = [
  { id: "v1", plate: "RFT-2A41", name: "Volvo FH 540", fuel: "Diesel S10" },
  { id: "v2", plate: "KLM-8B92", name: "Scania R 450", fuel: "Diesel S10" },
  {
    id: "v3",
    plate: "GHT-4C18",
    name: "Mercedes-Benz Actros",
    fuel: "Diesel S10",
  },
  {
    id: "v4",
    plate: "PQZ-1D76",
    name: "Volkswagen Delivery",
    fuel: "Diesel S10",
  },
  { id: "v5", plate: "BNR-6E35", name: "Fiat Strada", fuel: "Gasolina" },
];
export function seedTrips(): Trip[] {
  const names = [
    "Carlos Oliveira",
    "Marcos Santos",
    "Ana Pereira",
    "Rafael Costa",
    "Juliana Lima",
    "Carlos Oliveira",
    "Ana Pereira",
    "Marcos Santos",
  ];
  const cities = [
    "Campinas, SP",
    "Curitiba, PR",
    "Ribeirão Preto, SP",
    "Santos, SP",
    "Sorocaba, SP",
    "São José dos Campos, SP",
    "Belo Horizonte, MG",
    "Londrina, PR",
  ];
  return names.map((name, i) => {
    const start = 48200 + i * 3400,
      traveled = [218, 405, 312, 162, 184, 208, 586, 532][i];
    const began = new Date();
    began.setDate(began.getDate() - (i > 2 ? i - 2 : 0));
    began.setHours(6 + i, 10, 0, 0);
    const liters =
      i === 4 ? 18.4 : Math.round((traveled / (3.1 + i * 0.12)) * 10) / 10;
    return {
      id: `demo-${i + 1}`,
      vehicleId: demoVehicles[i % 5].id,
      driverId: i === 0 ? "demo-driver" : `driver-${i}`,
      driver: name,
      plate: demoVehicles[i % 5].plate.replace("-", ""),
      invoice: String(10240 + i),
      startPhoto: "demo-evidence",
      origin: "São Paulo, SP",
      destination: cities[i],
      startKm: start,
      startFull: true,
      startedAt: began.toISOString(),
      fills: [
        {
          id: `fill-${i}`,
          at: new Date(+began + 3600000).toISOString(),
          odometer: start + traveled - (i > 2 ? 20 : 0),
          liters,
          full: true,
          photo: "demo-evidence",
          litersPhoto: "demo-evidence",
          cost: Math.round(liters * 6.19 * 100) / 100,
        },
      ],
      ...(i > 2
        ? {
            endKm: start + traveled,
            endPhoto: "demo-evidence",
            endedAt: new Date(+began + 7200000).toISOString(),
          }
        : {}),
      notes: "",
      version: 1,
    };
  });
}
