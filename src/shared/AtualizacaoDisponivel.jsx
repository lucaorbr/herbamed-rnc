import React, { useEffect, useState } from "react";
import { APP_VERSION } from "../config/appVersion";
import { useTheme } from "../core/theme";

// Confere periodicamente o /version.json publicado (gerado no build a partir do
// package.json) contra a versão embutida neste bundle (APP_VERSION). Quando divergem,
// significa que a TI já subiu uma versão nova e este usuário está rodando uma aba
// antiga — mostra uma faixa fixa com botão "Atualizar agora". Não recarrega sozinho:
// o usuário decide quando, para não perder um preenchimento em andamento.
const INTERVALO_MS = 3 * 60 * 1000; // 3 minutos

export function AtualizacaoDisponivel() {
  const T = useTheme();
  const [novaVersao, setNovaVersao] = useState(null);

  useEffect(() => {
    let vivo = true;
    const conferir = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (vivo && data?.version && data.version !== APP_VERSION) {
          setNovaVersao(data.version);
        }
      } catch { /* offline ou arquivo ausente (ex.: dev) — apenas ignora */ }
    };
    conferir();
    const id = setInterval(conferir, INTERVALO_MS);
    // Reconfere quando o usuário volta para a aba (caso comum: aba aberta o dia todo).
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
  }, []);

  if (!novaVersao) return null;

  const accent = T?.accent || "#2ab84a";
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 4000, display: "flex", justifyContent: "center", padding: "0 12px 14px", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center", background: T?.card || "#12241a", color: T?.text || "#eaf5ee", border: `1px solid ${accent}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 12px 40px #0007", maxWidth: 660 }}>
        <span style={{ fontSize: 20 }}>🔄</span>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
          <strong>Nova versão disponível</strong> (v{novaVersao}).<br />
          <span style={{ color: T?.text2 || "#9fb3a6", fontSize: 12 }}>Você está usando a v{APP_VERSION}. Atualize para receber as últimas melhorias e correções.</span>
        </div>
        <button onClick={() => window.location.reload()}
          style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
