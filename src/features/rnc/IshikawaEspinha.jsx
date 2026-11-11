import React, { useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { layoutEspinha, medidaCanvas, pintura, temCausasIshikawa } from "./ishikawaEspinhaLogic";

// Ishikawa desenhado como espinha de peixe (v3.30.0). A geometria vem de
// ishikawaEspinhaLogic (a mesma do PDF); aqui só se escolhe a cor de cada papel pelo
// tema e se liga o clique: clicar numa causa marca a que os 5 Porquês aprofundam.

const CHAVE_VISTA = "sgq_ishikawa_vista";

/** Espinha ou grade: escolha de cada pessoa, lembrada no navegador. */
export function useVistaIshikawa() {
  const [vista, setVistaEstado] = useState(() => { try { return localStorage.getItem(CHAVE_VISTA) === "grade" ? "grade" : "espinha"; } catch { return "espinha"; } });
  const setVista = v => { setVistaEstado(v); try { localStorage.setItem(CHAVE_VISTA, v); } catch { /* sem armazenamento: vale só nesta tela */ } };
  return [vista, setVista];
}

export function SeletorVistaIshikawa({ vista, setVista }) {
  const T = useTheme();
  const btn = ativo => ({ fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "4px 10px", border: 0, cursor: "pointer", background: ativo ? T.accent : "transparent", color: ativo ? "#fff" : T.text2 });
  return (
    <span role="group" aria-label="Visualização do Ishikawa" style={{ display: "inline-flex", border: `1px solid ${T.border2}`, borderRadius: 7, overflow: "hidden" }}>
      <button type="button" aria-pressed={vista === "espinha"} style={btn(vista === "espinha")} onClick={() => setVista("espinha")}>🐟 Espinha</button>
      <button type="button" aria-pressed={vista === "grade"} style={btn(vista === "grade")} onClick={() => setVista("grade")}>▦ Grade</button>
    </span>
  );
}

const FONTE_TELA = "Inter, 'Segoe UI', system-ui, sans-serif";
const medeCanvas = medidaCanvas(FONTE_TELA);

/** O desenho. Sem `onMarcar`, só leitura. */
export function IshikawaEspinha({ ishikawa, onMarcar }) {
  const T = useTheme();
  const cores = {
    osso: T.accent, cabecaFundo: T.accentDim, texto: T.text, apagado: T.text3, destaque: T.accent, sobreDestaque: "#fff",
    fundo: T.card, ramo: T.border2, sel: T.orange || "#c4572a", selFundo: `${T.orange || "#c4572a"}22`,
  };
  const layout = useMemo(() => layoutEspinha(ishikawa || {}, medeCanvas), [ishikawa]);
  if (!temCausasIshikawa(ishikawa)) {
    return <div style={{ fontSize: 12, color: T.text3, border: `1px dashed ${T.border2}`, borderRadius: 8, padding: "14px", textAlign: "center", marginBottom: 10 }}>A espinha aparece aqui assim que houver causas levantadas.</div>;
  }
  const desenha = (e, i) => {
    if (e.tag === "g") {
      const marcar = onMarcar ? () => onMarcar(e.causa) : undefined;
      return (
        <g key={i} style={{ cursor: onMarcar ? "pointer" : "default" }} onClick={marcar}
          {...(onMarcar ? { tabIndex: 0, role: "button", "aria-pressed": e.marcada, "aria-label": `${e.categoria}: ${e.causa}. Marcar para os 5 Porquês`, onKeyDown: ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); marcar(); } } } : {})}>
          {e.filhos.map(desenha)}
          <title>{e.causa}</title>
        </g>
      );
    }
    const Tag = e.tag;
    const attrs = { ...e.attrs, ...pintura(e.papel, cores) };
    // atributos SVG com hífen viram camelCase no React
    const props = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/-([a-z])/g, (_, l) => l.toUpperCase()), v]));
    return <Tag key={i} {...props}>{e.texto}</Tag>;
  };
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8, background: T.surf, marginBottom: 10 }}>
      <svg viewBox={`0 0 ${layout.largura} ${layout.altura}`} role="img" aria-label={`Diagrama de Ishikawa: ${ishikawa?.efeito || ""}`}
        style={{ display: "block", width: "100%", maxWidth: 1000, margin: "0 auto", minWidth: 760, height: "auto", fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif" }}>
        {layout.elementos.map(desenha)}
      </svg>
    </div>
  );
}
