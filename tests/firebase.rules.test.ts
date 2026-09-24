import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let env: RulesTestEnvironment;
run("Firebase: isolamento real nos emuladores", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-rotafrota",
      firestore: { rules: readFileSync("firebase/firestore.rules", "utf8") },
      storage: { rules: readFileSync("firebase/storage.rules", "utf8") },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "rotafrota_members", "techA"), {
          active: true,
          role: "technician",
          tenantId: "a",
        }),
        setDoc(doc(db, "rotafrota_members", "techB"), {
          active: true,
          role: "technician",
          tenantId: "b",
        }),
        setDoc(doc(db, "rotafrota_companies/a/drivers/driverA"), {
          active: true,
        }),
        setDoc(doc(db, "rotafrota_companies/a/drivers/driverB"), {
          active: true,
        }),
        setDoc(doc(db, "rotafrota_companies/a/trips/tripA"), {
          tenantId: "a",
          driverId: "driverA",
          data: { id: "tripA" },
        }),
        setDoc(doc(db, "rotafrota_companies/a/trips/tripB"), {
          tenantId: "a",
          driverId: "driverB",
          data: { id: "tripB" },
        }),
        setDoc(doc(db, "rotafrota_companies/a/trips/tripA/audit/one"), {
          reason: "Teste de auditoria",
        }),
      ]);
    });
  }, 30000);
  afterAll(async () => {
    await env?.cleanup();
  });
  const driver = () =>
    env.authenticatedContext("driverA", {
      firebase: { sign_in_provider: "anonymous" },
    });
  const tech = () =>
    env.authenticatedContext("techA", {
      firebase: { sign_in_provider: "password" },
    });
  it("técnico vê a frota de sua empresa", async () => {
    await assertSucceeds(
      getDocs(collection(tech().firestore(), "rotafrota_companies/a/trips")),
    );
  });
  it("motorista só consulta seus registros e não lê a frota inteira", async () => {
    const db = driver().firestore();
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "rotafrota_companies/a/trips"),
          where("driverId", "==", "driverA"),
        ),
      ),
    );
    await assertFails(getDocs(collection(db, "rotafrota_companies/a/trips")));
    await assertFails(getDoc(doc(db, "rotafrota_companies/a/trips/tripB")));
  });
  it("motorista não lê auditoria nem veículos administrativos", async () => {
    const db = driver().firestore();
    await assertFails(
      getDoc(doc(db, "rotafrota_companies/a/trips/tripA/audit/one")),
    );
    await assertFails(
      getDocs(collection(db, "rotafrota_companies/a/vehicles")),
    );
  });
  it("visitante e técnico de outra empresa não leem os dados", async () => {
    await assertFails(
      getDocs(
        collection(
          env.unauthenticatedContext().firestore(),
          "rotafrota_companies/a/trips",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env
            .authenticatedContext("techB", {
              firebase: { sign_in_provider: "password" },
            })
            .firestore(),
          "rotafrota_companies/a/trips/tripA",
        ),
      ),
    );
  });
  it("ninguém eleva o próprio papel nem altera viagens diretamente", async () => {
    await assertFails(
      setDoc(doc(driver().firestore(), "rotafrota_members/driverA"), {
        active: true,
        role: "technician",
        tenantId: "a",
      }),
    );
    await assertFails(
      setDoc(doc(tech().firestore(), "rotafrota_companies/a/trips/tripA"), {
        data: { alterado: true },
      }),
    );
  });
  it("foto fica privada e não pode ser sobrescrita nem apagada", async () => {
    const storage = driver().storage();
    const photo = ref(storage, "rotafrota/a/driverA/photo.jpg");
    await assertSucceeds(
      uploadBytes(photo, new Uint8Array([255, 216, 255, 217]), {
        contentType: "image/jpeg",
      }),
    );
    await assertSucceeds(
      getBytes(ref(tech().storage(), "rotafrota/a/driverA/photo.jpg")),
    );
    await assertFails(
      getBytes(
        ref(
          env.unauthenticatedContext().storage(),
          "rotafrota/a/driverA/photo.jpg",
        ),
      ),
    );
    await assertFails(
      getBytes(
        ref(
          env
            .authenticatedContext("driverB", {
              firebase: { sign_in_provider: "anonymous" },
            })
            .storage(),
          "rotafrota/a/driverA/photo.jpg",
        ),
      ),
    );
    await assertFails(
      uploadBytes(photo, new Uint8Array([1]), { contentType: "image/jpeg" }),
    );
    await assertFails(deleteObject(photo));
  });
  it("não permite upload em outra empresa ou tipo não autorizado", async () => {
    await assertFails(
      uploadBytes(
        ref(driver().storage(), "rotafrota/b/driverA/photo.jpg"),
        new Uint8Array([1]),
        { contentType: "image/jpeg" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(driver().storage(), "rotafrota/a/driverA/other.jpg"),
        new Uint8Array([1]),
        { contentType: "text/plain" },
      ),
    );
  });
});
