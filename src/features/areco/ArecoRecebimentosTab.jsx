import React, { useEffect, useState } from "react";
import { getArecoRecebimentos, getArecoSyncStatus, runArecoSync } from "../../firebase";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { Inp, SecTitle, Sel } from "../../shared/ui";

const fmtDate = value => value ? new Date(value).toLocaleDateString("pt-BR") : "-";

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
      toast_(`Sincronizacao concluida: ${result.imported || 0} item(ns).`, "green");
      await load();
    } catch (error) {
      toast_(error.message || "Erro na sincronizacao Areco.", "red");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = items.filter(item => {
    const hay = `${item.nf_numero || ""} ${item.fornecedor_nome || ""} ${item.produto_codigo || ""} ${item.produto_nome || ""} ${item.lote || ""}`.toLowerCase();
    return hay.includes(busca.toLowerCase());
  });

  const lastSync = syncStatus.find(s => s.source === "areco_recebimentos");

  return (
    <div>
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          <SecTitle icon="📥" ch="Recebimentos importados do Areco" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button style={s.btn} onClick={load} disabled={loading}>Atualizar</button>
            {user?.role === "admin" && (
              <button style={{ ...s.btnA, opacity:syncing ? .7 : 1 }} onClick={doSync} disabled={syncing}>
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
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
        <Inp placeholder="Buscar NF, fornecedor, produto ou lote..." value={busca} onChange={e=>setBusca(e.target.value)} sx={{ minWidth:260, flex:1 }} />
        <Sel value={status} onChange={e=>setStatus(e.target.value)} sx={{ width:190 }}>
          <option value="pendente_analise">Pendente de analise</option>
          <option value="">Todos</option>
          <option value="em_analise">Em analise</option>
          <option value="concluido">Concluido</option>
        </Sel>
      </div>

      <div style={s.card}>
        {loading ? (
          <div style={{ color:T.text2, padding:"2rem", textAlign:"center" }}>Carregando recebimentos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color:T.text3, padding:"2rem", textAlign:"center" }}>Nenhum recebimento encontrado.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:920 }}>
              <thead>
                <tr>
                  {["NF","Entrada","Fornecedor","Produto","Lote","Quantidade","Status","Acao"].map(h => (
                    <th key={h} style={{ textAlign:"left", fontSize:11, color:T.text3, borderBottom:`1px solid ${T.border}`, padding:"8px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:"10px", color:T.text, fontWeight:700 }}>{item.nf_numero || "-"}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>{fmtDate(item.data_entrada)}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>{item.fornecedor_nome || item.fornecedor_codigo || "-"}</td>
                    <td style={{ padding:"10px", color:T.text }}>
                      <div style={{ fontWeight:700 }}>{item.produto_nome || "-"}</div>
                      <div style={{ fontSize:11, color:T.text3 }}>{item.produto_codigo || ""}</div>
                    </td>
                    <td style={{ padding:"10px", color:T.text2 }}>{item.lote || "-"}</td>
                    <td style={{ padding:"10px", color:T.text2 }}>{item.quantidade || "-"} {item.unidade || ""}</td>
                    <td style={{ padding:"10px" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:T.accent, background:T.accentDim, borderRadius:20, padding:"3px 9px" }}>{item.status}</span>
                    </td>
                    <td style={{ padding:"10px" }}>
                      <button style={s.btnA} onClick={() => { toast_("Proxima etapa: associar este recebimento a uma analise CQ.", "blue"); setTab && setTab("cq-analises"); }}>
                        Iniciar analise
                      </button>
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
