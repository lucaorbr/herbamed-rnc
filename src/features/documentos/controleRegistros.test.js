import {
  camposDaRegra, errosDaRegra, faltaControleRegistro, geraRegistro, listaControleRegistros, normBusca, novaRegra, regraMudou,
  regraDoRegistro, resumoControleRegistros, textoRetencao,
} from "./controleRegistros";

const fo = (extra = {}) => ({ id: 1, tipo: "FO", codigo: "FO-SGQ-001", titulo: "Checklist", depto: "SGQ", status: "Vigente", ...extra });

describe("controle de registros", () => {
  test("só formulário gera registro", () => {
    expect(geraRegistro(fo())).toBe(true);
    expect(geraRegistro(fo({ tipo: "PO" }))).toBe(false);
  });

  test("sem regra gravada vale o padrão, com o departamento do documento", () => {
    expect(regraDoRegistro(fo())).toMatchObject({
      armazenamento: "fisico", retencaoAnos: 5, descarte: "destruicao", recuperacao: "SGQ", definida: false,
    });
    const gravada = regraDoRegistro(fo({ controleRegistro: { armazenamento: "eletronico", recuperacao: "CQ", retencaoAnos: 4, indeterminado: false, descarte: "exclusao" } }));
    expect(gravada).toMatchObject({ armazenamento: "eletronico", recuperacao: "CQ", retencaoAnos: 4, definida: true });
  });

  test("valida a regra antes de salvar", () => {
    const ok = { armazenamento: "fisico", recuperacao: "SGQ", retencaoAnos: 5, descarte: "destruicao" };
    expect(errosDaRegra(ok)).toEqual([]);
    expect(errosDaRegra({ ...ok, retencaoAnos: "" })).toHaveLength(1);
    expect(errosDaRegra({ ...ok, retencaoAnos: 2.5 })).toHaveLength(1);
    expect(errosDaRegra({ ...ok, retencaoAnos: "", indeterminado: true })).toEqual([]);
    expect(errosDaRegra({ ...ok, recuperacao: " " })).toHaveLength(1);
  });

  test("indeterminado não guarda anos", () => {
    const r = novaRegra({ armazenamento: "ambos", recuperacao: " SGQ ", retencaoAnos: 5, indeterminado: true, descarte: "na" }, { por: "Ana", hoje: "2026-10-08" });
    expect(r).toMatchObject({ retencaoAnos: null, indeterminado: true, recuperacao: "SGQ", atualizadoPor: "Ana" });
    expect(textoRetencao(r)).toBe("Indeterminado");
    expect(textoRetencao({ retencaoAnos: 1 })).toBe("1 ano");
  });

  test("lista só formulários atuais, ordenados; obsoleto só quando pedido", () => {
    const docs = [
      fo({ id: 2, codigo: "FO-SGQ-002" }),
      fo({ id: 1, codigo: "FO-CQ-001", controleRegistro: { armazenamento: "fisico", recuperacao: "CQ", retencaoAnos: 4, descarte: "destruicao" } }),
      fo({ id: 3, codigo: "FO-SGQ-003", status: "Obsoleto" }),
      fo({ id: 4, codigo: "FO-SGQ-004", status: "Rascunho" }),
      fo({ id: 5, codigo: "PO-SGQ-001", tipo: "PO" }),
    ];
    const linhas = listaControleRegistros(docs);
    expect(linhas.map(l => l.doc.codigo)).toEqual(["FO-CQ-001", "FO-SGQ-002"]);
    expect(resumoControleRegistros(linhas)).toEqual({ total: 2, definidas: 1, noPadrao: 1 });
    expect(listaControleRegistros(docs, { incluirObsoletos: true }).map(l => l.doc.codigo)).toContain("FO-SGQ-003");
  });
});

describe("controle de registro como etapa do elaborador", () => {
  test("formulário sem regra gravada trava a assinatura; outros tipos não", () => {
    expect(faltaControleRegistro(fo())).toBe(true);
    expect(faltaControleRegistro(fo({ controleRegistro: { armazenamento: "fisico" } }))).toBe(false);
    expect(faltaControleRegistro(fo({ tipo: "PO" }))).toBe(false);
  });

  test("o formulário nasce com o padrão e a regra só regrava se mudar", () => {
    const campos = camposDaRegra(fo({ depto: "CQ" }));
    expect(campos).toMatchObject({ armazenamento: "fisico", recuperacao: "CQ", retencaoAnos: 5, descarte: "destruicao" });
    const gravada = novaRegra(campos, { por: "Ana", hoje: "2026-10-01" });
    expect(regraMudou(gravada, { ...campos })).toBe(false);
    expect(regraMudou(gravada, { ...campos, retencaoAnos: "5" })).toBe(false);
    expect(regraMudou(gravada, { ...campos, retencaoAnos: 4 })).toBe(true);
    expect(regraMudou(null, campos)).toBe(true);
  });

  test("busca ignora acento e caixa", () => {
    expect(normBusca("Identificação")).toBe("identificacao");
  });
});
