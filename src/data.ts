import { openDB } from "idb";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getBlob, ref, uploadBytes } from "firebase/storage";
import * as fb from "./firebase";
import type { Audit, Member, Trip, Vehicle } from "./domain";
import { validateTrip } from "./domain";
import { authorizeTripChange } from "./authorization";
import { demoVehicles, seedTrips } from "./seed";
export const isDemo = fb.isDemo;
const db = () =>
  openDB("rotafrota-demo-v2", 1, {
    upgrade(d) {
      d.createObjectStore("trips", { keyPath: "id" });
      d.createObjectStore("photos");
      d.createObjectStore("audit", { keyPath: "id" });
      d.createObjectStore("meta");
      d.createObjectStore("vehicles", { keyPath: "id" });
    },
  });
export const demoMember: Member = {
  userId: "demo-technician",
  tenantId: "demo",
  name: "Técnico de demonstração",
  company: "Transportadora Horizonte",
  role: "technician",
  canManageTechnicians: true,
};
const demoDriver: Member = {
  ...demoMember,
  userId: "demo-driver-new",
  name: "Motorista",
  role: "driver",
};
let currentAdmin: Member | null = null;
const demoAdminKey = "rotafrota-demo-admin";
export async function login(email: string, password: string) {
  if (isDemo) {
    if (
      email.toLowerCase() !== "tecnico@rotafrota.demo" ||
      password !== "RotaFrota123!"
    )
      throw new Error("Confira o e-mail e a senha de demonstração.");
    sessionStorage.setItem(demoAdminKey, "true");
    return;
  }
  await signInWithEmailAndPassword(fb.adminAuth, email.trim(), password);
  try {
    await httpsCallable(fb.functions, 'rotafrotaActivateAccount')({tenantId:fb.companyId});
  } catch (error) { await signOut(fb.adminAuth); throw error; }
  if (!(await member())) {
    await signOut(fb.adminAuth);
    throw new Error("Esta conta não possui permissão para o painel técnico.");
  }
}
export async function logout() {
  currentAdmin = null;
  if (isDemo) {
    sessionStorage.removeItem(demoAdminKey);
    window.dispatchEvent(new Event("rotafrota-signout"));
  } else await signOut(fb.adminAuth);
}
export async function resetPassword(email: string) {
  if (isDemo) throw new Error("Na demonstração, use a senha exibida acima.");
  if (!email.trim()) throw new Error("Digite seu e-mail no campo acima.");
  fb.adminAuth.languageCode = "pt";
  await sendPasswordResetEmail(fb.adminAuth, email.trim());
}
export function watchAdmin(callback: () => void) {
  if (isDemo) {
    window.addEventListener("rotafrota-signout", callback);
    return () => window.removeEventListener("rotafrota-signout", callback);
  }
  return onAuthStateChanged(fb.adminAuth, () => callback());
}
export async function member(): Promise<Member | null> {
  if (isDemo)
    return sessionStorage.getItem(demoAdminKey) === "true" ? demoMember : null;
  await fb.adminAuth.authStateReady();
  const user = fb.adminAuth.currentUser;
  if (!user || user.isAnonymous) return null;
  const snapshot = await getDoc(
    doc(fb.firestore, "rotafrota_members", user.uid),
  );
  if (
    !snapshot.exists() ||
    snapshot.data().role !== "technician" ||
    snapshot.data().active !== true
  )
    return null;
  const data = snapshot.data();
  currentAdmin = {
    userId: user.uid,
    tenantId: data.tenantId,
    name: data.name,
    company: data.company,
    role: "technician",
    canManageTechnicians: data.canManageTechnicians === true,
  };
  return currentAdmin;
}
let openingDriver: Promise<Member> | null = null;
export function driverMember(): Promise<Member> {
  if (isDemo) return Promise.resolve(demoDriver);
  if (!openingDriver)
    openingDriver = (async () => {
      await fb.driverAuth.authStateReady();
      if (!fb.driverAuth.currentUser) await signInAnonymously(fb.driverAuth);
      const result = await httpsCallable<{ tenantId: string }, Member>(
        fb.driverFunctions,
        "rotafrotaDriverSession",
      )({ tenantId: fb.companyId });
      return result.data;
    })().catch((e) => {
      openingDriver = null;
      throw new Error(friendlyError(e));
    });
  return openingDriver;
}
async function seed() {
  const d = await db();
  const tx = d.transaction(["meta", "trips", "vehicles"], "readwrite");
  if (!(await tx.objectStore("meta").get("seeded"))) {
    for (const t of seedTrips()) await tx.objectStore("trips").put(t);
    for (const v of demoVehicles) await tx.objectStore("vehicles").put(v);
    await tx.objectStore("meta").put(true, "seeded");
  }
  await tx.done;
  return d;
}
export async function load(): Promise<{ trips: Trip[]; vehicles: Vehicle[] }> {
  if (isDemo) {
    if (!(await member())) throw new Error("Entre no painel técnico.");
    const d = await seed();
    const trips = (await d.getAll("trips")) as Trip[];
    return {
      trips,
      vehicles: mergeVehicles(trips, await d.getAll("vehicles")),
    };
  }
  const who = currentAdmin ?? (await member());
  if (!who) throw new Error("Entre com seu e-mail e senha.");
  const base = `rotafrota_companies/${who.tenantId}`;
  const [t, v] = await Promise.all([
    getDocs(collection(fb.firestore, base, "trips")),
    getDocs(collection(fb.firestore, base, "vehicles")),
  ]);
  const trips = t.docs.map((d) => d.data().data as Trip);
  return {
    trips,
    vehicles: mergeVehicles(
      trips,
      v.docs.map((d) => d.data() as Vehicle),
    ),
  };
}
function mergeVehicles(trips: Trip[], vehicles: Vehicle[]): Vehicle[] {
  const all = [...vehicles];
  for (const t of trips)
    if (!all.some((v) => v.plate.replace("-", "") === t.plate))
      all.push({
        id: t.vehicleId,
        plate: t.plate,
        name: "Veículo informado pelo motorista",
        fuel: "Não informado",
      });
  return all;
}
export async function loadDriver(who: Member): Promise<Trip[]> {
  if (isDemo)
    return ((await (await seed()).getAll("trips")) as Trip[]).filter(
      (t) => t.driverId === who.userId,
    );
  const q = query(
    collection(
      fb.driverFirestore,
      "rotafrota_companies",
      who.tenantId,
      "trips",
    ),
    where("driverId", "==", who.userId),
  );
  return (await getDocs(q)).docs.map((d) => d.data().data as Trip);
}
function changed() {
  window.dispatchEvent(new Event("rotafrota-change"));
  const channel = new BroadcastChannel("rotafrota-demo-v2");
  channel.postMessage("change");
  channel.close();
}
export async function deleteTrip(trip: Trip) {
  const who = await member();
  if (!who || who.role !== 'technician' || !who.canManageTechnicians)
    throw new Error('Somente administradores podem excluir viagens.');
  if (isDemo) {
    const d = await seed(), tx = d.transaction(['trips', 'meta'], 'readwrite');
    const before = await tx.objectStore('trips').get(trip.id) as Trip | undefined;
    if (!before || before.version !== trip.version) {
      tx.abort();
      throw new Error('Esta viagem foi alterada ou excluída. Atualize a página.');
    }
    await tx.objectStore('meta').put({trip:before,deletedAt:new Date().toISOString()}, `deleted-trip:${trip.id}`);
    await tx.objectStore('trips').delete(trip.id);
    await tx.done;
    changed();
  } else {
    await httpsCallable(fb.functions, 'rotafrotaDeleteTrip')({tenantId:who.tenantId,tripId:trip.id,version:trip.version});
  }
}
export async function saveTrip(t: Trip, who: Member, reason: string) {
  validateTrip(t);
  if (reason.trim().length < 5)
    throw new Error("Informe o motivo da alteração.");
  if (isDemo) {
    if (who.role === "technician" && !(await member()))
      throw new Error("Entre no painel técnico.");
    const d = await seed(),
      tx = d.transaction(["trips", "audit", "meta"], "readwrite"),
      before = (await tx.objectStore("trips").get(t.id)) as Trip | undefined;
    if (await tx.objectStore('meta').get(`deleted-trip:${t.id}`)) {
      tx.abort();
      throw new Error('Esta viagem foi excluída pelo administrador.');
    }
    if ((before?.version ?? 0) !== t.version) {
      tx.abort();
      throw new Error("Esta viagem foi alterada. Atualize e tente novamente.");
    }
    try {
      authorizeTripChange(before ?? null, t, who);
    } catch (e) {
      tx.abort();
      throw e;
    }
    const others = (await tx.objectStore("trips").getAll()) as Trip[];
    if (
      !t.endedAt && !t.cancelledAt &&
      others.some(
        (x) =>
          x.id !== t.id &&
          !x.endedAt && !x.cancelledAt &&
          (x.plate === t.plate || x.driverId === t.driverId),
      )
    ) {
      tx.abort();
      throw new Error(
        "Já existe uma viagem aberta para esta placa ou motorista.",
      );
    }
    const after = { ...t, version: t.version + 1 };
    await tx.objectStore("trips").put(after);
    await tx
      .objectStore("audit")
      .put({
        id: crypto.randomUUID(),
        tripId: t.id,
        at: new Date().toISOString(),
        actor: who.role === "driver" ? t.driver : who.name,
        reason,
        before: before ?? null,
        after,
      } satisfies Audit);
    await tx.done;
    changed();
    return;
  }
  try {
    await httpsCallable(
      who.role === "driver" ? fb.driverFunctions : fb.functions,
      "rotafrotaSaveTrip",
    )({ tenantId: who.tenantId, trip: t, reason });
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
export async function saveVehicle(v: Vehicle, who: Member) {
  if (!v.name.trim() || !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v.plate))
    throw new Error("Informe uma placa e um modelo válidos.");
  if (isDemo) {
    if (!(await member())) throw new Error("Acesso técnico obrigatório.");
    const d = await seed();
    if (
      ((await d.getAll("vehicles")) as Vehicle[]).some(
        (x) => x.plate.replace("-", "") === v.plate,
      )
    )
      throw new Error("Placa já cadastrada.");
    await d.put("vehicles", v);
    changed();
    return;
  }
  try {
    await httpsCallable(
      fb.functions,
      "rotafrotaSaveVehicle",
    )({ vehicle: v, tenantId: who.tenantId });
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
export async function audit(tripId: string): Promise<Audit[]> {
  if (isDemo) {
    if (!(await member())) throw new Error("Acesso técnico obrigatório.");
    return ((await (await db()).getAll("audit")) as Audit[])
      .filter((a) => a.tripId === tripId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }
  const who = currentAdmin ?? (await member());
  if (!who) throw new Error("Entre no painel técnico.");
  return (
    await getDocs(
      collection(
        fb.firestore,
        "rotafrota_companies",
        who.tenantId,
        "trips",
        tripId,
        "audit",
      ),
    )
  ).docs
    .map((d) => d.data() as Audit)
    .sort((a, b) => b.at.localeCompare(a.at));
}
export async function upload(file: File, who: Member): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("A foto deve ter até 15 MB.");
  const bitmap = await createImageBitmap(file),
    scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Não foi possível ler a foto.")),
      "image/jpeg",
      0.85,
    ),
  );
  if (isDemo) {
    const id = crypto.randomUUID();
    await (await db()).put("photos", blob, id);
    return id;
  }
  const path = `rotafrota/${who.tenantId}/${who.userId}/${crypto.randomUUID()}.jpg`;
  try {
    await uploadBytes(
      ref(who.role === "driver" ? fb.driverStorage : fb.storage, path),
      blob,
      { contentType: "image/jpeg" },
    );
    return path;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}
export async function photoURL(path: string): Promise<string | null> {
  if (path === "demo-evidence") return null;
  if (isDemo) {
    const blob = await (await db()).get("photos", path);
    return blob ? URL.createObjectURL(blob) : null;
  }
  return URL.createObjectURL(
    await getBlob(ref(fb.storage, path), 5 * 1024 * 1024),
  );
}
function localSubscribe(refresh: () => void) {
  const c = new BroadcastChannel("rotafrota-demo-v2");
  c.onmessage = refresh;
  window.addEventListener("rotafrota-change", refresh);
  return () => {
    c.close();
    window.removeEventListener("rotafrota-change", refresh);
  };
}
export function subscribe(refresh: () => void, onStatus: (s: string) => void) {
  if (isDemo) {
    onStatus("Demonstração local");
    return localSubscribe(refresh);
  }
  if (!currentAdmin) return () => {};
  const base = `rotafrota_companies/${currentAdmin.tenantId}`;
  const unsubs = ["trips", "vehicles"].map((name) =>
    onSnapshot(
      collection(fb.firestore, base, name),
      { includeMetadataChanges: true },
      (s) => {
        onStatus(s.metadata.fromCache ? "Reconectando…" : "Conectado ao vivo");
        refresh();
      },
      () => onStatus("Falha de conexão"),
    ),
  );
  return () => unsubs.forEach((fn) => fn());
}
export function subscribeDriver(
  who: Member,
  refresh: () => void,
  onError: (e: string) => void,
) {
  if (isDemo) return localSubscribe(refresh);
  return onSnapshot(
    query(
      collection(
        fb.driverFirestore,
        "rotafrota_companies",
        who.tenantId,
        "trips",
      ),
      where("driverId", "==", who.userId),
    ),
    () => refresh(),
    (e) => onError(friendlyError(e)),
  );
}
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === 'functions/permission-denied') return e.message || 'Este e-mail não possui autorização. Entre em contato com o administrador.';
  if (e.code === "auth/invalid-credential")
    return "E-mail ou senha incorretos.";
  if (e.code === "auth/operation-not-allowed")
    return "O acesso do motorista ainda precisa ser habilitado no Firebase. Avise o responsável.";
  if (e.code === "auth/invalid-api-key")
    return "A chave do Firebase não foi aceita. Confira a configuração do projeto.";
  if (
    [
      "functions/not-found",
      "functions/unavailable",
      "functions/internal",
    ].includes(e.code ?? "")
  )
    return "Não foi possível conectar ao serviço. Tente novamente ou avise o responsável.";
  if (
    e.code?.includes("permission-denied") ||
    e.code === "storage/unauthorized"
  )
    return "Acesso não autorizado. Avise o responsável pela frota.";
  if (e.code?.includes("network"))
    return "Sem conexão. Seus dados ainda não foram enviados. Tente novamente.";
  return e.message || "Não foi possível salvar. Tente novamente.";
}


export type TechnicianAccess = {id: string; userId?: string; name: string; email: string; active: boolean; manager: boolean; registered: boolean};
export async function manageTechnicians(data: {action: 'list' | 'authorize' | 'update'; name?: string; email?: string; manager?: boolean; active?: boolean}) {
  if (isDemo) throw new Error('A gestão de acessos está disponível somente na versão conectada ao Firebase.');
  return (await httpsCallable<typeof data, {users?: TechnicianAccess[]; truncated?: boolean; currentUserId?: string}>(fb.functions, 'rotafrotaManageTechnicians')(data)).data;
}
export async function registerAccount(email: string, password: string) {
  if (isDemo) throw new Error('Cadastro indisponível na demonstração.');
  await httpsCallable(fb.functions, 'rotafrotaRegisterAccount')({email:email.trim(), password, tenantId:fb.companyId});
  await login(email,password);
}
