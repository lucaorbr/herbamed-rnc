import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, past } from "../../core/utils";
import { useS } from "../../shared/styles";
import { F, Inp, SecTitle } from "../../shared/ui";

export function buildEmail(rnc, evento) {
  const sev = { Crítica: "🔴 CRÍTICA", Maior: "🟠 MAIOR", Menor: "🟡 MENOR" }[rnc.sev] || rnc.sev;
  const evLabel = {
    abertura: "NOVA NÃO CONFORMIDADE REGISTRADA",
    status: "ATUALIZAÇÃO DE STATUS",
    ishikawa: "ANÁLISE DE CAUSA CONCLUÍDA",
    "5w2h": "PLANO DE AÇÃO 5W2H ATUALIZADO",
    eficacia: "VERIFICAÇÃO DE EFICÁCIA REGISTRADA",
    manual: "NOTIFICAÇÃO DE NÃO CONFORMIDADE",
  }[evento] || "ATUALIZAÇÃO";
  const pfx = rnc.sev === "Crítica" ? "🔴 [CRÍTICO] " : rnc.sev === "Maior" ? "🟠 [IMPORTANTE] " : "🟡 ";
  const subject = `${pfx}${evLabel} | ${rnc.num} — ${rnc.produto || rnc.tipo}`;
  const body = `Prezado(a),

Este é um comunicado automático do Sistema de Gestão da Qualidade da Herbamed®.
Evento: ${evLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DADOS DA NÃO CONFORMIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Número:           ${rnc.num}
Status:           ${rnc.status}
Severidade:       ${sev}
Tipo:             ${rnc.tipo}
Data abertura:    ${fmt(rnc.data)}
Produto/Material: ${rnc.produto || "—"}
Fornecedor:       ${rnc.fornecedor || "—"}
Lote:             ${rnc.lote || "—"}
Qtd. afetada:     ${rnc.qtd || "—"}
Setor:            ${rnc.setor || "—"}
Detectado por:    ${rnc.detector || "—"}
Responsável:      ${rnc.resp || "—"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 DESCRIÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rnc.desc}
${rnc.ref ? `\nReferência: ${rnc.ref}` : ""}${rnc.evidencia ? `\nEvidências: ${rnc.evidencia}` : ""}
${rnc.contencao ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ AÇÃO DE CONTENÇÃO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.contencao}\nResponsável: ${rnc.respCont || "—"} | Data: ${fmt(rnc.dataContencao)}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗓️ PRAZOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Análise de causa:     ${fmt(rnc.prazoCausa)}
Ação corretiva:       ${fmt(rnc.prazoAC)}${past(rnc.prazoAC) && rnc.status !== "Eficaz" ? " ⚠ VENCIDO" : ""}
Verificação eficácia: ${fmt(rnc.prazoEfic)}
${rnc.ishikawa?.root ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 CAUSA RAIZ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.ishikawa.root}` : ""}${rnc.eficacia?.resultado ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ EFICÁCIA: ${rnc.eficacia.resultado.toUpperCase()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${rnc.eficacia.obs || ""}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Herbamed® · Sistema de Gestão da Qualidade
"Fornecendo Saúde. Cultivando Qualidade de Vida."`;
  return { subject, body };
}

export function EmailModal({ rnc, users, currentUser, evento, onClose, onSent }) {
  const T = useTheme(); const s = useS();
  const tpl = buildEmail(rnc, evento);
  const [to, setTo] = useState([]);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [extra, setExtra] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(1);

  const toggle = email => setTo(p => p.includes(email) ? p.filter(x => x !== email) : [...p, email]);
  const addExtra = () => { if (!extra.includes("@")) return; setTo(p => [...new Set([...p, extra])]); setExtra(""); };

  const send = async () => {
    const validTo = to.filter(e => e && e.includes("@"));
    if (!validTo.length) { setErr("Nenhum destinatário com e-mail válido selecionado."); return; }
    setSending(true); setErr("");
    try {
      // Envia um e-mail para cada destinatário via EmailJS
      const EMAILJS_SERVICE  = "service_gxhicii";
      const EMAILJS_TEMPLATE = "template_4jl73wq";
      const EMAILJS_KEY      = "z2VxJ1dYjwrRp8Nh4";

      for (const email of validTo) {
        const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id:  EMAILJS_SERVICE,
            template_id: EMAILJS_TEMPLATE,
            user_id:     EMAILJS_KEY,
            template_params: {
              to_email:    email,
              to_name:     users.find(u => u.email === email)?.name || email,
              from_name:   `${currentUser.name} · Herbamed® Gestão da Qualidade`,
              subject:     subject,
              message:     body,
              reply_to:    currentUser.email,
            }
          })
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Erro ao enviar para ${email}: ${txt}`);
        }
      }
      onSent(`E-mail enviado para ${validTo.length} destinatário(s)!`);
    } catch (e) { setErr("Erro: " + e.message); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 18, width: "100%", maxWidth: 740, maxHeight: "92vh", overflowY: "auto", boxShadow: `0 40px 100px #000d, 0 0 60px ${T.accentGlow}` }}>
        <div style={{ padding: "1.25rem 1.75rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.accentDim, border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✉️</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Notificar por e-mail</div>
              <div style={{ fontSize: 11, color: T.text2, marginTop: 2 }}>{rnc.num} · {rnc.produto || rnc.tipo}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[1, 2].map(n => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, cursor: n < step ? "pointer" : "default" }} onClick={() => n < step && setStep(n)}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: step === n ? `linear-gradient(135deg,${T.accent},${T.accent2})` : step > n ? T.accentDim : T.border, color: step === n ? "#fff" : step > n ? T.accent : T.text3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{step > n ? "✓" : n}</div>
                <span style={{ fontSize: 11, color: step === n ? T.text : T.text3, fontWeight: step === n ? 600 : 400 }}>{n === 1 ? "Destinatários" : "E-mail"}</span>
                {n < 2 && <span style={{ color: T.text3 }}>›</span>}
              </div>
            ))}
            <button onClick={onClose} style={{ background: T.border, border: "none", color: T.text2, cursor: "pointer", borderRadius: 8, padding: "6px 12px", fontSize: 16, fontFamily: "inherit" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "1.5rem 1.75rem" }}>
          {step === 1 && (
            <>
              <SecTitle icon="👥" ch="Quem deve receber?" />
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Usuários do sistema</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {users.map(u => (
                    <button key={u.email} onClick={() => toggle(u.email)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 20, border: `1px solid ${to.includes(u.email) ? T.accent + "55" : T.border2}`, background: to.includes(u.email) ? T.accentDim : T.surf, color: to.includes(u.email) ? T.accent : T.text2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: to.includes(u.email) ? `linear-gradient(135deg,${T.accent},${T.accent2})` : T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: to.includes(u.email) ? "#fff" : T.text2, flexShrink: 0 }}>{u.name?.[0] || "?"}</div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ lineHeight: 1.2 }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>{u.setor}</div>
                      </div>
                      {to.includes(u.email) && <span style={{ color: T.accent }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: 11, color: T.text3, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>E-mail externo</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Inp placeholder="email@empresa.com.br" value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => e.key === "Enter" && addExtra()} sx={{ flex: 1 }} />
                  <button style={{ ...s.btn, padding: "8px 14px" }} onClick={addExtra}>+ Adicionar</button>
                </div>
              </div>
              <div style={{ background: to.length ? T.accentDim : T.border, border: `1px solid ${to.length ? T.accent + "33" : T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: to.length ? T.accent : T.text3 }}>
                {to.length ? `✓ ${to.length} destinatário(s): ${to.join(", ")}` : "Nenhum destinatário selecionado."}
              </div>
              {err && <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={s.btn} onClick={onClose}>Cancelar</button>
                <button style={{ ...s.btnA, opacity: to.length ? 1 : .4 }} onClick={() => { if (!to.length) { setErr("Selecione ao menos um."); return; } setErr(""); setStep(2); }}>Revisar e-mail →</button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div style={{ background: T.accentDim, border: `1px solid ${T.accent}25`, borderRadius: 8, padding: "10px 14px", marginBottom: "1rem", fontSize: 12, color: T.accent }}>
                💡 Você pode enviar automaticamente <b>ou</b> copiar o conteúdo e colar no seu e-mail.
              </div>
              <div style={{ ...s.card, padding: "1rem", marginBottom: "1rem", fontSize: 12, color: T.text2 }}>
                <span style={{ color: T.text3, fontWeight: 600 }}>Para: </span>
                {to.map(e => <span key={e} style={{ background: T.accentDim, border: `1px solid ${T.accent}25`, borderRadius: 20, padding: "2px 9px", marginRight: 4, color: T.accent }}>{e}</span>)}
              </div>
              <F lbl="Assunto" ch={<Inp value={subject} onChange={e => setSubject(e.target.value)} sx={{ fontWeight: 500 }} />} />
              <F lbl="Corpo do e-mail" ch={<textarea value={body} onChange={e => setBody(e.target.value)} style={{ ...s.inp, minHeight: 320, fontFamily: "monospace", fontSize: 12, lineHeight: 1.75, resize: "vertical" }} />} />
              {err && <div style={{ background: "#ff4f6a18", border: "1px solid #ff4f6a30", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button style={s.btn} onClick={() => setStep(1)}>← Destinatários</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.btn} onClick={onClose}>Cancelar</button>
                  {/* Botão copiar conteúdo */}
                  <button style={{ ...s.btn, color:"#ff8c42", borderColor:"#ff8c4233", background:"#ff8c4212", display:"flex", alignItems:"center", gap:6 }}
                    onClick={() => {
                      const texto = `Para: ${to.join(", ")}\nAssunto: ${subject}\n\n${body}`;
                      navigator.clipboard.writeText(texto).then(() => {
                        onSent("Conteúdo copiado! Cole no seu e-mail.");
                      }).catch(() => {
                        // fallback para navegadores antigos
                        const ta = document.createElement("textarea");
                        ta.value = texto;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                        onSent("Conteúdo copiado! Cole no seu e-mail.");
                      });
                    }}>
                    📋 Copiar conteúdo
                  </button>
                  <button style={{ ...s.btnA, opacity: sending ? .6 : 1, minWidth: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={send} disabled={sending}>
                    {sending ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Enviando...</> : "✉️ Enviar agora"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
