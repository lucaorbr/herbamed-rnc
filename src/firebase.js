const API_BASE = process.env.REACT_APP_API_BASE_URL || "";
const TOKEN_KEY = "sgq_token";

export const auth = {
  currentUser: null,
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error || "Erro de comunicacao com o servidor");
    error.code = response.status === 401 ? "unauthenticated" : response.status === 403 ? "permission-denied" : "server-error";
    error.status = response.status;
    throw error;
  }
  return data;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    uid: user.uid || user.id,
  };
}

function notifyAuth(user) {
  auth.currentUser = user ? { uid: user.uid || user.id, email: user.email } : null;
  authListeners.forEach(listener => listener(auth.currentUser));
}

const authListeners = new Set();

export function onAuthStateChanged(_auth, cb) {
  let active = true;
  authListeners.add(cb);
  api("/api/auth/me")
    .then(({ user }) => {
      if (!active) return;
      const normalized = normalizeUser(user);
      auth.currentUser = normalized ? { uid: normalized.uid, email: normalized.email } : null;
      cb(normalized ? { uid: normalized.uid, email: normalized.email } : null);
    })
    .catch(() => {
      if (!active) return;
      auth.currentUser = null;
      cb(null);
    });

  return () => {
    active = false;
    authListeners.delete(cb);
  };
}

export const loginUser = async (email, pw) => {
  const { user, token } = await api("/api/auth/login", { method: "POST", body: { email, password: pw } });
  setToken(token);
  const normalized = normalizeUser(user);
  notifyAuth(normalized);
  return { user: { uid: normalized.uid, email: normalized.email } };
};

export const logoutUser = async () => {
  try { await api("/api/auth/logout", { method: "POST", body: {} }); } catch {}
  setToken(null);
  notifyAuth(null);
};

export const createAuthUser = async (email, pw) => {
  auth.pendingPassword = auth.pendingPassword || {};
  auth.pendingPassword[email] = pw;
  return { user: { uid: `pending:${email}`, email, password: pw } };
};

export const getUser = async (uid) => {
  if (!uid) return null;
  const user = await api(`/api/users/${encodeURIComponent(uid)}`);
  return normalizeUser(user);
};

export const saveUser = async (uid, data) => {
  if (String(uid).startsWith("pending:")) {
    const email = String(uid).slice("pending:".length);
    const user = await api("/api/users", { method: "POST", body: { ...data, email, password: auth.pendingPassword?.[email] } });
    if (auth.pendingPassword) delete auth.pendingPassword[email];
    return normalizeUser(user);
  }
  const user = await api(`/api/users/${encodeURIComponent(uid)}`, { method: "PATCH", body: data });
  return normalizeUser(user);
};

export const updateUser = saveUser;

export const deleteUser = (uid) =>
  api(`/api/users/${encodeURIComponent(uid)}`, { method: "DELETE" });

export const getAllUsers = async () => {
  const users = await api("/api/users");
  return users.map(normalizeUser);
};

export const saveRNC = (id, data) =>
  api(`/api/rncs/${encodeURIComponent(id)}`, { method: "PUT", body: data });

export const updateRNC = (id, data) =>
  api(`/api/rncs/${encodeURIComponent(id)}`, { method: "PATCH", body: data });

export const deleteRNC = (id) =>
  api(`/api/rncs/${encodeURIComponent(id)}`, { method: "DELETE" });

export const getAllRNCs = () => api("/api/rncs");

export const subscribeRNCs = (cb) => poll(() => getAllRNCs().then(cb));

export const incrementCounter = async () => {
  const { value } = await api("/api/counters/increment-daily", { method: "POST", body: {} });
  return value;
};

export const peekDailyCounter = async () => {
  const { value } = await api("/api/counters/peek-daily");
  return value;
};

export const saveCollection = (colName, id, data) =>
  api(`/api/collections/${encodeURIComponent(colName)}/${encodeURIComponent(id)}`, { method: "PUT", body: data });

export const deleteFromCollection = (colName, id) =>
  api(`/api/collections/${encodeURIComponent(colName)}/${encodeURIComponent(id)}`, { method: "DELETE" });

export const getCollection = (colName) =>
  api(`/api/collections/${encodeURIComponent(colName)}`);

export const subscribeCollection = (colName, cb, onErr) =>
  poll(() => getCollection(colName).then(cb), onErr);

export const verifyCurrentUserPassword = (password) =>
  api("/api/auth/verify-password", { method: "POST", body: { password } });

export const changePassword = (senhaAtual, senhaNova) =>
  api("/api/auth/change-password", { method: "POST", body: { senhaAtual, senhaNova } });

export const adminResetPassword = (uid) =>
  api("/api/auth/admin-reset-password", { method: "POST", body: { uid } });

export const createElectronicSignature = ({ password, contexto = "", papel = "" }) =>
  api("/api/auth/signature", { method: "POST", body: { password, contexto, papel } });

export const getArecoRecebimentos = (status = "pendente_analise") =>
  api(`/api/areco/recebimentos${status ? `?status=${encodeURIComponent(status)}` : ""}`);

export const updateArecoRecebimento = (id, data) =>
  api(`/api/areco/recebimentos/${encodeURIComponent(id)}`, { method: "PATCH", body: data });

export const getArecoMateriais = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return api(`/api/areco/materiais${qs.toString() ? `?${qs}` : ""}`);
};

export const getArecoSyncStatus = () =>
  api("/api/areco/sync/status");

export const runArecoSync = () =>
  api("/api/areco/sync/run", { method: "POST", body: {} });

export const uploadLocalFile = async (file) => {
  const data = await fileToBase64(file);
  return api("/api/files", {
    method: "POST",
    body: {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      data,
    },
  });
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function poll(fn, onErr, intervalMs = 5000) {
  let alive = true;
  let timer = null;

  const run = async () => {
    if (!alive) return;
    try {
      await fn();
    } catch (error) {
      if (onErr) onErr(error);
      else console.warn("[poll]", error?.message || error);
    } finally {
      if (alive) timer = setTimeout(run, intervalMs);
    }
  };

  run();
  return () => {
    alive = false;
    if (timer) clearTimeout(timer);
  };
}
