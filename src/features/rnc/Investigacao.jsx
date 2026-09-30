import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { SecTitle, TA } from "../../shared/ui";
import { novoRegistroInvestigacao, patchInvestigacao } from "./ferramentasLogic";

// Investigação da RNC (etapa 3): o que foi apurado — ensaios, medições, comparações —
// com os laudos. Append-only: cada registro fica com autor e data e não se edita nem se
// apaga; correção entra como registro novo. Fica antes do Ishikawa/5 Porquês porque é a
// evidência que sustenta a causa raiz.

const quando = iso => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return iso; } };

export function Investigacao({ r, user, toast_, gravar, podeRegistrar }) {
  const T = useTheme(); const s = useS();
  const registros = r.investigacao || [];
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const registrar = async () => {
    const { registro, erro: e } = novoRegistroInvestigacao(texto, anexos, user?.name || "—", new Date().toISOString());
    if (e) { setErro(e); return; }
    setSalvando(true);
    try {
      await gravar(patchInvestigacao(r, registro, tod(), new Date().toLocaleTimeString("pt-BR")));
      setTexto(""); setAnexos([]); setErro("");
      toast_("Investigação registrada.", "green");
    } catch { /* doUpdateRNC já avisou */ }
    setSalvando(false);
  };

  return (
    <div style={{ ...s.card, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <SecTitle icon="🔬" ch={`Investigação${registros.length ? ` — ${registros.length} registro(s)` : ""}`} />
        <span style={{ fontSize: 11, color: T.text3 }}>Ensaios, medições e comparações que sustentam a causa raiz</span>
      </div>

      {registros.length === 0 && !podeRegistrar && <div style={{ fontSize: 12, color: T.text3 }}>Nenhuma investigação registrada.</div>}

      {registros.map((reg, i) => (
        <div key={reg.id || i} style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>#{i + 1} · {reg.por} · {quando(reg.em)}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{reg.texto}</div>
          {reg.anexos?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {reg.anexos.map((a, j) => <a key={j} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent }}>📎 {a.name}</a>)}
            </div>
          )}
        </div>
      ))}

      {podeRegistrar && (
        <div style={{ borderTop: registros.length ? `1px dashed ${T.border2}` : "none", paddingTop: registros.length ? 10 : 0 }}>
          <TA rows={4} value={texto} onChange={e => { setTexto(e.target.value); if (erro) setErro(""); }}
            placeholder={"O que foi feito e o resultado. Ex.:\nUmidade da mistura — fórmula antiga: 3,1% · fórmula nova: 1,2%\nUmidade das cápsulas após 30 dias: 13,5% → 9,8%"} />
          {erro && <div style={{ fontSize: 12, color: T.red, marginTop: 4 }} aria-live="polite">{erro}</div>}
          <div style={{ marginTop: 8 }}>
            <AnexosUpload inputId={`inv-anexos-${r.id}`} anexos={anexos} setAnexos={novos => setAnexos(prev => typeof novos === "function" ? novos(prev) : novos)} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.text3 }}>Registro não se edita nem se apaga — para corrigir, registre de novo.</span>
            <button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={registrar}>{salvando ? "Registrando…" : "Registrar investigação"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
