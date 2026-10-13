import { buildEmail, comBlocoAntesDoRodape, linkDaFicha } from "./emailRncLogic";

const base = {
  id: "abc", num: "NC-2026-007", status: "Em andamento", sev: "Maior", tipo: "Matéria-prima",
  data: "2026-10-01", produto: "Cápsula de Ômega 3", lote: "L123", setor: "Encapsulamento",
  resp: "Ana", desc: "Cápsulas amolecidas.", prazoCausa: "2026-10-05", prazoAC: "2026-10-20", prazoEfic: "2026-11-20",
};
const HOJE = "2026-10-13";

describe("buildEmail", () => {
  it("assunto leva severidade, número, evento e produto, sem emoji", () => {
    expect(buildEmail(base, "5w2h", { hoje: HOJE }).subject).toBe("[MAIOR] NC-2026-007 | Plano CAPA atualizado | Cápsula de Ômega 3");
    expect(buildEmail({ ...base, sev: "Menor" }, "abertura", { hoje: HOJE }).subject).toBe("NC-2026-007 | Nova não conformidade registrada | Cápsula de Ômega 3");
  });

  it("traz o link da ficha na etapa do evento", () => {
    const { body } = buildEmail(base, "ishikawa", { origem: "https://sgq.herbamed.com.br", hoje: HOJE });
    expect(body).toContain("Abrir no SGQ: https://sgq.herbamed.com.br/?aba=rnc&rnc=abc&etapa=causa");
    expect(linkDaFicha("https://x", base, "resumo")).toBe("https://x/?aba=rnc&rnc=abc");
    expect(buildEmail(base, "manual", { hoje: HOJE }).body).not.toContain("Abrir no SGQ");
  });

  it("análise incompleta não se anuncia como concluída", () => {
    const r = { ...base, ishikawa: { whys: ["a", "b", "", "", ""], root: "" } };
    const { body } = buildEmail(r, "ishikawa", { hoje: HOJE });
    expect(body).toContain("segue em andamento (faltam 1 porquê(s) e a causa raiz)");
    expect(body).not.toContain("foi concluída");
    const completa = { ...base, ishikawa: { whys: ["a", "b", "c", "", ""], root: "Umidade da MP nova" } };
    expect(buildEmail(completa, "ishikawa", { hoje: HOJE }).body).toContain("A análise de causa foi concluída");
  });

  it("no evento do CAPA lista as ações, com a vencida marcada", () => {
    const r = { ...base, w2h: [
      { tipo: "Corretiva", what: "Trocar fornecedor", who: "Bia", when: "2026-10-10", status: "Pendente" },
      { tipo: "Preventiva", what: "Ensaio de umidade", who: "Caio", when: "2026-10-30", status: "Concluída" },
    ] };
    const { body } = buildEmail(r, "5w2h", { hoje: HOJE });
    expect(body).toContain("2 ação(ões), 1 em aberto, 1 vencida(s)");
    expect(body).toContain("1. [Corretiva] Trocar fornecedor");
    expect(body).toContain("Situação: Pendente (VENCIDA)");
    expect(body).toContain("Situação: Concluída\n");
    expect(body.match(/PLANO CAPA/g)).toHaveLength(1);
  });

  it("mostra a disposição do material com o rótulo da decisão", () => {
    const r = { ...base, disposicao: { decisao: "concessao", justificativa: "Teor dentro", por: "RT", data: "2026-10-02" } };
    expect(buildEmail(r, "status", { hoje: HOJE }).body).toContain("Decisão: Liberar sob concessão");
  });

  it("RNC encerrada (inclusive Ineficaz) não mostra prazo vencido", () => {
    const enc = buildEmail({ ...base, status: "Ineficaz", eficacia: { resultado: "Ineficaz" } }, "eficacia", { hoje: HOJE }).body;
    expect(enc).not.toContain("VENCIDO");
    expect(enc).not.toContain("PRAZOS");
    expect(enc).toContain("registrada como INEFICAZ");
    expect(buildEmail(base, "status", { hoje: HOJE }).body).toContain("Análise de causa: 05/10/2026 (VENCIDO)");
  });

  it("não alinha com espaços nem usa as linhas ━", () => {
    const { body } = buildEmail(base, "abertura", { hoje: HOJE });
    expect(body).not.toMatch(/━|: {2,}/);
  });
});

describe("comBlocoAntesDoRodape", () => {
  it("insere antes do rodapé; sem rodapé, no fim", () => {
    const { body } = buildEmail(base, "manual", { hoje: HOJE });
    const novo = comBlocoAntesDoRodape(body, "LINK X");
    expect(novo.indexOf("LINK X")).toBeLessThan(novo.indexOf("Herbamed · Sistema"));
    expect(comBlocoAntesDoRodape("texto", "LINK X")).toBe("texto\n\nLINK X");
  });
});
