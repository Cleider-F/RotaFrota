import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createHash } from "node:crypto";
import { requireAccessManager, validateTechnicianTarget, requireEmailAuthorization, validateSignupPassword } from "../../src/technician-policy";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  validateTrip,
  type Trip,
  type Member,
  type Vehicle,
} from "../../src/domain";
import { authorizeTripChange } from "../../src/authorization";
initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 3 });
const db = getFirestore();
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
function signedIn(uid: string | undefined): asserts uid is string {
  if (!uid)
    throw new HttpsError("unauthenticated", "Identifique-se antes de enviar.");
}
async function getMember(uid: string, tenantId: unknown): Promise<Member> {
  if (!identifier(tenantId))
    throw new HttpsError("invalid-argument", "Empresa inválida.");
  const admin = await db.doc(`rotafrota_members/${uid}`).get();
  if (
    admin.exists &&
    admin.get("active") === true &&
    admin.get("role") === "technician" &&
    admin.get("tenantId") === tenantId
  )
    return {
      userId: uid,
      tenantId,
      name: admin.get("name"),
      company: admin.get("company"),
      role: "technician",
    };
  const driver = await db
    .doc(`rotafrota_companies/${tenantId}/drivers/${uid}`)
    .get();
  if (driver.exists && driver.get("active") === true)
    return {
      userId: uid,
      tenantId,
      name: "Motorista",
      company: driver.get("company"),
      role: "driver",
    };
  throw new HttpsError(
    "permission-denied",
    "Seu acesso não foi autorizado para esta empresa.",
  );
}
export const rotafrotaDriverSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  signedIn(uid);
  const tenantId = request.data?.tenantId;
  if (!identifier(tenantId))
    throw new HttpsError("invalid-argument", "Empresa inválida.");
  const company = await db.doc(`rotafrota_companies/${tenantId}`).get();
  if (!company.exists || company.get("driverAccessEnabled") !== true)
    throw new HttpsError(
      "failed-precondition",
      "O acesso da frota ainda não foi ativado. Avise o responsável.",
    );
  const reference = db.doc(`rotafrota_companies/${tenantId}/drivers/${uid}`);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists && existing.get("active") !== true)
      throw new HttpsError(
        "permission-denied",
        "Acesso suspenso. Fale com o responsável.",
      );
    if (!existing.exists)
      transaction.create(reference, {
        active: true,
        company: company.get("name"),
        createdAt: FieldValue.serverTimestamp(),
      });
  });
  return {
    userId: uid,
    tenantId,
    name: "Motorista",
    company: company.get("name"),
    role: "driver",
  } satisfies Member;
});
function evidence(t: Trip): string[] {
  return [
    t.startPhoto,
    ...t.fills.flatMap((f) => [f.photo, f.litersPhoto]),
    ...(t.endPhoto ? [t.endPhoto] : []),
  ];
}
function checkShape(t: Trip) {
  if (
    !t ||
    !identifier(t.id) ||
    !identifier(t.driverId) ||
    !Array.isArray(t.fills) ||
    t.fills.length > 200 ||
    !Number.isInteger(t.version) ||
    t.version < 0 ||
    typeof t.startFull !== "boolean" ||
    typeof t.origin !== "string" ||
    typeof t.destination !== "string" ||
    typeof t.notes !== "string" ||
    t.notes.length > 1000
  )
    throw new Error("Registro inválido.");
  for (const f of t.fills)
    if (!f || !identifier(f.id) || typeof f.full !== "boolean")
      throw new Error("Abastecimento inválido.");
  if (t.vehicleId !== t.plate)
    throw new Error("A placa e o veículo devem coincidir.");
  if (
    new Date(t.startedAt).getTime() > Date.now() + 300000 ||
    t.fills.some((f) => new Date(f.at).getTime() > Date.now() + 300000) ||
    (t.endedAt && new Date(t.endedAt).getTime() > Date.now() + 300000)
  )
    throw new Error("Data do registro inválida. Confira o relógio do celular.");
  if (JSON.stringify(t).length > 250000)
    throw new Error("Registro muito grande.");
  validateTrip(t);
}
export const rotafrotaSaveTrip = onCall(async (request) => {
  const uid = request.auth?.uid;
  signedIn(uid);
  const who = await getMember(uid, request.data?.tenantId),
    trip = request.data?.trip as Trip,
    reason = request.data?.reason;
  try {
    checkShape(trip);
    if (
      typeof reason !== "string" ||
      reason.trim().length < 5 ||
      reason.length > 500
    )
      throw new Error("Informe o motivo da alteração.");
  } catch (e) {
    throw new HttpsError("invalid-argument", (e as Error).message);
  }
  const base = `rotafrota_companies/${who.tenantId}`,
    reference = db.doc(`${base}/trips/${trip.id}`),
    previousSnapshot = await reference.get(),
    previous = previousSnapshot.exists
      ? (previousSnapshot.get("data") as Trip)
      : null;
  try {
    authorizeTripChange(previous, trip, who);
  } catch (e) {
    throw new HttpsError("permission-denied", (e as Error).message);
  }
  const oldPhotos = new Set(previous ? evidence(previous) : []);
  const changedPhotos = [...new Set(evidence(trip))].filter(
    (path) => !oldPhotos.has(path),
  );
  for (const path of changedPhotos) {
    if (
      typeof path !== "string" ||
      !path.startsWith(`rotafrota/${who.tenantId}/`) ||
      (who.role === "driver" &&
        !path.startsWith(`rotafrota/${who.tenantId}/${uid}/`)) ||
      !/^rotafrota\/[\w-]+\/[\w-]+\/[\w-]+\.jpg$/.test(path)
    )
      throw new HttpsError(
        "permission-denied",
        "Foto inválida ou pertencente a outra pessoa.",
      );
    try {
      const [metadata] = await getStorage()
        .bucket("controle-de-pneus-cmc.firebasestorage.app")
        .file(path)
        .getMetadata();
      if (
        metadata.contentType !== "image/jpeg" ||
        Number(metadata.size) > 5242880 ||
        Number(metadata.size) <= 0
      )
        throw new Error();
    } catch {
      throw new HttpsError(
        "invalid-argument",
        "Uma das fotos não foi recebida. Tente enviar novamente.",
      );
    }
  }
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference),
      before = snapshot.exists ? (snapshot.get("data") as Trip) : null;
    if ((before?.version ?? 0) !== trip.version)
      throw new HttpsError(
        "aborted",
        "Esta viagem foi alterada. Atualize a página antes de tentar novamente.",
      );
    try {
      authorizeTripChange(before, trip, who);
    } catch (e) {
      throw new HttpsError("permission-denied", (e as Error).message);
    }
    const driverLock = db.doc(`${base}/activeDrivers/${trip.driverId}`),
      plateLock = db.doc(`${base}/activePlates/${trip.plate}`);
    const [driverState, plateState] = await Promise.all([
      transaction.get(driverLock),
      transaction.get(plateLock),
    ]);
    const oldPlate =
      before && before.plate !== trip.plate
        ? db.doc(`${base}/activePlates/${before.plate}`)
        : null;
    const oldState = oldPlate ? await transaction.get(oldPlate) : null;
    if (
      !trip.endedAt &&
      ((driverState.exists && driverState.get("tripId") !== trip.id) ||
        (plateState.exists && plateState.get("tripId") !== trip.id))
    )
      throw new HttpsError(
        "already-exists",
        "Já existe uma viagem aberta para esta placa ou motorista.",
      );
    const after = { ...trip, version: trip.version + 1 };
    transaction.set(reference, {
      tenantId: who.tenantId,
      driverId: trip.driverId,
      data: after,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(reference.collection("audit").doc(), {
      id: crypto.randomUUID(),
      tripId: trip.id,
      at: new Date().toISOString(),
      actor: who.role === "driver" ? trip.driver : who.name,
      reason: reason.trim(),
      before,
      after,
    });
    if (trip.endedAt) {
      if (driverState.get("tripId") === trip.id) transaction.delete(driverLock);
      if (plateState.get("tripId") === trip.id) transaction.delete(plateLock);
    } else {
      transaction.set(driverLock, { tripId: trip.id });
      transaction.set(plateLock, { tripId: trip.id });
    }
    if (oldPlate && oldState?.get("tripId") === trip.id)
      transaction.delete(oldPlate);
    return { version: after.version };
  });
});
export const rotafrotaSaveVehicle = onCall(async (request) => {
  const uid = request.auth?.uid;
  signedIn(uid);
  const who = await getMember(uid, request.data?.tenantId);
  if (who.role !== "technician")
    throw new HttpsError("permission-denied", "Acesso técnico obrigatório.");
  const v = request.data?.vehicle as Vehicle;
  if (
    !v ||
    !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v.plate) ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    v.name.length > 100 ||
    ![
      "Diesel S10",
      "Diesel S500",
      "Gasolina",
      "Etanol",
      "Flex",
      "GNV",
    ].includes(v.fuel)
  )
    throw new HttpsError("invalid-argument", "Veículo inválido.");
  const reference = db.doc(
    `rotafrota_companies/${who.tenantId}/vehicles/${v.plate}`,
  );
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(reference)).exists)
      throw new HttpsError("already-exists", "Placa já cadastrada.");
    transaction.create(reference, {
      id: v.plate,
      plate: v.plate,
      name: v.name.trim(),
      fuel: v.fuel,
    });
  });
  return { id: v.plate };
});


const emailKey = (email: string) => createHash('sha256').update(email).digest('hex');
const normalizedEmail = (input: unknown) => {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  return email;
};
const unauthorizedEmail = () => new HttpsError('permission-denied', 'Este e-mail não possui autorização. Entre em contato com o administrador.');
export const rotafrotaManageTechnicians = onCall(async request => {
  const uid = request.auth?.uid; signedIn(uid);
  const actorRef = db.doc(`rotafrota_members/${uid}`);
  const authorize = (data: FirebaseFirestore.DocumentData | undefined) => {
    try { return requireAccessManager(data, request.auth?.token.firebase?.sign_in_provider === 'anonymous'); }
    catch (e) { throw new HttpsError('permission-denied', (e as Error).message); }
  };
  const tenantId = authorize((await actorRef.get()).data());
  const base = `rotafrota_companies/${tenantId}`;
  if (request.data?.action === 'list') {
    const [members, permissions] = await Promise.all([db.collection('rotafrota_members').where('tenantId','==',tenantId).limit(201).get(), db.collection(`${base}/accessEmails`).limit(201).get()]);
    const users = new Map<string, unknown>();
    for (const d of permissions.docs) users.set(d.get('email'), {id:d.id, ...d.data(), registered: !!d.get('userId')});
    for (const d of members.docs) users.set(d.get('email'), {id:d.id, userId:d.id, name:d.get('name') || '',email:d.get('email') || '',active:d.get('active') === true,manager:d.get('canManageTechnicians') === true,registered:true});
    return {users:[...users.values()].slice(0,200), truncated:users.size > 200 || members.size > 200 || permissions.size > 200, currentUserId:uid};
  }
  if (request.data?.action !== 'authorize' && request.data?.action !== 'update') throw new HttpsError('invalid-argument','Atualize o aplicativo para gerenciar autorizações.');
  const email = normalizedEmail(request.data.email), name = typeof request.data.name === 'string' ? request.data.name.trim() : '';
  if (name.length < 2 || name.length > 100 || typeof request.data.manager !== 'boolean' || typeof request.data.active !== 'boolean') throw new HttpsError('invalid-argument','Confira nome, perfil e situação.');
  let accountId: string | null = null;
  try { accountId = (await getAuth().getUserByEmail(email)).uid; }
  catch (e) { if ((e as {code?:string}).code !== 'auth/user-not-found') throw e; }
  const allowRef = db.doc(`${base}/accessEmails/${emailKey(email)}`);
  await db.runTransaction(async tx => {
    const actor = await tx.get(actorRef);
    if (authorize(actor.data()) !== tenantId) throw unauthorizedEmail();
    const allow = await tx.get(allowRef);
    const resolvedId = allow.get('userId') || accountId;
    const memberRef = resolvedId ? db.doc(`rotafrota_members/${resolvedId}`) : null;
    const member = memberRef ? await tx.get(memberRef) : null;
    try { validateTechnicianTarget(uid,resolvedId ?? '',tenantId,member?.data()); }
    catch (e) { throw new HttpsError('permission-denied',(e as Error).message); }
    if (request.data.action === 'authorize' && (allow.exists || member?.exists)) throw new HttpsError('already-exists','E-mail já listado. Altere o perfil na lista.');
    if (request.data.action === 'update' && !allow.exists && !member?.exists) throw new HttpsError('not-found','Autorização não encontrada.');
    const next = {email,name,manager:request.data.manager,active:request.data.active,tenantId,company:actor.get('company'),userId:member?.exists ? resolvedId : null,updatedAt:FieldValue.serverTimestamp()};
    tx.set(allowRef,next,{merge:true});
    if (member?.exists && memberRef) tx.update(memberRef,{name,active:next.active,canManageTechnicians:next.manager,updatedAt:FieldValue.serverTimestamp()});
    tx.create(db.collection(`${base}/accessAudit`).doc(),{actorId:uid,email,action:request.data.action,manager:next.manager,active:next.active,at:FieldValue.serverTimestamp()});
  });
  return {ok:true};
});
// Signup checks the email allowlist; activation applies its current role after sign-in.
export const rotafrotaRegisterAccount = onCall(async request => {
  const email = normalizedEmail(request.data?.email), tenantId = request.data?.tenantId, password = request.data?.password;
  if (!identifier(tenantId)) throw unauthorizedEmail();
  const allow = await db.doc(`rotafrota_companies/${tenantId}/accessEmails/${emailKey(email)}`).get();
  if (!allow.exists || allow.get('active') !== true) throw unauthorizedEmail();
  try { validateSignupPassword(password); } catch (e) { throw new HttpsError('invalid-argument',(e as Error).message); }
  try { await getAuth().createUser({email,password,displayName:allow.get('name'),emailVerified:false}); }
  catch (e) {
    if ((e as {code?:string}).code === 'auth/email-already-exists') throw new HttpsError('already-exists','Este e-mail já possui conta. Entre com sua senha ou use Esqueci minha senha.');
    if ((e as {code?:string}).code === 'auth/invalid-password') throw new HttpsError('invalid-argument','A senha não atende aos requisitos.');
    throw new HttpsError('internal','Não foi possível criar a conta. Tente novamente.');
  }
  return {ok:true};
});
export const rotafrotaActivateAccount = onCall(async request => {
  const uid = request.auth?.uid; signedIn(uid);
  const email = normalizedEmail(request.auth?.token.email), tenantId = request.data?.tenantId;
  if (!identifier(tenantId) || request.auth?.token.firebase?.sign_in_provider === 'anonymous') throw unauthorizedEmail();
  const memberRef = db.doc(`rotafrota_members/${uid}`);
  const allowRef = db.doc(`rotafrota_companies/${tenantId}/accessEmails/${emailKey(email)}`);
  await db.runTransaction(async tx => {
    const [member, allow] = await Promise.all([tx.get(memberRef),tx.get(allowRef)]);
    // Preserve existing, administrator-provisioned accounts without changing their credentials.
    if (member.exists) {
      if (member.get('tenantId') !== tenantId || member.get('active') !== true) throw unauthorizedEmail();
      return;
    }
    try { requireEmailAuthorization(allow.data(),uid); }
    catch (e) { throw new HttpsError('failed-precondition',(e as Error).message); }
    tx.create(memberRef,{tenantId,email,name:allow.get('name'),company:allow.get('company'),role:'technician',active:true,canManageTechnicians:allow.get('manager') === true,createdAt:FieldValue.serverTimestamp()});
    tx.update(allowRef,{userId:uid});
    tx.create(db.collection(`rotafrota_companies/${tenantId}/accessAudit`).doc(),{actorId:uid,email,action:'activateAccount',at:FieldValue.serverTimestamp()});
  });
  return {ok:true};
});

