import { abaInicial, pendenciasPorAba } from "./paginaDocumento";

describe("página do documento — abas", () => {
  test("rascunho sem PDF ou sem controle de registro marca a aba Documento", () => {
    expect(pendenciasPorAba({ doc: { status: "Rascunho" } }).documento).toBe(true);
    expect(pendenciasPorAba({ doc: { status: "Rascunho", arquivo: {} }, faltaRegistro: true }).documento).toBe(true);
    expect(pendenciasPorAba({ doc: { status: "Rascunho", arquivo: {} } }).documento).toBe(false);
    expect(pendenciasPorAba({ doc: { status: "Vigente" } }).documento).toBe(false);
  });

  test("assinatura que espera por mim abre em Assinaturas", () => {
    const p = pendenciasPorAba({ doc: { status: "Aguardando Aprovação" }, minhaAssinatura: true });
    expect(p.assinaturas).toBe(true);
    expect(abaInicial(p)).toBe("assinaturas");
  });

  test("distribuição só pesa para quem pode distribuir", () => {
    const doc = { status: "Vigente", recolhaPendente: [{ setor: "X" }] };
    expect(pendenciasPorAba({ doc, podeDistribuir: false }).distribuicao).toBe(false);
    expect(abaInicial(pendenciasPorAba({ doc, podeDistribuir: true }))).toBe("distribuicao");
    expect(abaInicial(pendenciasPorAba({ doc: { status: "Vigente" }, podeDistribuir: true, semDistribuicao: true }))).toBe("distribuicao");
  });

  test("sem pendência abre em Documento", () => {
    expect(abaInicial(pendenciasPorAba({ doc: { status: "Vigente", arquivo: {} } }))).toBe("documento");
  });
});
