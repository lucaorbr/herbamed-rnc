import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { askClaude } from "../../services/aiClient";
import { useS } from "../../shared/styles";

export function AIPanel({ rnc, onApply }) {
  const T = useTheme(); const s = useS();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [type, setType] = useState("");

  const run = async (aiType) => {
    setLoading(true); setType(aiType); setResult(null);
    try {
      let prompt = "";
      if (aiType === "ishikawa") {
        prompt = `Você é um especialista em qualidade industrial. Analise esta não conformidade e sugira causas para o diagrama de Ishikawa (6M).

NÃO CONFORMIDADE: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}
FORNECEDOR: ${rnc.fornecedor || "—"}
TIPO: ${rnc.tipo}

Responda APENAS em JSON válido, sem markdown, sem explicações:
{
  "mao": ["causa 1", "causa 2"],
  "maquina": ["causa 1", "causa 2"],
  "metodo": ["causa 1", "causa 2"],
  "material": ["causa 1", "causa 2"],
  "medicao": ["causa 1", "causa 2"],
  "meioamb": ["causa 1", "causa 2"],
  "efeito": "descrição resumida do problema"
}`;
      } else if (aiType === "5porques") {
        prompt = `Você é um especialista em qualidade. Faça a análise dos 5 Porquês para esta não conformidade.

NÃO CONFORMIDADE: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "causa": "causa raiz inicial",
  "porques": ["resposta porquê 1", "resposta porquê 2", "resposta porquê 3", "resposta porquê 4", "resposta porquê 5"],
  "raiz": "causa raiz final identificada"
}`;
      } else if (aiType === "5w2h") {
        prompt = `Você é um especialista em qualidade. Crie um plano de ação 5W2H para corrigir esta não conformidade.

NÃO CONFORMIDADE: ${rnc.desc}
CAUSA RAIZ: ${rnc.ishikawa?.root || "não identificada"}
PRODUTO: ${rnc.produto || "—"}
RESPONSÁVEL: ${rnc.resp || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "acoes": [
    {
      "what": "o que fazer",
      "why": "por quê",
      "who": "quem",
      "where": "onde",
      "when": "prazo em dias (ex: 7 dias)",
      "how": "como fazer",
      "howMuch": "baixo/médio/alto",
      "status": "Pendente"
    }
  ]
}`;
      } else if (aiType === "eficacia") {
        prompt = `Você é um especialista em qualidade. Sugira critérios de verificação de eficácia para esta ação corretiva.

NÃO CONFORMIDADE: ${rnc.desc}
CAUSA RAIZ: ${rnc.ishikawa?.root || "não identificada"}
PRODUTO: ${rnc.produto || "—"}

Responda APENAS em JSON válido, sem markdown:
{
  "criterio": "descrição detalhada do critério de eficácia",
  "prazo": "prazo sugerido em dias",
  "evidencias": "quais evidências coletar para comprovar eficácia"
}`;
      } else if (aiType === "resumo") {
        prompt = `Você é um especialista em qualidade. Gere um resumo executivo profissional desta RNC para envio à diretoria.

NÃO CONFORMIDADE: ${rnc.num}
DESCRIÇÃO: ${rnc.desc}
PRODUTO: ${rnc.produto || "—"}
FORNECEDOR: ${rnc.fornecedor || "—"}
SEVERIDADE: ${rnc.sev}
STATUS: ${rnc.status}
CAUSA RAIZ: ${rnc.ishikawa?.root || "em análise"}

Responda APENAS em JSON válido, sem markdown:
{
  "resumo": "texto do resumo executivo profissional em português, 3-4 parágrafos"
}`;
      }

      const txt = await askClaude(prompt);
      const clean = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult({ type: aiType, data: parsed });
    } catch (e) {
      setResult({ type: "erro", data: { msg: "Erro ao processar. Tente novamente." } });
    }
    setLoading(false);
  };

  const apply = () => { if (result && onApply) onApply(result); setResult(null); };

  const btns = [
    { id: "ishikawa",  icon: "🐟", label: "Sugerir causas\nIshikawa" },
    { id: "5porques",  icon: "🔍", label: "Analisar\n5 Porquês" },
    { id: "5w2h",      icon: "📌", label: "Gerar plano\n5W2H" },
    { id: "eficacia",  icon: "✅", label: "Critério de\nEficácia" },
    { id: "resumo",    icon: "📄", label: "Resumo\nExecutivo" },
  ];

  return (
    <div style={{ background: `linear-gradient(135deg, ${T.accentDim}, ${T.card2})`, border: `1px solid ${T.accent}33`, borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 0 12px ${T.accentGlow}` }}>🤖</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Assistente de IA — Claude</div>
          <div style={{ fontSize: 11, color: T.text2 }}>Análise automática com inteligência artificial</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: "1rem" }}>
        {btns.map(b => (
          <button key={b.id} onClick={() => run(b.id)} disabled={loading} style={{ padding: "10px 6px", background: type === b.id && loading ? T.accentDim : T.surf, border: `1px solid ${T.border2}`, borderRadius: 10, color: T.text, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.4, opacity: loading && type !== b.id ? .5 : 1, transition: "all .2s" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{b.icon}</div>
            {b.label.split("\n").map((l, i) => <div key={i}>{l}</div>)}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: T.surf, borderRadius: 8, fontSize: 13, color: T.accent }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
          Analisando com IA...
        </div>
      )}

      {result && result.type !== "erro" && (
        <div style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem" }}>
          <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            ✨ Resultado da análise
          </div>

          {result.type === "ishikawa" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries({ mao: "👤 Mão de obra", maquina: "⚙️ Máquina", metodo: "📋 Método", material: "📦 Material", medicao: "📏 Medição", meioamb: "🌿 Meio ambiente" }).map(([k, l]) => (
                result.data[k]?.length > 0 && (
                  <div key={k} style={{ background: T.card, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 6, textTransform: "uppercase" }}>{l}</div>
                    {result.data[k].map((c, i) => <div key={i} style={{ fontSize: 12, color: T.text2, marginBottom: 3 }}>• {c}</div>)}
                  </div>
                )
              ))}
            </div>
          )}

          {result.type === "5porques" && (
            <div>
              {result.data.porques?.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg,${T.accent},${T.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: T.text2, paddingTop: 3 }}>{p}</div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: 10, background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>🎯 Causa raiz</div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{result.data.raiz}</div>
              </div>
            </div>
          )}

          {result.type === "5w2h" && (
            <div>
              {result.data.acoes?.map((a, i) => (
                <div key={i} style={{ background: T.card, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 6 }}>Ação #{i + 1}: {a.what}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[["Por quê", a.why], ["Quem", a.who], ["Onde", a.where], ["Quando", a.when], ["Como", a.how], ["Custo", a.howMuch]].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: T.text2 }}><span style={{ color: T.text3, fontWeight: 600 }}>{k}:</span> {v}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.type === "eficacia" && (
            <div>
              <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>{result.data.criterio}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ fontSize: 12, color: T.text2 }}><span style={{ color: T.accent, fontWeight: 600 }}>Prazo:</span> {result.data.prazo}</div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}><span style={{ color: T.accent, fontWeight: 600 }}>Evidências:</span> {result.data.evidencias}</div>
            </div>
          )}

          {result.type === "resumo" && (
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.data.resumo}</div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button style={{ ...s.btn, fontSize: 11 }} onClick={() => setResult(null)}>Descartar</button>
            {result.type !== "resumo" && (
              <button style={{ ...s.btnA, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }} onClick={apply}>
                ✓ Aplicar ao formulário
              </button>
            )}
          </div>
        </div>
      )}

      {result?.type === "erro" && (
        <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ff4f6a" }}>
          ⚠ {result.data.msg}
        </div>
      )}
    </div>
  );
}
