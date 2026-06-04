import React, { useState } from "react";
import { changePassword } from "../../firebase";
import { useTheme } from "../../core/theme";

// forced=true: modal bloqueante para senha temporária
// forced=false: modal voluntário (botão "Mudar senha")
export function TrocarSenhaModal({ forced = false, onSuccess, onClose }) {
  const T = useTheme();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (!senhaAtual) { setErr("Informe a senha atual."); return; }
    if (senhaNova.length < 8) { setErr("Nova senha deve ter no mínimo 8 caracteres."); return; }
    if (senhaNova !== senhaConf) { setErr("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      await changePassword(senhaAtual, senhaNova);
      onSuccess();
    } catch (e) {
      setErr(e.message || "Erro ao alterar senha.");
    }
    setLoading(false);
  };

  const inp = {
    width: "100%", padding: "10px 36px 10px 12px", background: T.surf, border: `1px solid ${T.border2}`,
    borderRadius: 8, color: T.text, fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)",
    zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
  };
  const box = {
    background: T.card, border: `1px solid ${T.border2}`, borderRadius: 16,
    padding: "2rem", width: 420, maxWidth: "94vw", boxShadow: "0 24px 64px rgba(0,0,0,.6)",
  };

  return (
    <div style={overlay} onClick={forced ? undefined : onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            {forced ? "🔐 Troque sua senha" : "🔑 Mudar senha"}
          </div>
          {forced && (
            <div style={{ fontSize: 12, color: T.yellow, background: "#ffd16615", border: "1px solid #ffd16630", borderRadius: 8, padding: "8px 12px" }}>
              Sua senha é temporária. Crie uma senha pessoal para continuar.
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: T.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 5 }}>Senha atual</label>
          <div style={{ position: "relative" }}>
            <input type={showAtual ? "text" : "password"} value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} style={inp} placeholder="Senha atual" />
            <button onClick={() => setShowAtual(o => !o)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.text3, fontSize: 14 }}>{showAtual ? "🙈" : "👁️"}</button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: T.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 5 }}>Nova senha</label>
          <div style={{ position: "relative" }}>
            <input type={showNova ? "text" : "password"} value={senhaNova} onChange={e => setSenhaNova(e.target.value)} style={inp} placeholder="Mínimo 8 caracteres" />
            <button onClick={() => setShowNova(o => !o)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.text3, fontSize: 14 }}>{showNova ? "🙈" : "👁️"}</button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: T.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 5 }}>Confirmar nova senha</label>
          <input type="password" value={senhaConf} onChange={e => setSenhaConf(e.target.value)} style={{ ...inp, borderColor: senhaConf && senhaNova && senhaConf !== senhaNova ? "#ff4f6a" : T.border2 }} placeholder="Repita a nova senha" onKeyDown={e => e.key === "Enter" && submit()} />
        </div>

        {err && (
          <div style={{ background: "rgba(255,79,106,0.12)", border: "1px solid rgba(255,79,106,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#ff4f6a", marginBottom: 14 }}>
            ⚠ {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {!forced && <button onClick={onClose} style={{ padding: "9px 18px", border: `1px solid ${T.border2}`, borderRadius: 8, background: "none", color: T.text2, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Cancelar</button>}
          <button
            onClick={submit} disabled={loading}
            style={{ padding: "9px 20px", background: `linear-gradient(135deg,${T.accent},${T.accent2||T.accent})`, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Atualizando..." : "Atualizar senha →"}
          </button>
        </div>
      </div>
    </div>
  );
}
