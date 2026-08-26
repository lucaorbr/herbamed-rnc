import {
  checklistTecnicoInicial,
  documentosIniciais,
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

  it("bloqueia parecer com documentos e itens técnicos pendentes", () => {
    const reg = {
      documentos: [{ item: "Ficha", obrigatorio: true, situacao: "Pendente", obs: "" }],
      checklistTecnico: [{ item: "Amostra", resultado: "", obs: "" }],
    };
    expect(pendenciasParecer(reg)).toHaveLength(2);
    reg.documentos[0].situacao = "Recebido";
    reg.checklistTecnico[0].resultado = "Conforme";
    expect(pendenciasParecer(reg)).toEqual([]);
  });

  it("marca homologação aprovada como vencida após a validade", () => {
    expect(statusEfetivo({ status: "Homologada", decisaoFinal: { validade: "2026-01-01" } }, new Date("2026-01-02T12:00:00"))).toBe("Vencida");
    expect(statusEfetivo({ status: "Homologada", decisaoFinal: { validade: "2026-12-31" } }, new Date("2026-01-02T12:00:00"))).toBe("Homologada");
  });
});
