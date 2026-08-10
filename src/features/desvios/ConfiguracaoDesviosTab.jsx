// Configuração do módulo Desvios — Tipos de Desvio e Setores de Desvio.
//
// Ambas as listas são usadas só por Desvios, então saíram de Admin → Catálogos,
// onde disputavam espaço com listas de outros módulos. Vale a mesma regra da
// Configuração de Documentos: cada módulo configura o próprio vocabulário.
//
// A aba de Setores deixou de ser um editor de lista: os setores de desvio foram
// FUNDIDOS na hierarquia Áreas e Setores — mesma realidade física, dois cadastros
// que divergiam. O que sobra aqui é o painel da fusão (FusaoSetoresPainel); o
// cadastro em si vive em Admin -> Estrutura da empresa -> Areas e Setores.

import React, { useState, useEffect } from "react";
import { saveCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { SecTitle } from "../../shared/ui";
import { CatalogoSimples } from "../../shared/CatalogoSimples";
import { TIPOS_DESVIO } from "./DesviosTabs";
import { FusaoSetoresPainel } from "./FusaoSetoresPainel";

const ABAS = [
  ["tipos",   "⚠️ Tipos de Desvio"],
  ["setores", "🏭 Setores"],
];

export function ConfiguracaoDesviosTab({
  catalogoTiposDesvio = [], catalogoSetoresDesvio = [], catalogoAreas = [], desvios = [],
  isAdmin = false, user, toast_ = () => {}, auditLog = async () => {}, setTab, doSaveDesvio,
}) {
  const T = useTheme(); const s = useS();

  const mkTipos = (cat) => cat && cat.length > 0 ? [...cat] : TIPOS_DESVIO.map(nome => ({ nome, ativo:true }));

  const [aba, setAba] = useState("tipos");
  const [listaTipos, setListaTipos] = useState(() => mkTipos(catalogoTiposDesvio));
  const [savingTipos, setSavingTipos] = useState(false);

  useEffect(() => { setListaTipos(mkTipos(catalogoTiposDesvio)); }, [catalogoTiposDesvio.length]);

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

        {aba==="setores" && (
          <FusaoSetoresPainel
            catalogoSetoresDesvio={catalogoSetoresDesvio} catalogoAreas={catalogoAreas} desvios={desvios}
            isAdmin={isAdmin} user={user} toast_={toast_} auditLog={auditLog} doSaveDesvio={doSaveDesvio}
          />
        )}
      </div>
    </div>
  );
}
