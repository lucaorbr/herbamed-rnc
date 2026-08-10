// Painel da fusão dos setores de desvio na hierarquia de Áreas e Setores.
//
// A tela é deliberadamente uma **lista de decisões**, não um botão de "migrar":
// o admin vê nome a nome quantos desvios dependem daquele setor e escolhe entre
// levá-lo para uma área (o nome continua valendo, nada é reescrito) ou mapeá-lo
// para um setor que já existe (aí os desvios daquele nome são reescritos, com
// registro no histórico de cada um). Migração parcial é permitida: item sem
// decisão fica para depois.
//
// As regras estão em `fusaoSetores.js`, sem React e com teste.

import React, { useMemo, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { tod } from "../../core/utils";
import { saveCollection } from "../../firebase";
import { planoFusao, aplicarDecisoes, setoresDaHierarquia } from "./fusaoSetores";

export function FusaoSetoresPainel({
  catalogoSetoresDesvio = [], catalogoAreas = [], desvios = [],
  isAdmin = false, user, toast_ = () => {}, auditLog = async () => {}, doSaveDesvio,
}) {
  const T = useTheme(); const s = useS();
  const [decisoes, setDecisoes] = useState({});
  const [aplicando, setAplicando] = useState(false);

  const { itens, resumo } = useMemo(
    () => planoFusao({ catalogoSetoresDesvio, catalogoAreas, desvios }),
    [catalogoSetoresDesvio, catalogoAreas, desvios]);

  const areasAtivas = (catalogoAreas || []).filter(a => a?.ativo !== false);
  const setoresAlvo = setoresDaHierarquia(catalogoAreas);

  const decididos = itens.filter(x => x.status === "pendente" && decisoes[x.chave]?.acao);
  const aReescrever = decididos
    .filter(x => decisoes[x.chave].acao === "mapear")
    .reduce((n, x) => n + x.usos, 0);

  const setDecisao = (chave, valor) => setDecisoes(p => {
    const next = { ...p };
    if (!valor) delete next[chave]; else next[chave] = valor;
    return next;
  });

  const aplicar = async () => {
    if (!decididos.length) { toast_("Escolha um destino para ao menos um setor.", "red"); return; }
    const msg = aReescrever > 0
      ? `Aplicar ${decididos.length} decisão(ões)?\n\n${aReescrever} desvio(s) terão o setor reescrito para o nome do catálogo — a alteração fica registrada no histórico de cada um.`
      : `Aplicar ${decididos.length} decisão(ões)?\n\nNenhum desvio será alterado: os setores serão apenas acrescentados às Áreas e Setores.`;
    if (!window.confirm(msg)) return;

    setAplicando(true);
    try {
      const r = aplicarDecisoes({
        itens, decisoes, catalogoAreas, desvios,
        usuario: user?.name || "—", data: tod(),
      });

      if (r.catalogoMudou) {
        await saveCollection("configuracoes", "catalogo_areas_setores_distribuicao", { items: r.catalogoAreas });
      }
      for (const d of r.desviosParaSalvar) await doSaveDesvio(d);

      await auditLog(
        "Unificou Setores de Desvio nas Áreas e Setores",
        "configuracoes", "catalogo_areas_setores_distribuicao", "Catálogo",
        null,
        { criados: r.criados.length, mapeados: r.mapeados.length, desviosReescritos: r.desviosParaSalvar.length });

      const partes = [];
      if (r.criados.length) partes.push(`${r.criados.length} setor(es) criado(s)`);
      if (r.mapeados.length) partes.push(`${r.mapeados.length} mapeado(s)`);
      if (r.desviosParaSalvar.length) partes.push(`${r.desviosParaSalvar.length} desvio(s) atualizado(s)`);
      toast_(partes.join(" · ") || "Nada a aplicar.", "green");
      setDecisoes({});
    } catch (e) {
      console.error(e);
      toast_("Erro ao aplicar a fusão: " + e.message, "red");
    }
    setAplicando(false);
  };

  const chip = (bg, cor, txt, title) => (
    <span title={title} style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:bg, color:cor, fontWeight:700, whiteSpace:"nowrap" }}>{txt}</span>
  );

  return (<>
    <div style={{ fontSize:11, color:T.text3, marginBottom:12 }}>
      O setor onde o desvio aconteceu e o setor que recebe a cópia controlada impressa são o
      <strong> mesmo lugar físico</strong>, mas eram dois cadastros diferentes. A partir de agora os
      Desvios leem a hierarquia <strong>Áreas e Setores</strong> (Admin → 🏢 Estrutura da empresa) —
      um cadastro só, o mesmo usado pela distribuição de cópias, pelo cadastro de colaboradores e
      pela exigência de treinamento.
      <br/>Abaixo estão os setores da lista antiga <em>e</em> os que ainda aparecem em desvios já
      registrados. Decida um por um; o que ficar sem decisão continua para depois.
    </div>

    {/* Resumo */}
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
      {[
        ["Já na hierarquia", resumo.vinculados, T.accent],
        ["A decidir", resumo.pendentes, resumo.pendentes ? "#e8a33d" : T.text3],
        ["Desvios envolvidos", resumo.desviosAfetados, T.text2],
      ].map(([lbl, val, cor]) => (
        <div key={lbl} style={{ flex:"1 1 150px", background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px" }}>
          <div style={{ fontSize:20, fontWeight:800, color:cor }}>{val}</div>
          <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700 }}>{lbl}</div>
        </div>
      ))}
    </div>

    {resumo.pendentes === 0 && (
      <div style={{ background:T.accent+"15", border:`1px solid ${T.accent}44`, borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:12, color:T.text2 }}>
        ✅ Fusão concluída — todo setor usado pelos desvios já existe nas Áreas e Setores. A lista
        antiga não é mais lida; um setor novo do chão de fábrica agora se cadastra num lugar só.
      </div>
    )}

    {areasAtivas.length === 0 && (
      <div style={{ background:"#ff4f6a18", border:"1px solid #ff4f6a44", borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:12, color:T.text2 }}>
        ⚠️ Não há nenhuma <strong>área</strong> cadastrada em Admin → 🏢 Estrutura da empresa → Áreas e
        Setores. Cadastre as áreas primeiro — sem elas não há para onde levar os setores.
      </div>
    )}

    <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:460, overflowY:"auto" }}>
      {itens.map(item => {
        const dec = decisoes[item.chave];
        const vinculado = item.status === "vinculado";
        return (
          <div key={item.chave} style={{ background:T.surf, border:`1px solid ${dec ? T.accent+"66" : T.border}`, borderRadius:8, padding:"8px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ flex:"1 1 180px", fontSize:12, color:T.text, fontWeight:600, minWidth:0 }}>{item.nome}</span>

              {item.usos > 0
                ? chip(T.border, T.text2, `${item.usos} desvio${item.usos!==1?"s":""}`, "Desvios já registrados com este setor")
                : chip(T.border, T.text3, "sem uso", "Nenhum desvio registrado com este setor")}

              {item.origens.includes("desvios") && !item.origens.includes("catalogo") &&
                chip("#e8a33d22", "#e8a33d", "fora do catálogo", "Não está na lista antiga, mas segue carimbado em desvios")}

              {vinculado
                ? chip(T.accent+"22", T.accent, `✓ ${item.destino.areaLabel} › ${item.destino.nome}`, "Já existe na hierarquia — nada a fazer")
                : (
                  <select
                    value={dec ? `${dec.acao}:${dec.acao === "criar" ? dec.areaId : dec.setorId}` : ""}
                    disabled={!isAdmin}
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) return setDecisao(item.chave, null);
                      const [acao, id] = v.split(":");
                      setDecisao(item.chave, acao === "criar" ? { acao, areaId:id } : { acao, setorId:id });
                    }}
                    style={{ ...s.inp, fontSize:11, flex:"1 1 260px", minWidth:220 }}>
                    <option value="">— decidir depois —</option>
                    <optgroup label="Criar como setor novo na área (não altera desvio nenhum)">
                      {areasAtivas.map(a => <option key={a.id} value={`criar:${a.id}`}>➕ {a.label}</option>)}
                    </optgroup>
                    <optgroup label="É o mesmo que um setor existente (reescreve os desvios)">
                      {setoresAlvo.map(sx => <option key={sx.setorId} value={`mapear:${sx.setorId}`}>🔗 {sx.areaLabel} › {sx.nome}</option>)}
                    </optgroup>
                  </select>
                )}
            </div>

            {dec?.acao === "mapear" && item.usos > 0 && (
              <div style={{ fontSize:10, color:"#e8a33d", marginTop:6 }}>
                ⚠️ {item.usos} desvio{item.usos!==1?"s":""} ter{item.usos!==1?"ão":"á"} o setor reescrito — fica registrado no histórico de cada um.
              </div>
            )}
          </div>
        );
      })}
    </div>

    {isAdmin && resumo.pendentes > 0 && (
      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:14, flexWrap:"wrap" }}>
        <div style={{ flex:1, fontSize:11, color:T.text3, minWidth:200 }}>
          {decididos.length
            ? <>{decididos.length} decisão(ões) pronta(s){aReescrever>0 ? ` · ${aReescrever} desvio(s) serão reescritos` : " · nenhum desvio será alterado"}.</>
            : "Escolha o destino de ao menos um setor para aplicar."}
        </div>
        <button style={{ ...s.btnA, opacity:(!decididos.length||aplicando)?0.6:1 }} disabled={!decididos.length||aplicando} onClick={aplicar}>
          {aplicando ? "Aplicando..." : "✓ Aplicar decisões"}
        </button>
      </div>
    )}
  </>);
}
