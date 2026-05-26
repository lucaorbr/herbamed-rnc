import React, { useState, useEffect } from "react";
import { saveCollection, deleteFromCollection, subscribeCollection } from "../../firebase";
import { useTheme } from "../../core/theme";
import { tod } from "../../core/utils";
import { useS } from "../../shared/styles";
import { usePagination } from "../../shared/ui";
import { F, G2, Inp, MaskedInp, Pagination, SecTitle } from "../../shared/ui";

export function ClientesTab({ user, toast_ }) {
  const T = useTheme(); const s = useS();
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ nome:"", cnpj:"", contato:"", email:"", tel:"", cep:"", endereco:"", obs:"" });
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const isAdmin = user?.role === "admin" || user?.role === "keyuser";
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(() => {
    const unsub = subscribeCollection("clientes_terceiros", list => {
      setClientes(list.sort((a,b)=>(a.nome||"").localeCompare(b.nome||"")));
    });
    return unsub;
  }, []);

  const salvar = async () => {
    try {
    if (!form.nome) { alert("Informe o nome do cliente."); return; }
    const id = sel ? sel.id : Date.now();
    await saveCollection("clientes_terceiros", String(id), { id, ...form, atualizadoEm: tod() });
    toast_(sel ? "Cliente atualizado!" : "Cliente cadastrado!", "green");
    setForm({ nome:"", cnpj:"", contato:"", email:"", tel:"", cep:"", endereco:"", obs:"" });
    setSel(null);
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const deletar = async (id) => {
    try {
    if (!confirm("Excluir este cliente?")) return;
    await deleteFromCollection("clientes_terceiros", String(id));
    toast_("Cliente excluído.", "red");
    } catch(e) {
      toast_(fbErr(e), "red");
      console.error(e);
    }
  };

  const editar = (c) => { setSel(c); setForm({ nome:c.nome||"", cnpj:c.cnpj||"", contato:c.contato||"", email:c.email||"", tel:c.tel||"", cep:c.cep||"", endereco:c.endereco||"", obs:c.obs||"" }); };

  const filtrados = clientes.filter(c => !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cnpj?.includes(busca));
  const {paginated:_cls,page:_pgC,total:_totC,setPage:_setPgC} = usePagination(filtrados, 20);

  return (
    <div>
      {isAdmin && (
        <div style={s.card}>
          <SecTitle icon="🏢" ch={sel ? "Editar Cliente" : "Novo Cliente"} />
          <G2 ch={<>
            <F lbl="Nome da empresa *" ch={<Inp placeholder="Ex: Suplementos XYZ Ltda" value={form.nome} onChange={e=>setF("nome",e.target.value)} />} />
            <F lbl="CNPJ" ch={<MaskedInp mask="cnpj" placeholder="00.000.000/0001-00" value={form.cnpj} onChange={e=>setF("cnpj",e.target.value)} />} />
            <F lbl="Contato" ch={<Inp placeholder="Nome do responsável" value={form.contato} onChange={e=>setF("contato",e.target.value)} />} />
            <F lbl="E-mail" ch={<Inp placeholder="contato@empresa.com.br" value={form.email} onChange={e=>setF("email",e.target.value)} />} />
            <F lbl="Telefone" ch={<MaskedInp mask="telefone" placeholder="(00) 00000-0000" value={form.tel} onChange={e=>setF("tel",e.target.value)} />} />
            <F lbl="CEP" ch={<MaskedInp mask="cep" placeholder="00000-000" value={form.cep} onChange={e=>setF("cep",e.target.value)} />} />
            <F lbl="Endereço" ch={<Inp placeholder="Rua, número, bairro, cidade" value={form.endereco} onChange={e=>setF("endereco",e.target.value)} />} />
            <F lbl="Observações" ch={<Inp placeholder="Obs..." value={form.obs} onChange={e=>setF("obs",e.target.value)} />} />
          </>} />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            {sel && <button style={s.btn} onClick={()=>{setSel(null);setForm({nome:"",cnpj:"",contato:"",email:"",tel:"",cep:"",endereco:"",obs:""});}}>Cancelar</button>}
            <button style={s.btnA} onClick={salvar}>{sel ? "Salvar alterações" : "+ Cadastrar Cliente"}</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:T.text3, fontSize:13 }}>🔍</span>
          <input placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} style={{ ...s.inp, paddingLeft:30, fontSize:12 }} />
        </div>
        <div style={{ fontSize:12, color:T.text2 }}>{filtrados.length} cliente(s)</div>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏢</div>
          <div style={{ fontSize:14 }}>Nenhum cliente cadastrado.</div>
        </div>
      ) : (<>
      {_cls.map(c => (
        <div key={c.id} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:T.accentDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:T.accent, flexShrink:0 }}>{c.nome?.[0]||"?"}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{c.nome}</div>
            <div style={{ fontSize:11, color:T.text2, marginTop:2 }}>{c.cnpj && `CNPJ: ${c.cnpj}`}{c.contato && ` · ${c.contato}`}{c.email && ` · ${c.email}`}</div>
          </div>
          {isAdmin && (
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>editar(c)} style={{ ...s.btn, fontSize:11, padding:"4px 10px" }}>✏️</button>
              <button onClick={()=>deletar(c.id)} style={{ ...s.btnD, fontSize:11, padding:"4px 10px" }}>🗑️</button>
            </div>
          )}
        </div>
      ))}
      <Pagination page={_pgC} total={_totC} setPage={_setPgC}/>
      </>
      )}
    </div>
  );
}
