import React, { useEffect, useState } from "react";
import { getArecoRecebimentos, getArecoSyncStatus, runArecoSync, saveCollection, updateArecoRecebimento } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { Inp, SecTitle, Sel } from "../../shared/ui";

const fmtDateTime = value => value ? new Date(value).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "-";
const today = () => new Date().toISOString().slice(0, 10);

function receiptDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : today();
}

function inferMaterialType(item) {
  if (item.tipo_material) return item.tipo_material;
  const text = `${item.produto_nome || ""} ${item.produto_descricao || ""} ${item.produto_subgrupo || ""} ${item.produto_categoria || ""} ${item.produto_codigo || ""}`.toLowerCase();
  if (text.includes("embal") || text.includes("frasco") || text.includes("tampa") || text.includes("caixa")) return "Embalagem";
  if (text.includes("rotulo") || text.includes("etiqueta")) return "Rotulo";
  if (text.includes("extrato") || text.includes("insumo") || text.includes("ativo") || text.includes("materia")) return "Materia-prima";
  return "Outros";
}

function buildMaterialFromReceipt(item) {
  const codigo = item.produto_id_areco || item.produto_codigo || item.id;
  const referencia = item.produto_referencia || item.produto_codigo || codigo;
  const nome = item.produto_descricao || item.produto_nome || referencia || "Material Areco";
  return {
    id: `areco-${codigo}`,
    origem: "Areco",
    codigoAreco: codigo,
    referenciaAreco: referencia,
    nome,
    nomeBase: nome,
    apresentacao: "",
    linha: "",
    clienteId: "",
    tipo: inferMaterialType(item),
    fornecedorPadrao: item.fornecedor_nome || "",
    unidadePadrao: item.unidade || "",
    ref: "Importado automaticamente do Areco",
    obs: `Material criado automaticamente a partir de um recebimento do Areco. Referencia: ${referencia}. Complete os ensaios e especificacoes no SGQ quando necessario.`,
    ensaios: [],
    fichasTecnicas: [],
    criadoPor: "Recebimento Areco",
    criadoEm: today(),
    atualizadoEm: today(),
  };
}

export function ArecoRecebimentosTab({ user, toast_, setTab }) {
  const T = useTheme();
  const s = useS();
  const [status, setStatus] = useState("pendente_analise");
  const [items, setItems] = useState([]);
  const [syncStatus, setSyncStatus] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [recebimentos, sync] = await Promise.all([
        getArecoRecebimentos(status),
        getArecoSyncStatus().catch(() => []),
      ]);
      setItems(recebimentos);
      setSyncStatus(sync);
    } catch (error) {
      toast_(error.message || "Erro ao carregar recebimentos do Areco.", "red");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [status]);

  const doSync = async () => {
    setSyncing(true);
    try {
      const result = await runArecoSync();
      toast_(`Sincronizacao concluida: ${result.imported || 0} recebimento(s), ${result.importedMateriais || 0} material(is), ${result.importedFornecedores || 0} fornecedor(es).`, "green");
      await load();
    } catch (error) {
      toast_(error.message || "Erro na sincronizacao Areco.", "red");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = items.filter(item => {
    const hay = `${item.nf_numero || ""} ${item.fornecedor_nome || ""} ${item.fornecedor_documento || ""} ${item.produto_codigo || ""} ${item.produto_referencia || ""} ${item.produto_descricao || ""} ${item.produto_nome || ""} ${item.tipo_material || ""} ${item.motivo_filtro || ""} ${item.lote || ""}`.toLowerCase();
    return hay.includes(busca.toLowerCase());
  });

  const lastSync = syncStatus.find(s => s.source === "areco_recebimentos");

  const iniciarAnalise = async (item) => {
    if (item.status === "fora_escopo" || item.escopo_qualidade === false) {
      toast_("Esse recebimento esta fora do escopo da qualidade.", "red");
      return;
    }

    try {
      const id = Date.now();
      const material = buildMaterialFromReceipt(item);
      const quantidade = item.quantidade != null ? String(item.quantidade) : "";
      const unidade = item.unidade || "un";
      const analise = {
        id,
        num: `RA-ARECO-${item.nf_numero || id}`,
        origem: "areco",
        arecoRecebimentoId: item.id,
        materialId: material.id,
        materialNome: material.nome,
        materialTipo: material.tipo,
        fornecedor: item.fornecedor_nome || item.fornecedor_codigo || "",
        lote: item.lote || "",
        qtdRecebidaValor: quantidade,
        qtdRecebidaUnidade: unidade,
        qtdRecebida: quantidade ? `${quantidade} ${unidade}` : "",
        nf: item.nf_numero || "",
        dataRecebimento: receiptDate(item.data_entrada),
        dataAnalise: today(),
        resp: user?.name || "",
        obs: `Analise iniciada a partir do recebimento Areco ${item.external_key || item.id}.`,
        resultados: [],
        conclusao: "Pendente",
        criadoPor: user?.name || "",
        criadoEm: today(),
        criadoTs: id,
      };

      await saveCollection("cq_materiais", String(material.id), material);
      await saveCollection("cq_analises", String(id), analise);
      await updateArecoRecebimento(item.id, { status: "em_analise", cq_analise_id: String(id) });
      toast_(`Analise ${analise.num} criada a partir do recebimento Areco.`, "green");
      await load();
      setTab && setTab("cq-analises");
    } catch (error) {
      toast_(error.message || "Erro ao iniciar analise.", "red");
    }
  };

  return (
    <div>
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          <SecTitle icon="📥" ch="Recebimentos importados do Areco" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button style={s.btn} onClick={load} disabled={loading}>Atualizar</button>
            {user?.role === "admin" && (
              <button style={{ ...s.btnA, opacity:syncing ? .7 : 1 }} onClick={doSync} disabled={syncing}>
                {syncing ? "Sincronizando..." : "Sincronizar recebimentos e materiais"}
              </button>
            )}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginTop:12 }}>
          <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700 }}>Pendentes</div>
            <div style={{ fontSize:22, fontWeight:800, color:T.accent }}>{items.filter(i=>i.status==="pendente_analise").length}</div>
          </div>
          <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700 }}>Ultima sincronizacao</div>
            <div style={{ fontSize:13, color:T.text, fontWeight:700 }}>{lastSync?.last_success_at ? new Date(lastSync.last_success_at).toLocaleString("pt-BR") : "Ainda nao executada"}</div>
          </div>
          <div style={{ background:T.surf, border:`1px solid ${lastSync?.last_error ? T.red : T.border}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:T.text3, textTransform:"uppercase", fontWeight:700 }}>Status Areco</div>
            <div style={{ fontSize:13, color:lastSync?.last_error ? T.red : T.text2, fontWeight:700 }}>{lastSync?.last_error || "Sem erro registrado"}</div>
          </div>
        </div>
      </div>

      <div style={{ ...s.card, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <Inp placeholder="Buscar NF, fornecedor, CNPJ, referencia, descricao ou lote..." value={busca} onChange={e=>setBusca(e.target.value)} sx={{ minWidth:260, flex:1 }} />
        <Sel value={status} onChange={e=>setStatus(e.target.value)} sx={{ width:190 }}>
          <option value="pendente_analise">Pendente de analise</option>
          <option value="">Todos</option>
          <option value="em_analise">Em analise</option>
          <option value="concluido">Concluido</option>
          <option value="fora_escopo">Fora de escopo</option>
        </Sel>
      </div>

      <div style={s.card}>
        {loading ? (
          <div style={{ color:T.text2, padding:"2rem", textAlign:"center" }}>Carregando recebimentos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color:T.text3, padding:"2rem", textAlign:"center" }}>Nenhum recebimento encontrado.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1320 }}>
              <thead>
                <tr>
                  {["NF","Recebimento","Fornecedor","Referencia Areco","Descricao do item","Tipo","Lote","Quantidade","Status","Acao"].map(h => (
                    <th key={h} style={{ textAlign:"left", fontSize:11, color:T.text3, borderBottom:`1px solid ${T.border}`, padding:"8px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:"10px", color:T.text, fontWeight:700 }}>{item.nf_numero || "-"}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>{fmtDateTime(item.data_entrada)}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>
                      <div style={{ fontWeight:700, color:T.text }}>{item.fornecedor_nome || "-"}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>{item.fornecedor_documento || item.fornecedor_codigo || ""}</div>
                    </td>
                    <td style={{ padding:"10px", color:T.text }}>
                      <div style={{ fontWeight:700 }}>{item.produto_referencia || item.produto_codigo || "-"}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>ID Areco: {item.produto_id_areco || item.payload?.produto_id_areco || item.produto_codigo || "-"}</div>
                    </td>
                    <td style={{ padding:"10px", color:T.text2 }}>
                      <div style={{ fontWeight:700, color:T.text }}>{item.produto_descricao || item.produto_nome || "-"}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>{[item.produto_subgrupo, item.produto_categoria].filter(Boolean).join(" / ")}</div>
                    </td>
                    <td style={{ padding:"10px", color:T.text2 }}>
                      <div style={{ fontWeight:700, color:item.escopo_qualidade === false ? T.red : T.text }}>{item.tipo_material || inferMaterialType(item)}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>{item.motivo_filtro || ""}</div>
                    </td>
                    <td style={{ padding:"10px", color:T.text2 }}>{item.lote || "-"}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>{item.quantidade || "-"} {item.unidade || ""}</td>
                    <td style={{ padding:"10px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:T.accent, background:T.accentDim, borderRadius:20, padding:"3px 9px" }}>{item.status}</span>
                    </td>
                    <td style={{ padding:"10px" }}>
                      {item.status === "fora_escopo" || item.escopo_qualidade === false ? (
                        <span style={{ color:T.text3, fontSize:12, fontWeight:700 }}>Fora do CQ</span>
                      ) : (
                        <button style={s.btnA} onClick={() => iniciarAnalise(item)} disabled={item.status === "concluido"}>
                          Iniciar analise
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
