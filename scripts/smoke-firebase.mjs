// Integration smoke test in an explicitly separate tenant; no real driver data.
// Run only after provisioning the rotafrota-homologacao tenant using an admin.
import fs from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
const config = {
  apiKey: "AIzaSyDIUS5Z_2e_V3qwzvTOxPzH2O5QRPCGcGM",
  authDomain: "controle-de-pneus-cmc.firebaseapp.com",
  projectId: "controle-de-pneus-cmc",
  storageBucket: "controle-de-pneus-cmc.firebasestorage.app",
  appId: "1:947294126166:web:ea857f0e12a46a99053bf7",
};
const app = initializeApp(config, "smoke"),
  auth = getAuth(app),
  functions = getFunctions(app, "southamerica-east1"),
  db = getFirestore(app),
  storage = getStorage(app);
const tenantId = "rotafrota-homologacao";
async function call(name, data) {
  return (await httpsCallable(functions, name)(data)).data;
}
try {
  const { user } = await signInAnonymously(auth);
  const member = await call("rotafrotaDriverSession", { tenantId });
  if (member.role !== "driver") throw new Error("Unexpected role");
  console.log("PASS anonymous driver session");
  const photoPath = `rotafrota/${tenantId}/${user.uid}/${crypto.randomUUID()}.jpg`;
  await uploadBytes(
    ref(storage, photoPath),
    fs.readFileSync(".runtime/test-evidence.jpg"),
    { contentType: "image/jpeg" },
  );
  console.log("PASS private evidence upload");
  const trip = {
    id: crypto.randomUUID(),
    driverId: user.uid,
    driver: "TESTE AUTOMÁTICO — HOMOLOGAÇÃO",
    plate: "TST1A23",
    vehicleId: "TST1A23",
    invoice: "HOMOLOGACAO",
    origin: "",
    destination: "",
    startKm: 1000,
    startPhoto: photoPath,
    startFull: false,
    startedAt: new Date().toISOString(),
    fills: [],
    notes: "Teste técnico com imagem de exemplo. Não é uma viagem real.",
    version: 0,
  };
  const save = () =>
    call("rotafrotaSaveTrip", {
      tenantId,
      trip,
      reason: "Teste de integração Firebase",
    });
  await save();
  trip.version = 1;
  console.log("PASS start with initial photo");
  trip.fills.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    odometer: 1200,
    liters: 40,
    photo: photoPath,
    litersPhoto: photoPath,
    full: false,
  });
  await save();
  trip.version = 2;
  console.log("PASS refuel with two evidence fields");
  trip.endKm = 1300;
  trip.endPhoto = photoPath;
  trip.endedAt = new Date().toISOString();
  await save();
  trip.version = 3;
  console.log("PASS trip completion");
  const cancelledTrip = { ...trip, id: crypto.randomUUID(), version: 0, fills: [], startedAt: new Date().toISOString() };
  delete cancelledTrip.endKm;
  delete cancelledTrip.endPhoto;
  delete cancelledTrip.endedAt;
  const saveCancellation = (value) => call("rotafrotaSaveTrip", { tenantId, trip: value, reason: "Teste de cancelamento em homologação" });
  await saveCancellation(cancelledTrip);
  cancelledTrip.version = 1;
  cancelledTrip.fills = [...trip.fills];
  cancelledTrip.fills[0] = { ...cancelledTrip.fills[0], at: new Date().toISOString() };
  await saveCancellation(cancelledTrip);
  cancelledTrip.version = 2;
  cancelledTrip.cancelledAt = new Date().toISOString();
  cancelledTrip.cancellationReason = "Veículo de teste interrompido — homologação";
  await saveCancellation(cancelledTrip);
  cancelledTrip.version = 3;
  console.log("PASS cancellation preserves refuel without final evidence");
  const reopened = { ...cancelledTrip };
  delete reopened.cancelledAt;
  delete reopened.cancellationReason;
  try {
    await saveCancellation(reopened);
    throw new Error("REOPEN WAS ALLOWED");
  } catch (e) {
    if (e.message === "REOPEN WAS ALLOWED") throw e;
    if (!String(e.code).startsWith("functions/")) throw e;
  }
  const following = { ...reopened, id: crypto.randomUUID(), version: 0, fills: [], startedAt: new Date().toISOString() };
  await saveCancellation(following);
  await saveCancellation({ ...following, version: 1, cancelledAt: new Date().toISOString(), cancellationReason: "Encerramento do teste de liberação da placa" });
  console.log("PASS cancellation releases driver and plate for a new trip");
  const mine = await getDocs(
    query(
      collection(db, `rotafrota_companies/${tenantId}/trips`),
      where("driverId", "==", user.uid),
    ),
  );
  if (!mine.docs.some((d) => d.id === trip.id && d.data().data.version === 3))
    throw new Error("Trip not persisted");
  if (!mine.docs.some((d) => d.id === cancelledTrip.id && d.data().data.cancelledAt && d.data().data.fills.length === 1))
    throw new Error("Cancellation and evidence not persisted");
  console.log("PASS authenticated own-trip query");
  try {
    await getDocs(collection(db, `rotafrota_companies/${tenantId}/trips`));
    throw new Error("FLEET ACCESS WAS ALLOWED");
  } catch (e) {
    if (e.code !== "permission-denied") throw e;
  }
  console.log("PASS fleet query denied to driver");
  fs.writeFileSync(
    ".runtime/firebase-smoke-result.json",
    JSON.stringify(
      {
        tenantId,
        tripId: trip.id,
        userId: user.uid,
        at: new Date().toISOString(),
        passed: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (e) {
  console.error("FAIL", e.code || "", e.message);
  process.exit(1);
}
