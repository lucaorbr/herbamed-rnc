import {
  checklistTecnicoInicial,
  documentosIniciais,
  erroPorChave,
  pendenciasParecer,
  pendenciasSubmissao,
  statusEfetivo,
} from "./homologacaoLogic";

describe("homologacaoLogic", () => {
  it("monta checklists por categoria", () => {
    expect(documentosIniciais("Matéria-prima").some(d => d.item.includes("Certificado de análise"))).toBe(true);
    expect(checklistTecnicoInicial("Serviço").some(i => i.item.includes("SLA"))).toBe(true);
  });

  it("valida os campos mínimos da solicitação", () => {
    expect(pendenciasSubmissao({})).toHaveLength(7);
    expect(pendenciasSubmissao({
      fornecedorId: "f1", itemNome: "Vitamina C", finalidade: "Produto novo",
      categoria: "Matéria-prima", criticidade: "Alta", documentos: [{}], checklistTecnico: [{}],
    })).toEqual([]);
  });

  it("aponta o campo de cada pendência para a tela poder destacá-lo", () => {
    const erros = pendenciasSubmissao({});
    expect(erros.map(e => e.campo)).toEqual(
      expect.arrayContaining(["fornecedorId", "categoria", "itemNome", "criticidade", "finalidade"])
    );
    expect(erroPorChave(erros, "criticidade")).toMatch(/criticidade/i);
    expect(erroPorChave(erros, "fabricante")).toBe("");
  });

  it("bloqueia parecer com documentos e itens técnicos pendentes", () => {
    const reg = {
      documentos: [{ id: "doc-1", item: "Ficha", obrigatorio: true, situacao: "Pendente", obs: "" }],
      checklistTecnico: [{ id: "tec-1", item: "Amostra", resultado: "", obs: "" }],
    };
    expect(pendenciasParecer(reg)).toHaveLength(2);
    expect(erroPorChave(pendenciasParecer(reg), "doc-1")).toBeTruthy();
    reg.documentos[0].situacao = "Recebido";
    reg.checklistTecnico[0].resultado = "Conforme";
    expect(pendenciasParecer(reg)).toEqual([]);
  });

  // Dispensar um item da avaliação é decisão técnica: a inspeção vai querer
  // ler por que aquele documento não se aplicava a este fornecedor.
  it("exige justificativa para 'Não aplicável', não só para reprovado", () => {
    const semJustificativa = pendenciasParecer({
      documentos: [{ id: "doc-1", item: "FISPQ", obrigatorio: true, situacao: "Não aplicável", obs: "" }],
      checklistTecnico: [{ id: "tec-1", item: "Amostra", resultado: "Não aplicável", obs: "" }],
    });
    expect(semJustificativa).toHaveLength(2);
    expect(erroPorChave(semJustificativa, "doc-1")).toMatch(/justifique/i);

    expect(pendenciasParecer({
      documentos: [{ id: "doc-1", item: "FISPQ", obrigatorio: true, situacao: "Não aplicável", obs: "Produto não perigoso." }],
      checklistTecnico: [{ id: "tec-1", item: "Amostra", resultado: "Não aplicável", obs: "Serviço, sem amostra." }],
    })).toEqual([]);
  });

  it("marca homologação aprovada como vencida após a validade", () => {
    expect(statusEfetivo({ status: "Homologada", decisaoFinal: { validade: "2026-01-01" } }, new Date("2026-01-02T12:00:00"))).toBe("Vencida");
    expect(statusEfetivo({ status: "Homologada", decisaoFinal: { validade: "2026-12-31" } }, new Date("2026-01-02T12:00:00"))).toBe("Homologada");
  });
});
