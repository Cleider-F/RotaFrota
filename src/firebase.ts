import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
// Firebase web identifiers are public. Authorization is enforced by functions/rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDIUS5Z_2e_V3qwzvTOxPzH2O5QRPCGcGM",
  authDomain: "controle-de-pneus-cmc.firebaseapp.com",
  projectId: "controle-de-pneus-cmc",
  storageBucket: "controle-de-pneus-cmc.firebasestorage.app",
  messagingSenderId: "947294126166",
  appId: "1:947294126166:web:ea857f0e12a46a99053bf7",
};
export const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
export const companyId =
  import.meta.env.VITE_COMPANY_ID || "operacao-principal";
const application = initializeApp(firebaseConfig);
// Separate Auth instances/storage keys: signing a technician out does not erase a driver's trip session.
const driverApplication = initializeApp(firebaseConfig, "rotafrota-driver");
export const adminAuth = initializeAuth(application, {
  persistence: browserSessionPersistence,
});
export const driverAuth = initializeAuth(driverApplication, {
  persistence: browserLocalPersistence,
});
export const firestore = getFirestore(application);
export const driverFirestore = getFirestore(driverApplication);
export const storage = getStorage(application);
export const driverStorage = getStorage(driverApplication);
export const functions = getFunctions(application, "southamerica-east1");
export const driverFunctions = getFunctions(
  driverApplication,
  "southamerica-east1",
);
