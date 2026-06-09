import React, { useState, useEffect } from "react";
import { HerbamedLogo } from "../../shared/ui";
import { fmt } from "../../core/utils";

const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
};

const s = {
  page: { minHeight: "100vh", background: "#f4f7f4", fontFamily: "'Inter',system-ui,sans-serif", padding: "24px 16px" },
  card: { background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,0,0,.08)", padding: "1.5rem", marginBottom: 16, maxWidth: 680, margin: "0 auto 16px" },
  label: { fontSize: 11, fontWeight: 700, color: "#4a6b50", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d0ddd2", background: "#f9fbf9", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", color: "#1a2e1e" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d0ddd2", background: "#f9fbf9", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", minHeight: 80, resize: "vertical", color: "#1a2e1e" },
  btnA: { padding: "11px 28px", borderRadius: 10, border: "none", background: "#1a7a3c", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  btnS: { padding: "9px 20px", borderRadius: 8, border: "1px solid #d0ddd2", background: "#f4f7f4", color: "#4a6b50", fontFamily: "inherit", fontSize: 13, cursor: "pointer" },
  row: { display: "grid", gridTemplateColumns: "140px 1fr", gap: 4, padding: "6px 0", borderBottom: "1px solid #f0f5f1" },
  kv_k: { fontSize: 11, fontWeight: 700, color: "#8aaa8e", textTransform: "uppercase" },
  kv_v: { fontSize: 13, color: "#1a2e1e", fontWeight: 500 },
  verde: "#1a7a3c",
};

export function SupplierRNCPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [step, setStep] = useState(1); // 1=form, 2=sucesso
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");

  const NPORQUES = 5;
  const [porques, setPorques] = useState(Array(NPORQUES).fill(""));
  const [causaRaiz, setCausaRaiz] = useState("");
  const [planoAcao, setPlanoAcao] = useState({ oQue: "", porQue: "", como: "", quem: "", quando: "", onde: "", quanto: "" });
  const [observacoes, setObservacoes] = useState("");

  const setPA = (k, v) => setPlanoAcao(p => ({ ...p, [k]: v }));
  const setPQ = (i, v) => setPorques(p => p.map((x, j) => j === i ? v : x));

  useEffect(() => {
    api(`/api/rnc-supplier/${token}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  const enviar = async () => {
    if (!causaRaiz.trim()) { setSendErr("Informe a causa raiz identificada."); return; }
    if (!planoAcao.oQue.trim() || !planoAcao.quem.trim() || !planoAcao.quando) { setSendErr("Preencha ao menos O quê, Quem e Quando no plano de ação."); return; }
    setSending(true); setSendErr("");
    try {
      await api(`/api/rnc-supplier/${token}/responder`, { method: "POST", body: { porques, causaRaiz, planoAcao, observacoes } });
      setStep(2);
    } catch(e) { setSendErr(e.message); }
    setSending(false);
  };

  if (loading) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: "#4a6b50" }}>Carregando...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e53935", marginBottom: 8 }}>Link inválido ou expirado</div>
        <div style={{ color: "#666", fontSize: 13 }}>{error}</div>
        <div style={{ marginTop: 16, fontSize: 12, color: "#999" }}>Entre em contato com a Herbamed para solicitar um novo link.</div>
      </div>
    </div>
  );

  if (step === 2) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: "center", padding: "3rem", maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: s.verde, marginBottom: 8 }}>Resposta enviada com sucesso!</div>
        <div style={{ color: "#4a6b50", fontSize: 13, lineHeight: 1.6 }}>
          Sua análise foi registrada no Sistema de Gestão da Qualidade da Herbamed.<br />
          A equipe de qualidade irá analisar e retornar em breve.
        </div>
        <div style={{ marginTop: 20, fontSize: 11, color: "#999" }}>RNC {data?.rncNum} — {new Date().toLocaleDateString("pt-BR")}</div>
      </div>
    </div>
  );

  if (data?.respondido) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: s.verde, marginBottom: 8 }}>Esta RNC já foi respondida</div>
        <div style={{ color: "#666", fontSize: 13 }}>Respondida em {fmt(data.respondidoEm)}.</div>
      </div>
    </div>
  );

  const rnc = data?.rnc || {};
  const diasRestantes = data?.expiresAt ? Math.ceil((new Date(data.expiresAt) - new Date()) / 86400000) : 0;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ maxWidth: 680, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1a7a3c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 800 }}>H</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1a2e1e" }}>Herbamed Laboratório Nutracêutico</div>
          <div style={{ fontSize: 11, color: "#8aaa8e" }}>Sistema de Gestão da Qualidade — Resposta de Fornecedor</div>
        </div>
      </div>

      {/* Alerta prazo */}
      <div style={{ ...s.card, background: diasRestantes <= 7 ? "#fff3f3" : "#f0fbf3", border: `1px solid ${diasRestantes <= 7 ? "#ffcdd2" : "#c8e6c9"}`, padding: "12px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: diasRestantes <= 7 ? "#c62828" : "#2e7d32" }}>
          {diasRestantes <= 7 ? "⚠️" : "📅"} Prazo de resposta: {diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Expirado"} · Válido até {fmt(data?.expiresAt)}
        </div>
      </div>

      {/* Dados da RNC */}
      <div style={s.card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: s.verde, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e8f5e9" }}>
          Registro de Não-Conformidade — {data?.rncNum}
        </div>
        {[
          ["Produto/Material", rnc.produto || rnc.item || "—"],
          ["Lote", rnc.lote || "—"],
          ["Fornecedor", rnc.fornecedor || "—"],
          ["Qtd. afetada", rnc.qtd || "—"],
          ["Descrição", rnc.desc || rnc.descricao || "—"],
          ["Ação de contenção", rnc.contencao || "—"],
          ["Prazo para resposta", fmt(data?.expiresAt)],
        ].map(([k, v]) => (
          <div key={k} style={s.row}>
            <div style={s.kv_k}>{k}</div>
            <div style={s.kv_v}>{v}</div>
          </div>
        ))}
      </div>

      {/* 5 Porquês */}
      <div style={s.card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2e1e", marginBottom: 4 }}>Análise de Causa — 5 Porquês</div>
        <div style={{ fontSize: 12, color: "#8aaa8e", marginBottom: 14 }}>Pergunte "Por quê?" repetidamente até chegar à causa raiz do problema.</div>
        {porques.map((v, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={s.label}>Por que {i + 1}{i === 0 ? " — Por que o problema ocorreu?" : ""}</div>
            <textarea style={s.textarea} rows={2} value={v} onChange={e => setPQ(i, e.target.value)} placeholder={i === 0 ? "Ex: O lote foi liberado com umidade fora do limite..." : `Porque... (aprofunde a resposta anterior)`} />
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <div style={s.label}>Causa raiz identificada *</div>
          <textarea style={{ ...s.textarea, border: "1.5px solid #1a7a3c" }} rows={3} value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} placeholder="Descreva a causa raiz final identificada pela análise acima..." />
        </div>
      </div>

      {/* Plano de Ação 5W2H */}
      <div style={s.card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2e1e", marginBottom: 4 }}>Plano de Ação — 5W2H</div>
        <div style={{ fontSize: 12, color: "#8aaa8e", marginBottom: 14 }}>Descreva as ações corretivas para eliminar a causa raiz.</div>
        {[
          ["oQue", "O quê? *", "Qual ação será executada?"],
          ["porQue", "Por quê?", "Justificativa da ação"],
          ["como", "Como?", "Como a ação será executada?"],
          ["quem", "Quem? *", "Responsável pela execução"],
          ["onde", "Onde?", "Local de aplicação"],
          ["observacoes_5w", "Quanto?", "Custo estimado ou recursos necessários"],
        ].map(([key, lbl, ph]) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={s.label}>{lbl}</div>
            <textarea style={s.textarea} rows={2} value={key === "observacoes_5w" ? planoAcao.quanto : planoAcao[key]} onChange={e => setPA(key === "observacoes_5w" ? "quanto" : key, e.target.value)} placeholder={ph} />
          </div>
        ))}
        <div>
          <div style={s.label}>Quando? *</div>
          <input type="date" style={s.input} value={planoAcao.quando} onChange={e => setPA("quando", e.target.value)} min={new Date().toISOString().split("T")[0]} />
        </div>
      </div>

      {/* Observações */}
      <div style={s.card}>
        <div style={s.label}>Observações adicionais / evidências</div>
        <textarea style={s.textarea} rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Qualquer informação adicional relevante, número de relatório interno, referências..." />
      </div>

      {/* Enviar */}
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 12, justifyContent: "flex-end", paddingBottom: 32 }}>
        {sendErr && <div style={{ fontSize: 13, color: "#c62828", alignSelf: "center", flex: 1 }}>{sendErr}</div>}
        <button style={{ ...s.btnA, opacity: sending ? 0.7 : 1 }} disabled={sending} onClick={enviar}>
          {sending ? "Enviando..." : "✅ Enviar resposta"}
        </button>
      </div>
    </div>
  );
}
