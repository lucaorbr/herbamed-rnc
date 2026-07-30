import React from "react";

export const tod = () => new Date().toISOString().split("T")[0];

export const UNIDADES_RECEBIMENTO = ["kg","g","mg","ton","L","mL","un","cx","saco","fardo","pallet"];

export const parseQtd = (str) => {
  if (!str) return { valor: "", unidade: "kg" };
  const m = String(str).trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!m) return { valor: "", unidade: "kg" };
  const u = (m[2]||"").trim();
  const matchU = UNIDADES_RECEBIMENTO.find(x => x.toLowerCase() === u.toLowerCase());
  return { valor: m[1].replace(",","."), unidade: matchU || (u || "kg") };
};

export const fmtQtd = (valor, unidade) => {
  if (!valor && !unidade) return "";
  if (!valor) return unidade || "";
  return `${valor} ${unidade||""}`.trim();
};

export const fmt = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export const sigCodigo = (ass, ctx = "") => {
  if (!ass) return "";
  if (ass.codigoVerificacao) return ass.codigoVerificacao;
  if (ass.verificationCode) return ass.verificationCode;
  const base = `${ass.email || ass.nome || ""}|${ass.userId || ass.uid || ""}|${ass.cargo || ""}|${ass.setor || ""}|${ass.registroProfissional || ass.crf || ass.registro || ""}|${ass.timestamp || ass.dataHora || (ass.data ? `${ass.data} ${ass.hora || ""}` : "")}|${ctx}`;
  const fnv = (seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  };
  const full = (fnv(0x811c9dc5) + fnv(0x9e3779b1)).slice(0, 12);
  return `${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`;
};

export const seloAssHTML = (ass, papel, cor = "#1a4a2e", ctx = "") => {
  if (!ass) return `<div style="padding:10px 12px;border:1px dashed #ddd;border-radius:8px;background:#fafafa;text-align:center;"><div style="font-size:9px;color:#888;text-transform:uppercase;">${papel}</div><div style="font-size:11px;color:#ccc;padding:8px 0;">Aguardando assinatura</div></div>`;
  const quando = ass.timestamp ? new Date(ass.timestamp).toLocaleString("pt-BR") : (ass.dataHora || (ass.data ? `${ass.data}${ass.hora ? " as " + ass.hora : ""}` : ""));
  const registro = ass.registroProfissional || ass.crf || ass.registro || "";
  return `<div style="padding:10px 12px;border:1px solid ${cor}40;border-radius:8px;background:#fafdfb;text-align:left;"><div style="font-size:8px;letter-spacing:.08em;color:${cor};text-transform:uppercase;font-weight:bold;margin-bottom:6px;">${papel}</div><div style="font-size:12px;font-weight:bold;color:#1a3a28;">${ass.nome || "-"}</div>${ass.cargo ? `<div style="font-size:10px;color:#555;">${ass.cargo}</div>` : ""}${registro ? `<div style="font-size:9px;color:#777;">Registro profissional: ${registro}</div>` : ""}<div style="margin-top:6px;padding-top:6px;border-top:1px dashed ${cor}40;font-size:9px;color:#555;">Assinado eletronicamente em ${quando}</div><div style="font-size:8px;color:#999;margin-top:3px;font-family:monospace;">Cod. verificacao: ${sigCodigo(ass, ctx)}</div>${ass.hash ? `<div style="font-size:7px;color:#aaa;margin-top:2px;font-family:monospace;">Hash: ${String(ass.hash).slice(0,24)}...</div>` : ""}</div>`;
};

export const past = d => d && d < tod();

export const genNum = c => String(c);

export const upperFirstLetter = value => {
  if (typeof value !== "string" || !value) return value;
  const index = value.search(/[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/);
  if (index < 0) return value;
  return value.slice(0, index)
    + value[index].toLocaleUpperCase("pt-BR")
    + value.slice(index + 1);
};

const TECHNICAL_TEXT_FIELD = [
  "busca", "buscar", "pesquisa", "pesquisar", "filtro",
  "email", "e-mail", "senha", "password", "login",
  "lote", "nota fiscal", "nf", "cnpj", "cpf", "cep",
  "telefone", "celular", "whatsapp", "url", "link", "site",
  "codigo", "referencia", "registro",
  "numero", "versao", "crf", "id areco",
];

export const isDescriptiveTextField = element => {
  if (!element) return false;
  if (element.dataset?.autoCapitalize === "off") return false;
  if (element.dataset?.autoCapitalize === "on") return true;

  const tag = String(element.tagName || "").toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;

  const type = String(element.type || "text").toLowerCase();
  if (type !== "text") return false;

  const nearbyLabels = [];
  let parent = element.parentElement;
  for (let level = 0; parent && level < 4; level += 1, parent = parent.parentElement) {
    const label = Array.from(parent.children || []).find(child => child.tagName?.toLowerCase() === "label");
    if (label?.textContent) {
      nearbyLabels.push(label.textContent);
      break;
    }
  }

  const identity = [
    element.name,
    element.id,
    element.placeholder,
    element.getAttribute?.("aria-label"),
    ...nearbyLabels,
  ].filter(Boolean).join(" ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return !TECHNICAL_TEXT_FIELD.some(term => {
    if (term.length <= 3) {
      return new RegExp(`(^|[^a-z])${term}([^a-z]|$)`, "i").test(identity);
    }
    return identity.includes(term);
  });
};

export const capitalizeDescriptiveInput = event => {
  const element = event?.target;
  if (!isDescriptiveTextField(element)) return;
  const normalized = upperFirstLetter(element.value);
  if (normalized !== element.value) element.value = normalized;
};

export const applyMask = (tipo, val) => {
  const d = (val || "").replace(/\D/g, "");
  if (tipo === "cnpj") {
    const n = d.slice(0, 14);
    if (n.length <= 2)  return n;
    if (n.length <= 5)  return `${n.slice(0,2)}.${n.slice(2)}`;
    if (n.length <= 8)  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  }
  if (tipo === "telefone") {
    const n = d.slice(0, 11);
    if (n.length <= 2)  return n.length ? `(${n}` : n;
    if (n.length <= 6)  return `(${n.slice(0,2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  }
  if (tipo === "cep") {
    const n = d.slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0,5)}-${n.slice(5)}`;
  }
  return val;
};
