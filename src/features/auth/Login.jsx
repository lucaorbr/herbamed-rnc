import React, { useState } from "react";
import { loginUser, getUser } from "../../firebase";
import { useTheme } from "../../core/theme";
import { HerbamedLogo } from "../../shared/ui";

export function Login({ onLogin }) {
  const T = useTheme();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const login = async () => {
    if (!email || !pw) { setErr("Preencha e-mail e senha."); return; }
    setLoading(true); setErr("");
    try {
      const cred = await loginUser(email, pw);
      const userData = await getUser(cred.user.uid);
      if (userData) onLogin({ ...userData, uid: cred.user.uid });
      else setErr("Usuário não encontrado no sistema.");
    } catch { setErr("E-mail ou senha incorretos."); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", minHeight:"100vh", background:"#050a06" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .login-inp:focus{border-color:#2ab84a!important;box-shadow:0 0 0 3px rgba(42,184,74,0.15)!important;}
        .login-btn:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(42,184,74,0.45)!important;}
      `}</style>

      {/* ── ESQUERDA — Banner ── */}
      <div style={{ flex:1, position:"relative", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Banner com overlay */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"url('https://res.cloudinary.com/dswsg9w0w/image/upload/2d2ff8b9-3439-4a2b-ab66-229769585268_dvsxdh')", backgroundSize:"cover", backgroundPosition:"center center", filter:"brightness(0.9)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, rgba(5,30,15,0.2) 0%, rgba(5,20,10,0.5) 70%, rgba(5,15,8,0.85) 100%)" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, transparent 60%, #0a110c 100%)" }} />

        {/* Content */}
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", justifyContent:"center", height:"100%", padding:"2.5rem" }}>
          {/* Top tag */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(42,184,74,0.15)", border:"1px solid rgba(42,184,74,0.3)", borderRadius:20, padding:"5px 14px", width:"fit-content", marginBottom:"2rem" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#2ab84a", animation:"pulse 2s infinite", display:"inline-block" }} />
            <span style={{ fontSize:11, fontWeight:600, color:"#2ab84a", textTransform:"uppercase", letterSpacing:".1em" }}>Sistema Online</span>
          </div>

          {/* Main text */}
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"4px", fontWeight:600, marginBottom:12 }}>Herbamed® · Qualidade</div>
            <div style={{ fontSize:42, fontWeight:800, color:"#ffffff", lineHeight:1.1, marginBottom:16, letterSpacing:"-.02em" }}>
              SGQ<br /><span style={{ color:"#2ab84a" }}>Herbamed</span>
            </div>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.6, maxWidth:400, marginBottom:28 }}>
              Sistema de Gestão da Qualidade integrado com inteligência artificial para análise e resolução de não conformidades.
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>
              "Fornecendo Saúde. Cultivando Qualidade de Vida."
            </div>
          </div>
        </div>
      </div>

      {/* ── DIREITA — Formulário ── */}
      <div style={{ width:460, background:"#0a110c", display:"flex", flexDirection:"column", borderLeft:"1px solid rgba(42,184,74,0.12)", position:"relative", overflow:"hidden" }}>
        {/* Glow top */}
        <div style={{ position:"absolute", top:-80, right:-80, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, rgba(42,184,74,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />

        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"3rem 2.75rem", position:"relative", zIndex:1 }}>

          {/* Logo */}
          <div style={{ marginBottom:"2.5rem", animation:"fadeUp .4s ease" }}>
            <div style={{ display:"inline-flex", background:"#fff", borderRadius:12, padding:"8px 20px", marginBottom:"1.5rem", boxShadow:"0 0 30px rgba(42,184,74,0.3)" }}>
              <HerbamedLogo height={32} white={false} />
            </div>
            <div style={{ fontSize:24, fontWeight:700, color:"#fff", letterSpacing:"-.02em", marginBottom:6 }}>
              Bem-vindo de volta
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.35)", lineHeight:1.5 }}>
              Entre com suas credenciais para acessar o SGQ Herbamed
            </div>
          </div>

          {/* Campos */}
          <div style={{ animation:"fadeUp .4s ease .1s both" }}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:8 }}>E-mail corporativo</label>
              <input
                className="login-inp"
                type="email" placeholder="seu@herbamed.com.br" value={email}
                onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
                style={{ width:"100%", padding:"13px 16px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, outline:"none", transition:"all .2s", boxSizing:"border-box" }}
              />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:8 }}>Senha</label>
              <div style={{ position:"relative" }}>
                <input
                  className="login-inp"
                  type={showPw?"text":"password"} placeholder="••••••••" value={pw}
                  onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
                  style={{ width:"100%", padding:"13px 44px 13px 16px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#fff", fontFamily:"inherit", fontSize:14, outline:"none", transition:"all .2s", boxSizing:"border-box" }}
                />
                <button onClick={()=>setShowPw(o=>!o)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:16, padding:0, fontFamily:"inherit" }}>
                  {showPw?"🙈":"👁️"}
                </button>
              </div>
            </div>

            {err && (
              <div style={{ background:"rgba(255,79,106,0.12)", border:"1px solid rgba(255,79,106,0.3)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#ff4f6a", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
                ⚠ {err}
              </div>
            )}

            <button
              className="login-btn"
              onClick={login} disabled={loading}
              style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#2ab84a,#1a7a3c)", border:"none", borderRadius:10, color:"#fff", fontSize:14, fontWeight:700, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", opacity:loading?.7:1, boxShadow:"0 4px 20px rgba(42,184,74,0.35)", letterSpacing:".3px", transition:"all .2s" }}
            >
              {loading?<span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={{ animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</span> Autenticando...</span>:"Entrar no SGQ →"}
            </button>
          </div>

          {/* Divider */}
          <div style={{ margin:"2rem 0", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>acesso seguro</span>
            <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.06)" }} />
          </div>

          {/* Security badges */}
          <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
            {[["🔒","Firebase Auth"],["☁️","Cloud Seguro"],["🔐","Criptografado"]].map(([icon,label])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:20 }}>
                <span style={{ fontSize:11 }}>{icon}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"1.25rem 2.75rem", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.18)" }}>© {new Date().getFullYear()} Herbamed®</div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.18)" }}>SGQ v2.0 · Acesso restrito</div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
