// Editor de catálogo simples — lista de `{ nome, ativo }`.
//
// Tipos de Desvio e Setores de Desvio tinham o mesmo editor duplicado linha a
// linha no AdminTab. Ao levar cada catálogo para dentro do seu módulo a cópia
// viraria tripla, então virou um componente só.
//
// Duas regras do SGQ que o componente carrega por padrão:
//   • item já usado por algum registro **não se exclui, desativa-se** — excluir
//     apagaria o rótulo de registros já emitidos. O aviso da exclusão diz isso.
//   • `protegidos` (na prática, "Outros") não pode ser renomeado, desativado nem
//     excluído: é a válvula de escape do texto livre e o código garante que ele
//     apareça no formulário de qualquer forma.

import React, { useState } from "react";
import { useTheme } from "../core/theme";
import { useS } from "./styles";

export function CatalogoSimples({
  itens = [],
  onPersist,
  salvando = false,
  isAdmin = false,
  toast_ = () => {},
  rotulo = "item",
  placeholder = "Nome",
  protegidos = ["Outros"],
  avisoExclusao,
  textoSalvar = "💾 Salvar",
}) {
  const T = useTheme(); const s = useS();
  const [novo, setNovo] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editNome, setEditNome] = useState("");

  const ehProtegido = (nome) => protegidos.some(p => p.toLowerCase() === String(nome || "").toLowerCase());
  const jaExiste = (nome, ignorarIdx = -1) =>
    itens.some((x, j) => j !== ignorarIdx && String(x.nome || "").toLowerCase() === nome.toLowerCase());

  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    if (jaExiste(nome)) { toast_(`Esse ${rotulo} já existe.`, "red"); return; }
    setNovo("");
    onPersist([...itens, { nome, ativo: true }]);
  };

  const confirmarEdicao = (i) => {
    const nome = editNome.trim();
    if (!nome) return;
    if (jaExiste(nome, i)) { toast_(`Esse ${rotulo} já existe.`, "red"); return; }
    setEditIdx(null);
    onPersist(itens.map((x, j) => j === i ? { ...x, nome } : x));
  };

  const excluir = (i, item) => {
    const aviso = avisoExclusao || `Registros já criados com este ${rotulo} não são afetados, mas perdem o rótulo. Prefira desativar se já foi usado.`;
    if (!window.confirm(`Excluir o ${rotulo} "${item.nome}" do catálogo?\n\n${aviso}`)) return;
    onPersist(itens.filter((_, j) => j !== i));
  };

  const btnMini = { ...s.btn, fontSize: 11, padding: "4px 10px" };

  return (<>
    {isAdmin && (
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder={placeholder} value={novo}
          onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") adicionar(); }}
          style={{ ...s.inp, flex: 1, fontSize: 12 }} />
        <button style={s.btnA} onClick={adicionar}>+ Adicionar</button>
      </div>
    )}

    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 420, overflowY: "auto" }}>
      {itens.length === 0 && (
        <div style={{ fontSize: 12, color: T.text3, padding: "14px 0", textAlign: "center" }}>
          Nenhum {rotulo} cadastrado.
        </div>
      )}
      {itens.map((item, i) => {
        const travado = ehProtegido(item.nome);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8 }}>
            {editIdx === i ? (<>
              <input value={editNome} autoFocus
                onChange={e => setEditNome(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmarEdicao(i); if (e.key === "Escape") setEditIdx(null); }}
                style={{ ...s.inp, flex: 1, fontSize: 12 }} />
              <button style={s.btnA} onClick={() => confirmarEdicao(i)}>✓</button>
              <button style={s.btn} onClick={() => setEditIdx(null)}>✕</button>
            </>) : (<>
              <span style={{ flex: 1, fontSize: 12, color: T.text, minWidth: 0 }}>{item.nome}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: item.ativo !== false ? T.accent + "22" : "#ff4f6a22", color: item.ativo !== false ? T.accent : "#ff4f6a", fontWeight: 700 }}>
                {item.ativo !== false ? "Ativo" : "Inativo"}
              </span>
              {travado ? (
                <span style={{ fontSize: 10, color: T.text3, fontStyle: "italic" }}>sempre disponível</span>
              ) : isAdmin && (<>
                <button style={btnMini} onClick={() => { setEditIdx(i); setEditNome(item.nome); }}>✏️</button>
                <button style={btnMini} onClick={() => onPersist(itens.map((x, j) => j === i ? { ...x, ativo: x.ativo === false } : x))}>
                  {item.ativo !== false ? "🔒 Desativar" : "🔓 Ativar"}
                </button>
                <button style={{ ...btnMini, color: "#ff4f6a" }} title={`Excluir ${rotulo} do catálogo`} onClick={() => excluir(i, item)}>🗑️</button>
              </>)}
            </>)}
          </div>
        );
      })}
    </div>

    <div style={{ textAlign: "right", marginTop: 12 }}>
      <button style={{ ...s.btnA, opacity: (!isAdmin || salvando) ? 0.6 : 1 }} disabled={!isAdmin || salvando} onClick={() => onPersist(itens)}>
        {salvando ? "Salvando..." : textoSalvar}
      </button>
    </div>
  </>);
}
