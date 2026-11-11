import React, { useState } from "react";
import { useTheme } from "../../core/theme";
import { fmt, tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { AnexosUpload } from "../../shared/AnexosUpload";
import { F, Inp, SecTitle, TA } from "../../shared/ui";
import { evidenciasDaRnc, novaReuniaoInterna, patchReuniaoInterna } from "./tipoRncLogic";

// Reuniões internas da RNC INTERNA (v3.29.0). Diferente da RAC: é a reunião da equipe que
// investiga esta RNC (produção, P&D, Qualidade), não o fórum de gestão. Opcional.
// Append-only: cada reunião fica com autor e data e não se edita; corrige-se registrando outra.

const quando = iso => { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch { return iso || ""; } };
const vazio = () => ({ data: tod(), local: "", participantes: "", decidido: "", anexos: [] });

export function ReunioesInternas({ r, user, toast_, gravar, podeRegistrar }) {
  const T = useTheme(); const s = useS();
  const reunioes = r.reunioesInternas || [];
  const [f, setF] = useState(vazio);
  const [erros, setErros] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const registrar = async () => {
    const { reuniao, erros: e } = novaReuniaoInterna(f, user.name, new Date().toISOString());
    if (e) { setErros(e); return; }
    setSalvando(true);
    try {
      await gravar(patchReuniaoInterna(r, reuniao, tod(), new Date().toLocaleTimeString("pt-BR")));
      setF(vazio()); setErros([]); toast_("Reunião interna registrada.", "green");
    } catch { /* já avisado */ }
    setSalvando(false);
  };

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14 }}>
        <SecTitle icon="👥" ch="Reuniões internas" />
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>Opcional. Registre aqui as reuniões da equipe sobre esta RNC: quem participou e o que foi decidido. Não é a Reunião de Análise Crítica.</div>
        {!reunioes.length && <div style={{ fontSize: 12, color: T.text3 }}>Nenhuma reunião registrada.</div>}
        {[...reunioes].reverse().map((m, i) => (
          <div key={m.id || i} style={{ borderTop: i ? `1px dashed ${T.border}` : "none", padding: "10px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(m.data)}{m.local ? ` · ${m.local}` : ""}</div>
            <div style={{ fontSize: 12, color: T.text2, margin: "3px 0" }}>Participantes: {m.participantes}</div>
            <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.decidido}</div>
            {(m.anexos || []).length > 0 && <div style={{ marginTop: 4 }}>{m.anexos.map((a, j) => <a key={j} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.accent, marginRight: 10 }}>📎 {a.name}</a>)}</div>}
            <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>Registrada por {m.por} em {quando(m.em)}</div>
          </div>
        ))}
      </div>

      {podeRegistrar && (
        <div style={s.card}>
          <SecTitle icon="➕" ch="Registrar reunião" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
            <F lbl="Data *" ch={<Inp type="date" value={f.data} onChange={e => set("data", e.target.value)} />} />
            <F lbl="Local" ch={<Inp value={f.local} onChange={e => set("local", e.target.value)} placeholder="Ex.: sala da Qualidade" />} />
          </div>
          <F lbl="Participantes *" ch={<Inp value={f.participantes} onChange={e => set("participantes", e.target.value)} placeholder="Ex.: Ana (Qualidade), Bruno (Produção), Carla (P&D)" />} />
          <F lbl="O que foi decidido *" ch={<TA rows={4} value={f.decidido} onChange={e => set("decidido", e.target.value)} placeholder="Ex.: testar a umidade da fórmula antiga e da nova; P&D traz o resultado na sexta." />} />
          <AnexosUpload inputId={`reuniao-int-${r.id}`} anexos={f.anexos} setAnexos={n => setF(p => ({ ...p, anexos: typeof n === "function" ? n(p.anexos) : n }))} />
          {erros.length > 0 && <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>{erros.join(" ")}</div>}
          <div style={{ textAlign: "right", marginTop: 10 }}>
            <button style={{ ...s.btnA, opacity: salvando ? .6 : 1 }} disabled={salvando} onClick={registrar}>Registrar reunião</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Todos os anexos da RNC num lugar só, com a etapa de onde vieram. Só leitura. */
export function EvidenciasRnc({ r }) {
  const T = useTheme(); const s = useS();
  const ev = evidenciasDaRnc(r);
  return (
    <div style={s.card}>
      <SecTitle icon="🗂️" ch={`Evidências (${ev.length})`} />
      <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>Os anexos de todas as etapas. Para incluir um anexo, registre-o na etapa a que ele pertence.</div>
      {!ev.length ? <div style={{ fontSize: 12, color: T.text3 }}>Nenhum anexo ainda.</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ color: T.text3, textAlign: "left" }}><th style={{ padding: "4px 6px" }}>Arquivo</th><th style={{ padding: "4px 6px" }}>Etapa</th><th style={{ padding: "4px 6px" }}>Data</th><th style={{ padding: "4px 6px" }}>Por</th></tr></thead>
          <tbody>{ev.map((x, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ padding: "6px" }}><a href={x.anexo.url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>📎 {x.anexo.name}</a></td>
              <td style={{ padding: "6px" }}>{x.etapa}</td>
              <td style={{ padding: "6px" }}>{x.data ? (String(x.data).length > 10 ? quando(x.data) : fmt(x.data)) : "—"}</td>
              <td style={{ padding: "6px" }}>{x.por || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}
