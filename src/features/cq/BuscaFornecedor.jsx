import React, { useMemo, useRef, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { casaFornecedor, escolhaAoSair, filtrarFornecedores, normalizarBusca } from "./fornecedorBuscaLogic";

// Campo de fornecedor com busca por qualquer parte do nome ou pelo CNPJ.
// Substitui o <select> nativo, que só pulava para o nome que COMEÇA com o que se digita.
// `value`/`onChange` trabalham com o nome do fornecedor (string), como o <select> antigo.
// `sugestoes` ([{ fornecedor, motivo }]) aparecem no topo; `extras` ([{ value, label }]) no fim.
export function BuscaFornecedor({ value, onChange, fornecedores = [], sugestoes = [], extras = [], placeholder = "Digite parte do nome ou o CNPJ..." }) {
  const T = useTheme(); const s = useS();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  // Texto digitado que não virou escolha (havia mais de uma opção ao sair do campo).
  // Fica à vista com aviso, em vez de sumir — antes, digitar e sair com Tab apagava tudo.
  const [rascunho, setRascunho] = useState("");
  const inputRef = useRef(null);
  // O Tab escolhe no keydown e o blur vem logo depois, ainda com o estado antigo: sem
  // esta marca, o blur reavaliaria o texto e poderia sobrescrever a escolha.
  const escolhido = useRef(false);
  const listaRef = useRef(null);

  const opcoes = useMemo(() => {
    const chavesSug = new Set(sugestoes.map(x => normalizarBusca(x.fornecedor.nome)));
    const sug = sugestoes
      .filter(x => casaFornecedor(x.fornecedor, termo))
      .map(x => ({ value: x.fornecedor.nome, label: x.fornecedor.nome, detalhe: x.motivo, grupo: "sug" }));
    const resto = filtrarFornecedores(fornecedores, termo)
      .filter(f => !chavesSug.has(normalizarBusca(f.nome)))
      .map(f => ({ value: f.nome, label: f.nome, detalhe: f.cnpj || "", grupo: "todos" }));
    const ext = extras
      .filter(x => !termo.trim() || normalizarBusca(x.label).includes(normalizarBusca(termo)))
      .map(x => ({ ...x, grupo: "extra" }));
    return [...sug, ...resto, ...ext];
  }, [fornecedores, sugestoes, extras, termo]);

  const abrir = () => { escolhido.current = false; setTermo(rascunho); setAtivo(0); setAberto(true); };
  const fechar = (op) => { escolhido.current = true; if (op) onChange(op.value); setAberto(false); setTermo(""); setRascunho(""); };
  const escolher = (op) => { fechar(op); inputRef.current?.blur(); };
  // Saiu do campo (Tab, clique fora) sem escolher: escolhe sozinho quando não há dúvida.
  const aoSair = () => {
    if (!aberto || escolhido.current) return;
    const t = termo.trim();
    if (!t) { setAberto(false); setRascunho(""); return; }
    const op = escolhaAoSair(opcoes, t);
    if (op) { fechar(op); return; }
    setAberto(false); setRascunho(termo);
  };
  const rolarPara = (i) => {
    const el = listaRef.current?.querySelector(`[data-idx="${i}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e) => {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) { e.preventDefault(); abrir(); return; }
    if (!aberto) return;
    if (e.key === "ArrowDown") { e.preventDefault(); const i = Math.min(ativo + 1, opcoes.length - 1); setAtivo(i); rolarPara(i); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const i = Math.max(ativo - 1, 0); setAtivo(i); rolarPara(i); }
    else if (e.key === "Enter") { e.preventDefault(); if (opcoes[ativo]) escolher(opcoes[ativo]); }
    // Tab escolhe a opção destacada (com texto digitado) e segue para o próximo campo.
    else if (e.key === "Tab") { if (termo.trim() && opcoes[ativo]) fechar(opcoes[ativo]); }
    else if (e.key === "Escape") { setAberto(false); setTermo(""); setRascunho(""); }
  };

  const rotuloExtra = extras.find(x => x.value === value)?.label;
  const titulo = (txt) => (
    <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 700, color: T.text3, textTransform: "uppercase", letterSpacing: ".05em" }}>{txt}</div>
  );

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        style={{ ...s.inp, width: "100%", paddingRight: value ? 30 : 12, ...(rascunho && !aberto ? { borderColor: "#ff4f6a" } : {}) }}
        value={aberto ? termo : (rascunho || rotuloExtra || value || "")}
        placeholder={aberto && value ? `${rotuloExtra || value} — digite para trocar` : placeholder}
        onFocus={abrir}
        onClick={() => { if (!aberto) abrir(); }}
        onBlur={aoSair}
        onChange={e => { escolhido.current = false; setTermo(e.target.value); setAtivo(0); if (!aberto) setAberto(true); }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {rascunho && !aberto && (
        <div style={{ fontSize: 11, color: "#ff4f6a", marginTop: 4 }}>
          "{rascunho}" combina com mais de um fornecedor — clique no campo e escolha um da lista.
        </div>
      )}
      {value && !aberto && !rascunho && (
        <button type="button" title="Limpar" onMouseDown={e => { e.preventDefault(); onChange(""); }}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: T.text3, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
      )}
      {aberto && (
        <div ref={listaRef} role="listbox"
          style={{ position: "absolute", zIndex: 50, top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 300, overflowY: "auto", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
          {opcoes.length === 0 && (
            <div style={{ padding: "12px", fontSize: 12, color: T.text3 }}>Nenhum fornecedor encontrado para "{termo}".</div>
          )}
          {opcoes.length > 0 && (
            <div style={{ padding: "5px 10px", fontSize: 10, color: T.text3, borderBottom: `1px solid ${T.border}` }}>
              ↑↓ navegar · <strong>Enter</strong> ou <strong>Tab</strong> escolhe o destacado · Esc fecha
            </div>
          )}
          {opcoes.map((op, i) => {
            const grupoMudou = i === 0 || opcoes[i - 1].grupo !== op.grupo;
            const sel = op.value === value;
            return (
              <React.Fragment key={`${op.grupo}-${op.value}`}>
                {grupoMudou && op.grupo === "sug" && titulo("Fornecedores deste material")}
                {grupoMudou && op.grupo === "todos" && titulo(termo.trim() ? "Fornecedores encontrados" : "Todos os fornecedores")}
                {grupoMudou && op.grupo === "extra" && opcoes.some(o => o.grupo !== "extra") && <div style={{ height: 1, background: T.border, margin: "4px 0" }} />}
                <div data-idx={i} role="option" aria-selected={i === ativo}
                  onMouseDown={e => { e.preventDefault(); escolher(op); }}
                  onMouseEnter={() => setAtivo(i)}
                  style={{ padding: "7px 10px", cursor: "pointer", background: i === ativo ? T.accentDim : "transparent", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: sel ? T.accent : T.text, fontWeight: sel ? 700 : 500 }}>{sel ? "✓ " : ""}{op.label}</span>
                  {op.detalhe && <span style={{ fontSize: 10, color: op.grupo === "sug" ? T.accent : T.text3, whiteSpace: "nowrap" }}>{op.detalhe}</span>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
