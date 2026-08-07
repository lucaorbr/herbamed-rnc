import React, { useMemo, useRef, useState } from "react";
import { useTheme } from "../../core/theme";
import { useS } from "../../shared/styles";
import { F, G2, G3, Inp, SecTitle, Sel } from "../../shared/ui";
import { fmt } from "../../core/utils";
import { saveCollection } from "../../firebase";
import { cargosAtivos } from "../admin/cargos";
import {
  novoColaborador, planoMigracaoColaboradores, planoImportacaoColaboradores,
  parseCSVColaboradores, normMatricula, normNome, opcoesDeLocal,
} from "./colaboradores";
import { baixarModeloColaboradores, lerPlanilhaColaboradores } from "./planilhaColaboradores";

// Cadastro de Colaboradores — a lista de PESSOAS da fábrica, separada dos usuários
// do sistema. É daqui que a Matriz de Treinamento deriva a exigência desde a Fase 6:
// operador não tem login, mas é justamente quem precisa treinar em POP.

export function ColaboradoresTab({ colaboradores = [], users = [], catalogoCargos = [], catalogoAreas = [], toast_, auditLog, isAdmin }) {
  const T = useTheme(); const s = useS();
  const [busca, setBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState("todos");
  const [filtroSit, setFiltroSit] = useState("ativos");
  const [edit, setEdit] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const fileRef = useRef(null);

  const cargos = cargosAtivos(catalogoCargos);
  const locais = opcoesDeLocal(catalogoAreas);
  const nomeLocal = (id) => locais.find(l => l.id === id)?.rotulo || null;
  const nomeCargo = (id) => catalogoCargos.find(c => c.id === id)?.nome || "—";

  const visiveis = useMemo(() => {
    let l = [...colaboradores];
    if (filtroSit === "ativos") l = l.filter(c => c.ativo !== false);
    if (filtroSit === "inativos") l = l.filter(c => c.ativo === false);
    if (filtroSit === "semlogin") l = l.filter(c => !c.userId);
    if (filtroCargo !== "todos") l = l.filter(c => c.cargoId === filtroCargo);
    const q = normNome(busca);
    if (q) l = l.filter(c => normNome(c.nome).includes(q) || normMatricula(c.matricula).includes(busca.toUpperCase()));
    return l.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [colaboradores, busca, filtroCargo, filtroSit]);

  const resumo = useMemo(() => {
    const ativos = colaboradores.filter(c => c.ativo !== false);
    return {
      total: ativos.length,
      comLogin: ativos.filter(c => c.userId).length,
      semLogin: ativos.filter(c => !c.userId).length,
      semCargo: ativos.filter(c => !c.cargoId).length,
      semSetor: ativos.filter(c => !c.setorId).length,
      inativos: colaboradores.length - ativos.length,
    };
  }, [colaboradores]);

  const gravar = async (colab, msg) => {
    setSalvando(true);
    try {
      await saveCollection("colaboradores", colab.id, colab);
      if (msg) toast_?.(msg, "green");
      setEdit(null);
    } catch (e) { toast_?.("Erro ao salvar colaborador.", "red"); console.error(e); }
    setSalvando(false);
  };

  const salvarEdicao = async () => {
    if (!edit?.nome?.trim()) { toast_?.("Informe o nome.", "red"); return; }
    const novo = !colaboradores.some(c => c.id === edit.id);
    const limpo = { ...edit, nome: edit.nome.trim(), matricula: normMatricula(edit.matricula), cargoNome: edit.cargoId ? nomeCargo(edit.cargoId) : "" };
    await gravar(limpo, novo ? "Colaborador cadastrado!" : "Colaborador atualizado!");
    await auditLog?.(novo ? "Cadastrou Colaborador" : "Atualizou Colaborador", "colaboradores", limpo.id, limpo.nome, null,
      { cargo: limpo.cargoNome, matricula: limpo.matricula, ativo: limpo.ativo });
  };

  const alternarAtivo = async (c) => {
    const acao = c.ativo === false ? "reativar" : "desligar";
    if (!window.confirm(
      c.ativo === false
        ? `Reativar ${c.nome}? Ele volta a ser exigido nos treinamentos do cargo.`
        : `Desligar ${c.nome}? Ele sai do cálculo de conformidade, mas o histórico de treinamento dele continua gravado e consultável.`
    )) return;
    const upd = { ...c, ativo: c.ativo === false, desligadoEm: c.ativo === false ? null : new Date().toISOString() };
    await gravar(upd, c.ativo === false ? "Colaborador reativado." : "Colaborador desligado.");
    await auditLog?.(acao === "desligar" ? "Desligou Colaborador" : "Reativou Colaborador", "colaboradores", c.id, c.nome, { ativo: c.ativo !== false }, { ativo: upd.ativo });
  };

  // ── Migração dos usuários existentes ──────────────────────────────────────
  const migrar = async () => {
    const plano = planoMigracaoColaboradores({ users, colaboradores, catalogoCargos });
    if (!plano.novos.length) {
      toast_?.(`Nada a migrar. ${plano.jaMigrados} usuário(s) já têm cadastro.`, "green");
      return;
    }
    if (!window.confirm(
      `Criar cadastro de colaborador para ${plano.novos.length} usuário(s) do sistema?\n\n` +
      (plano.semCargo.length ? `${plano.semCargo.length} usuário(s) sem cargo NÃO serão migrados (sem cargo não há treinamento a herdar).\n\n` : "") +
      `O cadastro reaproveita o mesmo identificador do usuário, então todo o histórico de treinamento já gravado continua válido. A ação é segura de repetir.`
    )) return;
    setSalvando(true);
    try {
      for (const c of plano.novos) await saveCollection("colaboradores", c.id, c);
      await auditLog?.("Migrou Usuários para Colaboradores", "colaboradores", "migracao", "Cadastro de Colaboradores", null,
        { criados: plano.novos.length, semCargo: plano.semCargo.length, jaMigrados: plano.jaMigrados });
      toast_?.(`${plano.novos.length} colaborador(es) criado(s) a partir dos usuários.`, "green");
    } catch (e) { toast_?.("Erro na migração.", "red"); console.error(e); }
    setSalvando(false);
  };

  // ── Importação de planilha ────────────────────────────────────────────────
  const lerArquivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      // Excel é o formato em que o RH realmente trabalha. Lido direto, sem passar
      // por CSV, o texto vem em Unicode — acento não chega quebrado e o nome do
      // cargo continua casando com o catálogo.
      const ehExcel = /\.xlsx?$/i.test(f.name);
      const linhas = ehExcel ? await lerPlanilhaColaboradores(f) : parseCSVColaboradores(await f.text());
      if (!linhas.length) {
        toast_?.("Não encontrei a coluna 'nome' no arquivo. Confira o cabeçalho.", "red");
        return;
      }
      setPrevia({ arquivo: f.name, ...planoImportacaoColaboradores({ linhas, colaboradores, catalogoCargos, catalogoAreas }) });
    } catch { toast_?.("Não consegui ler o arquivo.", "red"); }
  };

  const aplicarImportacao = async () => {
    if (!previa) return;
    setSalvando(true);
    try {
      for (const c of previa.criar) await saveCollection("colaboradores", c.id, c);
      for (const u of previa.atualizar) {
        await saveCollection("colaboradores", u.id, { ...u.antes, ...u.campos });
      }
      await auditLog?.("Importou Colaboradores", "colaboradores", "importacao", previa.arquivo, null,
        { criados: previa.criar.length, atualizados: previa.atualizar.length, conflitos: previa.conflitos.length, ignorados: previa.ignorados.length });
      toast_?.(`${previa.criar.length} criado(s), ${previa.atualizar.length} atualizado(s).`, "green");
      setPrevia(null);
    } catch (e) { toast_?.("Erro ao importar.", "red"); console.error(e); }
    setSalvando(false);
  };

  // O modelo sai com os cargos e setores ATIVOS do sistema já embutidos como
  // listas suspensas: quem preenche escolhe em vez de digitar, e cargo digitado
  // fora do catálogo (que faria a linha ser recusada) deixa de acontecer.
  const baixarModeloExcel = async () => {
    try {
      await baixarModeloColaboradores({ catalogoCargos, catalogoAreas });
    } catch (e) { toast_?.("Não consegui gerar o modelo.", "red"); console.error(e); }
  };

  const baixarModelo = () => {
    const csv = "nome;matricula;cargo;setor;admissao\nAdriana Moreira;1001;Operador de Encapsulamento;Produção;05/03/2024";
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-colaboradores.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const KPI = ({ label, valor, cor, sub }) => (
    <div style={{ ...s.card, margin: 0, padding: "14px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ fontSize: 11, color: T.text3, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: cor || T.text, lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: T.text3 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <KPI label="Colaboradores" valor={resumo.total} sub="ativos no cadastro" />
        <KPI label="Sem login" valor={resumo.semLogin} cor="#4fc3f7" sub="treinam presencialmente" />
        <KPI label="Com login" valor={resumo.comLogin} sub="podem confirmar leitura" />
        <KPI label="Sem cargo" valor={resumo.semCargo} cor={resumo.semCargo ? "#e8a33d" : T.text3} sub="não herdam treinamento" />
        <KPI label="Setor não vinculado" valor={resumo.semSetor} cor={resumo.semSetor ? "#e8a33d" : T.text3} sub="fora do filtro por setor" />
        <KPI label="Desligados" valor={resumo.inativos} cor={T.text3} sub="histórico preservado" />
      </div>

      {resumo.semCargo > 0 && (
        <div style={{ background: "#ffd16618", border: "1px solid #ffd16644", borderRadius: 10, padding: "12px 16px", marginBottom: 12, fontSize: 12, color: T.text2 }}>
          <strong style={{ color: T.text }}>{resumo.semCargo} colaborador(es) sem cargo.</strong> A exigência de treinamento nasce do cargo —
          sem ele a pessoa não aparece em nenhuma matriz. Use o filtro abaixo para achar e completar.
        </div>
      )}

      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <SecTitle icon="👷" ch={`Colaboradores (${visiveis.length})`} />
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...s.btn, fontSize: 11 }} onClick={baixarModeloExcel}
                title="Planilha .xlsx com os cargos e setores do sistema já em listas suspensas">
                📗 Modelo Excel
              </button>
              <button style={{ ...s.btn, fontSize: 11 }} onClick={baixarModelo} title="Alternativa em texto puro">📄 Modelo CSV</button>
              <button style={{ ...s.btn, fontSize: 11 }} onClick={() => fileRef.current?.click()}>📥 Importar planilha</button>
              <button style={{ ...s.btn, fontSize: 11, opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={migrar}
                title="Cria cadastro para os usuários do sistema que ainda não têm, preservando o histórico de treinamento">
                🔄 Migrar usuários
              </button>
              <button style={s.btnA} onClick={() => setEdit(novoColaborador({ nome: "" }))}>+ Novo</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: "none" }} onChange={lerArquivo} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input placeholder="Buscar por nome ou matrícula..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ ...s.inp, flex: 1, minWidth: 180, fontSize: 12 }} />
          <Sel value={filtroCargo} onChange={e => setFiltroCargo(e.target.value)} sx={{ fontSize: 12 }}>
            <option value="todos">Todos os cargos</option>
            {cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Sel>
          <Sel value={filtroSit} onChange={e => setFiltroSit(e.target.value)} sx={{ fontSize: 12 }}>
            <option value="ativos">Ativos</option>
            <option value="semlogin">Ativos sem login</option>
            <option value="inativos">Desligados</option>
            <option value="todos">Todos</option>
          </Sel>
        </div>

        {visiveis.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: T.text3, fontSize: 13 }}>
            {colaboradores.length === 0
              ? <>Nenhum colaborador cadastrado ainda.<br /><span style={{ fontSize: 11 }}>Comece com <strong>🔄 Migrar usuários</strong> e depois importe a planilha do RH.</span></>
              : "Nenhum colaborador com os filtros atuais."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visiveis.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, opacity: c.ativo === false ? 0.55 : 1, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 190 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {c.nome}
                    {c.matricula && <span style={{ fontSize: 11, color: T.text3, fontWeight: 400 }}> · mat. {c.matricula}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.text2 }}>
                    {c.cargoId ? nomeCargo(c.cargoId) : <span style={{ color: "#e8a33d" }}>sem cargo</span>}
                    {c.setorId
                      ? ` · ${nomeLocal(c.setorId) || c.setor}`
                      : c.setor ? <span style={{ color: "#e8a33d" }}> · {c.setor} (setor não vinculado)</span> : ""}
                    {c.dataAdmissao ? ` · admissão ${fmt(c.dataAdmissao)}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: c.userId ? "#2ab84a18" : "#4fc3f718", color: c.userId ? "#2ab84a" : "#4fc3f7" }}
                  title={c.userId ? "Tem login — pode confirmar leitura no sistema" : "Sem login — treina presencialmente, com lista de presença assinada"}>
                  {c.userId ? "com login" : "sem login"}
                </span>
                {c.ativo === false && <span style={{ fontSize: 10, fontWeight: 700, color: T.text3 }}>DESLIGADO</span>}
                {isAdmin && (<>
                  <button style={{ ...s.btn, fontSize: 11 }} onClick={() => setEdit({ ...c })}>✏️</button>
                  <button style={{ ...s.btn, fontSize: 11, color: c.ativo === false ? "#2ab84a" : "#ff4f6a", borderColor: (c.ativo === false ? "#2ab84a" : "#ff4f6a") + "33" }}
                    onClick={() => alternarAtivo(c)}>{c.ativo === false ? "↩" : "⏻"}</button>
                </>)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edição / cadastro */}
      {edit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 16, padding: "1.5rem", maxWidth: 620, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              {colaboradores.some(c => c.id === edit.id) ? "Editar colaborador" : "Novo colaborador"}
            </div>
            <G2 ch={<>
              <F lbl="Nome completo" ch={<Inp value={edit.nome || ""} onChange={e => setEdit(p => ({ ...p, nome: e.target.value }))} />} />
              <F lbl="Matrícula" tip="Chave usada na importação da planilha do RH: reimportar atualiza em vez de duplicar." ch={
                <Inp value={edit.matricula || ""} onChange={e => setEdit(p => ({ ...p, matricula: e.target.value }))} />
              } />
            </>} />
            <G3 ch={<>
              <F lbl="Cargo" tip="A exigência de treinamento nasce do cargo. Sem cargo, a pessoa não aparece na matriz." ch={
                <Sel value={edit.cargoId || ""} onChange={e => setEdit(p => ({ ...p, cargoId: e.target.value || null }))}>
                  <option value="">— sem cargo —</option>
                  {cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Sel>
              } />
              <F lbl="Setor de trabalho"
                tip="Onde a pessoa efetivamente trabalha. Junto com o cargo, define quais documentos ela precisa treinar — hoje é o setor que separa encapsulamento de compressão, já que ambos são Auxiliar de Produção."
                ch={
                  <Sel value={edit.setorId || ""} onChange={e => {
                    const alvo = locais.find(l => l.id === e.target.value);
                    setEdit(p => ({ ...p, setorId: e.target.value || null, setor: alvo?.rotulo || p.setor || "" }));
                  }}>
                    <option value="">{edit.setor ? `— não vinculado (${edit.setor}) —` : "— sem setor —"}</option>
                    {locais.map(l => <option key={l.id} value={l.id}>{l.rotulo}</option>)}
                  </Sel>
                } />
              <F lbl="Data de admissão" tip="O prazo de treinamento passa a contar da admissão, para quem entra depois da versão vigente não nascer atrasado." ch={
                <Inp type="date" value={edit.dataAdmissao || ""} onChange={e => setEdit(p => ({ ...p, dataAdmissao: e.target.value || null }))} />
              } />
            </>} />
            <F lbl="Usuário do sistema (opcional)" tip="Vincular a uma conta permite que a pessoa confirme leitura sozinha. Operadores normalmente não têm conta." ch={
              <Sel value={edit.userId || ""} onChange={e => setEdit(p => ({ ...p, userId: e.target.value || null }))}>
                <option value="">— sem login —</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
              </Sel>
            } />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={s.btn} onClick={() => setEdit(null)}>Cancelar</button>
              <button style={{ ...s.btnA, opacity: salvando ? 0.6 : 1 }} disabled={salvando} onClick={salvarEdicao}>Salvar ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* Prévia da importação — nada é gravado antes de o usuário confirmar */}
      {previa && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 16, padding: "1.5rem", maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Importar — {previa.arquivo}</div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 14 }}>Confira antes de aplicar. Nada foi gravado ainda.</div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <KPI label="Criar" valor={previa.criar.length} cor="#2ab84a" />
              <KPI label="Atualizar" valor={previa.atualizar.length} cor="#4fc3f7" />
              <KPI label="Conflitos" valor={previa.conflitos.length} cor={previa.conflitos.length ? "#ff4f6a" : T.text3} />
              <KPI label="Ignorados" valor={previa.ignorados.length} cor={previa.ignorados.length ? "#e8a33d" : T.text3} />
            </div>

            {previa.cargosDesconhecidos.length > 0 && (
              <div style={{ background: "#ffd16618", border: "1px solid #ffd16644", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: T.text2 }}>
                <strong style={{ color: T.text }}>Cargos que não existem no catálogo:</strong> {previa.cargosDesconhecidos.join(", ")}.
                Cadastre-os em Admin → Catálogos → Cargos e importe de novo — não cadastramos cargo automaticamente para não criar grafia duplicada.
              </div>
            )}

            {[["Conflitos — precisam de decisão", previa.conflitos, "#ff4f6a"], ["Ignorados", previa.ignorados, "#e8a33d"]].map(([titulo, lista, cor]) => lista.length > 0 && (
              <div key={titulo} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cor, marginBottom: 5 }}>{titulo} ({lista.length})</div>
                <div style={{ maxHeight: 130, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                  {lista.map((x, i) => (
                    <div key={i} style={{ fontSize: 11, color: T.text2, padding: "4px 8px", background: T.surf, borderRadius: 6 }}>
                      Linha {x.linha}{x.nome ? ` · ${x.nome}` : ""} — {x.motivo}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={s.btn} onClick={() => setPrevia(null)}>Cancelar</button>
              <button style={{ ...s.btnA, opacity: salvando || (!previa.criar.length && !previa.atualizar.length) ? 0.5 : 1 }}
                disabled={salvando || (!previa.criar.length && !previa.atualizar.length)}
                onClick={aplicarImportacao}>
                Aplicar {previa.criar.length + previa.atualizar.length} registro(s) ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
