// Configuração do módulo Desvios — Tipos de Desvio e Setores de Desvio.
//
// Ambas as listas são usadas só por Desvios, então saíram de Admin → Catálogos,
// onde disputavam espaço com listas de outros módulos. Vale a mesma regra da
// Configuração de Documentos: cada módulo configura o próprio vocabulário.
//
// Tirar "Setores de Desvio" do Admin tem um efeito extra: a tela do Admin
// deixa de ter duas listas de "onde" (esta e Áreas e Setores) lado a lado, que
// era a dúvida real de onde cadastrar um setor novo. A fusão das duas é a
// próxima etapa — até lá, esta continua sendo a lista dos desvios.

import React, { useState, useEffect } from "react";
import { saveCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { SecTitle } from "../../shared/ui";
import { CatalogoSimples } from "../../shared/CatalogoSimples";
import { TIPOS_DESVIO, SETORES_DESVIO } from "./DesviosTabs";

const ABAS = [
  ["tipos",   "⚠️ Tipos de Desvio"],
  ["setores", "🏭 Setores de Desvio"],
];

export function ConfiguracaoDesviosTab({
  catalogoTiposDesvio = [], catalogoSetoresDesvio = [],
  isAdmin = false, toast_ = () => {}, auditLog = async () => {}, setTab,
}) {
  const T = useTheme(); const s = useS();

  const mkTipos   = (cat) => cat && cat.length > 0 ? [...cat] : TIPOS_DESVIO.map(nome => ({ nome, ativo:true }));
  const mkSetores = (cat) => cat && cat.length > 0 ? [...cat] : SETORES_DESVIO.map(nome => ({ nome, ativo:true }));

  const [aba, setAba] = useState("tipos");
  const [listaTipos, setListaTipos] = useState(() => mkTipos(catalogoTiposDesvio));
  const [listaSetores, setListaSetores] = useState(() => mkSetores(catalogoSetoresDesvio));
  const [savingTipos, setSavingTipos] = useState(false);
  const [savingSetores, setSavingSetores] = useState(false);

  useEffect(() => { setListaTipos(mkTipos(catalogoTiposDesvio)); }, [catalogoTiposDesvio.length]);
  useEffect(() => { setListaSetores(mkSetores(catalogoSetoresDesvio)); }, [catalogoSetoresDesvio.length]);

  const persistTipos = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(t => !String(t.nome||"").trim())) { toast_("Todos os tipos de desvio precisam de um nome.", "red"); return; }
    setListaTipos(lista);
    setSavingTipos(true);
    try {
      await saveCollection("configuracoes", "catalogo_tipos_desvio", { items: lista });
      await auditLog("Atualizou Catálogo de Tipos de Desvio", "configuracoes", "catalogo_tipos_desvio", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de tipos de desvio salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); console.error(e); }
    setSavingTipos(false);
  };

  const persistSetores = async (lista) => {
    if (!isAdmin) return;
    if (lista.some(sx => !String(sx.nome||"").trim())) { toast_("Todos os setores precisam de um nome.", "red"); return; }
    setListaSetores(lista);
    setSavingSetores(true);
    try {
      await saveCollection("configuracoes", "catalogo_setores_desvio", { items: lista });
      await auditLog("Atualizou Catálogo de Setores de Desvio", "configuracoes", "catalogo_setores_desvio", "Catálogo", null, { total: lista.length });
      toast_("Catálogo de setores de desvio salvo!", "green");
    } catch(e) { toast_("Erro ao salvar catálogo.", "red"); console.error(e); }
    setSavingSetores(false);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button style={s.btn} onClick={()=>setTab("desvios")}>← Voltar</button>
        <h2 style={{ fontSize:18, fontWeight:700, color:T.text, margin:0 }}>⚙️ Configuração de Desvios</h2>
      </div>

      <div style={s.card}>
        <SecTitle icon="⚙️" ch="Configuração" />

        <div style={{ fontSize:11, color:T.text3, marginBottom:14 }}>
          Listas fechadas usadas ao registrar um desvio. Manter a lista fechada evita que o mesmo
          item apareça com grafias diferentes e distorça o Pareto e a matriz Setor × Tipo dos
          indicadores. As alterações são salvas automaticamente e <strong>não</strong> alteram
          desvios já registrados.
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {ABAS.map(([k,l])=>(
            <button key={k} onClick={()=>setAba(k)}
              style={{ padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                background:aba===k?T.accent:T.surf, color:aba===k?"#fff":T.text2, transition:"all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {!isAdmin && (
          <div style={{ background:"#ffd16618", border:"1px solid #ffd16644", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:T.text2 }}>
            🔒 Somente leitura — apenas administradores alteram estas listas.
          </div>
        )}

        {aba==="tipos" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Tipos usados ao classificar um desvio (ex: BPF, Processo, Equipamento). Apenas tipos
            ativos aparecem no formulário. <strong>Outros</strong> continua sempre disponível como
            texto livre.
            <br/>Desvios antigos que ficaram como "Outros" podem ser mapeados para um tipo do
            catálogo em <strong>Desvios → 🏷️ Reclassificar tipos</strong>.
          </div>
          <CatalogoSimples
            itens={listaTipos} onPersist={persistTipos} salvando={savingTipos}
            isAdmin={isAdmin} toast_={toast_}
            rotulo="tipo de desvio" placeholder="Nome do tipo (ex: Limpeza)"
            avisoExclusao="Desvios já registrados com este tipo não são afetados. Prefira desativar se o tipo já foi usado."
            textoSalvar="💾 Salvar tipos de desvio"
          />
        </>)}

        {aba==="setores" && (<>
          <div style={{ fontSize:11, color:T.text3, marginBottom:10 }}>
            Setores do chão de fábrica usados ao registrar um desvio (ex: Mistura 1, Compressão,
            Envase 3). Apenas setores ativos aparecem no formulário. <strong>Outros</strong>
            continua sempre disponível como texto livre.
            <br/>⚠️ Esta lista ainda é <strong>separada</strong> das Áreas e Setores usadas pela
            distribuição de cópias e pelo cadastro de colaboradores. Unificar as duas é a próxima
            etapa — por ora, um setor novo do chão de fábrica precisa ser cadastrado nos dois lugares.
          </div>
          <CatalogoSimples
            itens={listaSetores} onPersist={persistSetores} salvando={savingSetores}
            isAdmin={isAdmin} toast_={toast_}
            rotulo="setor" placeholder="Nome do setor (ex: Envase 7)"
            avisoExclusao="Desvios já registrados neste setor não são afetados. Prefira desativar se o setor já foi usado."
            textoSalvar="💾 Salvar setores de desvio"
          />
        </>)}
      </div>
    </div>
  );
}
