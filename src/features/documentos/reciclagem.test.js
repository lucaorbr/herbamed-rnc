import { somarMeses, vencimentoDaEvidencia, statusCelula, indexarEvidencias, montarMatriz, filaDeReciclagem, pendentesDoUsuario } from "./treinamento";

const cargos = [{ id: "analista-cq", nome: "Analista de CQ", ativo: true }];
const users = [
  { id: "u1", name: "Ana",  cargoId: "analista-cq" },
  { id: "u2", name: "Beto", cargoId: "analista-cq" },
];
const doc = (over = {}) => ({
  id: "D1", codigo: "POP-001", titulo: "POP", versao: "02", status: "Vigente",
  treinamento: { exigido: true, modo: "leitura", cargos: ["analista-cq"], pessoasExtra: [], prazoDias: 30, desdeEm: "2026-01-01", reciclagemMeses: 12 },
  ...over,
});
const ev = (over = {}) => ({ docId: "D1", versao: "02", userId: "u1", dataRealizacao: "2026-01-10", ts: 1, ...over });

describe("somarMeses — não estoura para o mês seguinte", () => {
  it("soma simples", () => expect(somarMeses("2026-01-10", 12)).toBe("2027-01-10"));
  it("31 de janeiro + 1 mês é fim de fevereiro, não 3 de março", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("respeita ano bissexto", () => expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29"));
  it("atravessa o ano", () => expect(somarMeses("2026-11-15", 6)).toBe("2027-05-15"));
  it("aceita timestamp ISO completo", () => expect(somarMeses("2026-01-10T10:00:00Z", 6)).toBe("2026-07-10"));
  it("sem data ou sem meses devolve null", () => {
    expect(somarMeses(null, 12)).toBeNull();
    expect(somarMeses("2026-01-10", 0)).toBeNull();
  });
});

describe("vencimentoDaEvidencia", () => {
  it("calcula a partir da data do treinamento", () => {
    expect(vencimentoDaEvidencia(ev(), 12)).toBe("2027-01-10");
  });
  it("sem reciclagem configurada, não vence", () => {
    expect(vencimentoDaEvidencia(ev(), 0)).toBeNull();
    expect(vencimentoDaEvidencia(ev(), null)).toBeNull();
  });
  it("evidência sem data não vence", () => {
    expect(vencimentoDaEvidencia({ dataRealizacao: null }, 12)).toBeNull();
  });
});

describe("statusCelula com reciclagem", () => {
  const indice = indexarEvidencias([ev()]);
  it("dentro da validade: treinado, com contagem para o vencimento", () => {
    const r = statusCelula({ doc: doc(), userId: "u1", indice, hoje: "2026-12-01" });
    expect(r.status).toBe("treinado");
    expect(r.venceEm).toBe("2027-01-10");
    expect(r.diasParaVencer).toBe(40);
  });
  it("passou da validade: vencido, não treinado", () => {
    const r = statusCelula({ doc: doc(), userId: "u1", indice, hoje: "2027-02-01" });
    expect(r.status).toBe("vencido");
    expect(r.dias).toBe(22);
  });
  it("vencido é distinto de atrasado — quem nunca treinou continua atrasado", () => {
    expect(statusCelula({ doc: doc(), userId: "u2", indice, hoje: "2027-02-01" }).status).toBe("atrasado");
  });
  it("no exato dia do vencimento ainda vale", () => {
    expect(statusCelula({ doc: doc(), userId: "u1", indice, hoje: "2027-01-10" }).status).toBe("treinado");
  });
  it("sem reciclagem configurada nunca vence", () => {
    const d = doc({ treinamento: { ...doc().treinamento, reciclagemMeses: null } });
    const r = statusCelula({ doc: d, userId: "u1", indice, hoje: "2099-01-01" });
    expect(r.status).toBe("treinado");
    expect(r.venceEm).toBeNull();
  });
});

describe("montarMatriz com vencidos", () => {
  const base = { docs: [doc()], pessoas: users, catalogoCargos: cargos };
  it("conta vencido separado de pendente e atrasado", () => {
    const m = montarMatriz({ ...base, evidencias: [ev()], hoje: "2027-02-01" });
    expect(m.resumo).toMatchObject({ total: 2, treinado: 0, vencido: 1, atrasado: 1, pendente: 0 });
  });
  it("reciclagem vencida NÃO conta como conforme", () => {
    expect(montarMatriz({ ...base, evidencias: [ev()], hoje: "2027-02-01" }).resumo.conformidade).toBe(0);
    expect(montarMatriz({ ...base, evidencias: [ev()], hoje: "2026-06-01" }).resumo.conformidade).toBe(50);
  });
});

describe("pendentesDoUsuario inclui reciclagem vencida", () => {
  it("quem venceu volta para a lista de pendências", () => {
    const r = pendentesDoUsuario({ docs: [doc()], pessoas: users, evidencias: [ev()], catalogoCargos: cargos, userId: "u1", hoje: "2027-02-01" });
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("vencido");
  });
  it("dentro da validade não é pendência", () => {
    expect(pendentesDoUsuario({ docs: [doc()], pessoas: users, evidencias: [ev()], catalogoCargos: cargos, userId: "u1", hoje: "2026-06-01" })).toEqual([]);
  });
});

describe("filaDeReciclagem", () => {
  const base = { docs: [doc()], pessoas: users, evidencias: [ev()], catalogoCargos: cargos };
  it("traz quem vence dentro da janela", () => {
    const r = filaDeReciclagem({ ...base, hoje: "2026-12-01", janelaDias: 60 });
    expect(r).toHaveLength(1);
    expect(r[0].diasParaVencer).toBe(40);
  });
  it("ignora quem vence fora da janela", () => {
    expect(filaDeReciclagem({ ...base, hoje: "2026-06-01", janelaDias: 60 })).toEqual([]);
  });
  it("ignora quem já venceu — esse já está na matriz como vencido", () => {
    expect(filaDeReciclagem({ ...base, hoje: "2027-02-01", janelaDias: 60 })).toEqual([]);
  });
  it("ignora documento sem reciclagem configurada", () => {
    const d = doc({ treinamento: { ...doc().treinamento, reciclagemMeses: null } });
    expect(filaDeReciclagem({ ...base, docs: [d], hoje: "2026-12-01" })).toEqual([]);
  });
  it("ordena por quem vence primeiro", () => {
    const d2 = { ...doc(), id: "D2", codigo: "POP-002" };
    const r = filaDeReciclagem({
      ...base, docs: [doc(), d2],
      evidencias: [ev(), ev({ docId: "D2", dataRealizacao: "2025-12-20" })],
      hoje: "2026-12-01", janelaDias: 90,
    });
    expect(r.map(x => x.doc.id)).toEqual(["D2", "D1"]);
  });
});
