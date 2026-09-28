import React, { useState } from "react";
import { loginUser, getUser } from "../../firebase";
import { IconeSGQ } from "../../shared/IconeSGQ";
import { APP_VERSION_LABEL } from "../../config/appVersion";

// A tela de login é desenhada como o "rosto" dos PDFs do sistema (buildPDFShell):
// faixa verde no topo, folha branca no meio, rodapé fino. Quem entra já vê a mesma
// folha que o sistema imprime. Cores fixas de propósito: a tela vem antes do tema do usuário.
const C = {
  mesa: "#e9ece8", folha: "#ffffff", borda: "#d5dbd6",
  verde: "#1a4a2e", verdeHover: "#143a24", claro: "#f3f7f1", verdeTexto: "#b9cfbf",
  rodape: "#edf2ed", texto: "#17231b", texto2: "#3d4a41", texto3: "#5b6b60",
  campo: "#cfd8d1",
};

export function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const login = async e => {
    e.preventDefault();
    if (!email || !pw) { setErr("Preencha usuário/e-mail e senha."); return; }
    setLoading(true); setErr("");
    try {
      const cred = await loginUser(email, pw);
      const userData = await getUser(cred.user.uid);
      if (userData) onLogin({ ...userData, uid: cred.user.uid });
      else setErr("Usuário não encontrado no sistema.");
    } catch { setErr("Usuário/e-mail ou senha incorretos."); }
    setLoading(false);
  };

  const label = { fontSize: 13, fontWeight: 500, color: C.texto2, display: "block", marginBottom: 6 };
  const input = {
    width: "100%", padding: "11px 12px", background: C.folha, border: `1px solid ${C.campo}`,
    borderRadius: 8, color: C.texto, fontFamily: "inherit", fontSize: 14, outline: "none",
    boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s",
  };

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", minHeight: "100vh", background: C.mesa,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box" }}>
      <style>{`
        .login-inp:focus{border-color:${C.verde}!important;box-shadow:0 0 0 3px rgba(26,74,46,.15)!important;}
        .login-inp:-webkit-autofill{-webkit-box-shadow:0 0 0 40px ${C.folha} inset!important;-webkit-text-fill-color:${C.texto}!important;}
        .login-inp::placeholder{color:#8a978e;}
        .login-btn:hover:not(:disabled){background:${C.verdeHover}!important;}
        .login-btn:focus-visible,.login-ver:focus-visible{outline:2px solid ${C.verde};outline-offset:2px;}
      `}</style>

      <main style={{ width: "100%", maxWidth: 420, background: C.folha, border: `1px solid ${C.borda}`, borderRadius: 6,
        overflow: "hidden", boxShadow: "0 1px 2px rgba(23,35,27,.06), 0 12px 32px rgba(23,35,27,.08)" }}>

        {/* Faixa verde — o cabeçalho de todo PDF do SGQ */}
        <header style={{ background: C.verde, padding: "18px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <IconeSGQ size={38} fundo={C.claro} folha={C.verde} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.claro, fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>SGQ Herbamed</div>
            <div style={{ color: C.verdeTexto, fontSize: 12, marginTop: 2 }}>Sistema de Gestão da Qualidade</div>
          </div>
          <div style={{ color: C.verdeTexto, fontSize: 11, textAlign: "right", lineHeight: 1.4 }}>
            Versão<br /><span style={{ color: C.claro, fontWeight: 500 }}>{APP_VERSION_LABEL}</span>
          </div>
        </header>

        {/* Folha */}
        <form onSubmit={login} noValidate style={{ padding: "28px 24px 26px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: C.texto, margin: 0 }}>Entrar</h1>
          <p style={{ fontSize: 13, color: C.texto3, margin: "4px 0 22px" }}>Use seu usuário ou e-mail corporativo.</p>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-usuario" style={label}>Usuário ou e-mail</label>
            <input id="login-usuario" className="login-inp" type="text" autoComplete="username" autoFocus
              placeholder="seu.nome@herbamed.com.br" value={email} onChange={e => setEmail(e.target.value)} style={input} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label htmlFor="login-senha" style={label}>Senha</label>
            <div style={{ position: "relative" }}>
              <input id="login-senha" className="login-inp" type={showPw ? "text" : "password"} autoComplete="current-password"
                value={pw} onChange={e => setPw(e.target.value)} style={{ ...input, paddingRight: 76 }} />
              <button type="button" className="login-ver" onClick={() => setShowPw(o => !o)}
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPw}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none",
                  color: C.texto3, cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: "6px 8px", borderRadius: 6 }}>
                {showPw ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div aria-live="polite">
            {err && (
              <div style={{ background: "#fdeeee", border: "1px solid #f1c4c4", borderRadius: 8, padding: "10px 12px",
                fontSize: 13, color: "#8f1f1f", marginBottom: 16 }}>{err}</div>
            )}
          </div>

          <button type="submit" className="login-btn" disabled={loading}
            style={{ width: "100%", padding: "12px", background: C.verde, border: "none", borderRadius: 8, color: C.claro,
              fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
              opacity: loading ? .75 : 1, transition: "background .15s" }}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        {/* Rodapé fino, como o dos PDFs */}
        <footer style={{ background: C.rodape, padding: "10px 24px", display: "flex", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap", fontSize: 11, color: C.texto3 }}>
          <span>© {new Date().getFullYear()} Herbamed®</span>
          <span>Acesso restrito a colaboradores</span>
        </footer>
      </main>

      <p style={{ fontSize: 12, color: "#7a8a7f", fontStyle: "italic", margin: "18px 0 0", textAlign: "center" }}>
        Fornecendo saúde. Cultivando qualidade de vida.
      </p>
    </div>
  );
}
