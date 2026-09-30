import React, { useEffect } from "react";
import { rncAtiva } from "../../core/status";
import { useTheme } from "../../core/theme";
import { fmt, past, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { Badge, SevB } from "../../shared/ui";
import { contagemCapa, etapaParaContinuar, etapasDaRnc } from "./ferramentasLogic";

// Espiada da lista: painel ao lado da tabela com o essencial da RNC, para consultar
// várias em sequência (triagem, reunião) sem abrir a página inteira de cada uma.
// Só leitura — editar é sempre na ficha, pelos botões do rodapé.

const ICONE = { concluida: "✓", atual: "•", bloqueada: "🔒", dispensada: "—", pendente: "○" };

export function EspiadaRnc({ r, onFechar, abrirRnc }) {
  const T = useTheme(); const s = useS();
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const etapas = etapasDaRnc(r);
  const atual = etapaParaContinuar(r);
  const capa = contagemCapa(r, tod());
  const ativa = rncAtiva(r.status);
  const rot = { fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 };
  const corEstado = { concluida: T.accent, atual: T.blue, bloqueada: T.red, dispensada: T.text3, pendente: T.text3 };
  const prazo = (label, d) => {
    const venc = d && past(d) && ativa;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
        <span style={{ color: T.text2 }}>{label}</span>
        <span style={{ color: venc ? T.red : T.text, fontWeight: venc ? 600 : 400 }}>{d ? fmt(d) : "—"}{venc ? " · vencido" : ""}</span>
      </div>
    );
  };

  return (
    <aside style={{ ...s.card, position: "sticky", top: 12, display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }} aria-label={`Espiada da ${r.num}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{r.num}</div>
          <div style={{ fontSize: 11, color: T.text3 }}>{r.tipo} · aberta em {fmt(r.data)}</div>
        </div>
        <button onClick={onFechar} aria-label="Fechar espiada" title="Fechar (Esc)" style={{ background: "none", border: "none", cursor: "pointer", color: T.text3, fontSize: 16 }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Badge s={r.status} /><SevB s={r.sev} /></div>

      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, maxHeight: 110, overflow: "hidden" }}>{(r.desc || "").slice(0, 280)}{(r.desc || "").length > 280 ? "…" : ""}</div>

      <div>
        <div style={rot}>Etapas</div>
        {etapas.map((e, i) => (
          <div key={e.id} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0", color: corEstado[e.estado] }}>
            <span style={{ width: 14, textAlign: "center" }}>{ICONE[e.estado]}</span>
            <span style={{ fontWeight: e.estado === "atual" ? 600 : 400 }}>{i + 1} {e.label}</span>
          </div>
        ))}
        {atual?.motivo && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>🔒 {atual.motivo}</div>}
      </div>

      <div>
        <div style={rot}>Prazos</div>
        {prazo("Análise de causa", r.prazoCausa)}
        {prazo("Ação corretiva", r.prazoAC)}
        {prazo("Eficácia", r.prazoEfic)}
      </div>

      <div>
        <div style={rot}>Responsável · CAPA</div>
        <div style={{ fontSize: 12 }}>{r.resp || "—"}</div>
        <div style={{ fontSize: 12, color: capa.vencidas ? T.red : T.text2 }}>
          {capa.total ? `${capa.concluidas} de ${capa.total} ação(ões) concluída(s)${capa.vencidas ? ` · ${capa.vencidas} vencida(s)` : ""}` : "Sem plano CAPA"}
        </div>
        {(r.produto || r.lote) && <div style={{ fontSize: 12, color: T.text2 }}>{[r.produto, r.lote].filter(Boolean).join(" · ")}</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {atual && <button style={s.btnA} onClick={() => abrirRnc(r.id, atual.id)}>Continuar em "{atual.label}" →</button>}
        <button style={s.btn} onClick={() => abrirRnc(r.id)}>Abrir RNC completa</button>
      </div>
      <div style={{ fontSize: 10, color: T.text3, textAlign: "center" }}>Esc fecha · clique em outra linha para trocar</div>
    </aside>
  );
}
