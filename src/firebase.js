import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updatePassword
} from "firebase/auth";
import firebaseConfig from "./firebaseConfig";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const loginUser = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logoutUser = () => signOut(auth);
export const createAuthUser = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);

// ─── USERS ────────────────────────────────────────────────────────────────────
export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
export const saveUser = (uid, data) => setDoc(doc(db, "users", uid), data, { merge: true });
export const updateUser = (uid, data) => updateDoc(doc(db, "users", uid), data);
export const deleteUser = (uid) => deleteDoc(doc(db, "users", uid));
export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ─── RNCS ─────────────────────────────────────────────────────────────────────
export const saveRNC = (id, data) => setDoc(doc(db, "rncs", String(id)), { ...data, updatedAt: serverTimestamp() });
export const updateRNC = (id, data) => updateDoc(doc(db, "rncs", String(id)), { ...data, updatedAt: serverTimestamp() });
export const deleteRNC = (id) => deleteDoc(doc(db, "rncs", String(id)));
export const getAllRNCs = async () => {
  const snap = await getDocs(collection(db, "rncs"));
  return snap.docs.map(d => ({ ...d.data() })).sort((a, b) => (a.num || "").localeCompare(b.num || ""));
};
export const subscribeRNCs = (cb) =>
  onSnapshot(collection(db, "rncs"), snap => {
    cb(snap.docs.map(d => d.data()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  });

// ─── COUNTER ──────────────────────────────────────────────────────────────────
export const getCounter = async () => {
  const snap = await getDoc(doc(db, "meta", "counter"));
  return snap.exists() ? snap.data().value : 0;
};
export const incrementCounter = async () => {
  const current = await getCounter();
  const next = current + 1;
  await setDoc(doc(db, "meta", "counter"), { value: next });
  return next;
};

// ─── GENERIC COLLECTIONS ──────────────────────────────────────────────────────
export const saveCollection = (colName, id, data) =>
  setDoc(doc(db, colName, String(id)), { ...data, updatedAt: serverTimestamp() });

export const deleteFromCollection = (colName, id) =>
  deleteDoc(doc(db, colName, String(id)));

export const subscribeCollection = (colName, cb, onErr) =>
  onSnapshot(
    collection(db, colName),
    snap => { cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err  => { console.warn(`[subscribeCollection:${colName}]`, err?.code); onErr && onErr(err); }
  );

export const getCollection = async (colName) => {
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
