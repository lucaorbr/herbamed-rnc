import {
  chaveDestino, destinoDaSelecao, destinoLabel, validarDistribuicao, novaCopiaFisica,
  colaboradoresDoDestino, registroDeRecolha, validarRecolha, comRecolha, comRecolhaObsoleta,
} from "./distribuicao";

const area = { id: "PRO", label: "Produção", ativo: true, setores: [
  { id: "enc", nome: "Encapsulamento" },
  { id: "com", nome: "Compressão" },
] };

const catalogoAreas = [area, { id: "SGQ", label: "Qualidade", setores: [{ id: "cq", nome: "Controle de Qualidade" }] }];

const colaboradores = [
  { id: "c1", nome: "Cleber Antunes", matricula: "1042", setorId: "enc", userId: null },   // sem login
  { id: "c2", nome: "Bruno Cardoso",  matricula: "1043", setorId: "enc", userId: "u9" },   // com login
  { id: "c3", nome: "Marcelo Dias",   setorId: "com" },
  { id: "c4", nome: "Ana Souza",      setorId: "cq" },
  { id: "c5", nome: "Desligado",      setorId: "enc", ativo: false },
];

const formOk = (over = {}) => ({
  areaId: "PRO", tipoDestino: "setor", setorId: "enc",
  entreguePor: "Lucas", recebidoPor: "Cleber Antunes", recebidoPorId: "c1",
  dataEntrega: "2026-08-14", ...over,
});

const setorEnc = area.setores[0];

describe("destino", () => {
  it("monta a chave por setor e por área inteira", () => {
    expect(destinoDaSelecao({ area, setor: setorEnc, tipoDestino: "setor" }).destinoKey).toBe("setor:PRO:enc");
    expect(destinoDaSelecao({ area, tipoDestino: "area" }).destinoKey).toBe("area:PRO");
  });

  it("área inteira não carrega setor", () => {
    const d = destinoDaSelecao({ area, setor: setorEnc, tipoDestino: "area" });
    expect(d.setorId).toBeNull();
    expect(d.setorNome).toBeNull();
  });

  it("registro antigo, sem destinoKey, ainda é comparável — nada foi reescrito", () => {
    expect(chaveDestino({ setor: "PRO" })).toBe("legado:PRO");
    expect(chaveDestino({ destinoKey: "setor:PRO:enc", setor: "PRO/enc" })).toBe("setor:PRO:enc");
  });

  it("rotula o destino de forma legível", () => {
    expect(destinoLabel(destinoDaSelecao({ area, setor: setorEnc, tipoDestino: "setor" })))
      .toBe("PRO — Produção / Encapsulamento");
    expect(destinoLabel(destinoDaSelecao({ area, tipoDestino: "area" })))
      .toBe("PRO — Produção (área inteira)");
  });
});

describe("validarDistribuicao", () => {
  it("aceita o formulário completo", () => {
    expect(validarDistribuicao({ form: formOk(), area, setor: setorEnc, hoje: "2026-08-17" }))
      .toEqual({ ok: true, erro: "" });
  });

  it("barra sem recebedor — cópia sem recebedor não tem de quem cobrar a devolução", () => {
    const r = validarDistribuicao({ form: formOk({ recebidoPor: "  " }), area, setor: setorEnc, hoje: "2026-08-17" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/recebeu/i);
  });

  it("barra sem quem entregou", () => {
    expect(validarDistribuicao({ form: formOk({ entreguePor: "" }), area, setor: setorEnc, hoje: "2026-08-17" }).ok).toBe(false);
  });

  it("barra sem data", () => {
    expect(validarDistribuicao({ form: formOk({ dataEntrega: "" }), area, setor: setorEnc, hoje: "2026-08-17" }).ok).toBe(false);
  });

  it("barra data futura — não se registra entrega que ainda não aconteceu", () => {
    const r = validarDistribuicao({ form: formOk({ dataEntrega: "2026-09-01" }), area, setor: setorEnc, hoje: "2026-08-17" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/futura/i);
  });

  it("aceita data passada — a entrega de sexta pode ser registrada na segunda", () => {
    expect(validarDistribuicao({ form: formOk({ dataEntrega: "2026-08-10" }), area, setor: setorEnc, hoje: "2026-08-17" }).ok).toBe(true);
  });

  it("barra destino duplicado", () => {
    const existente = destinoDaSelecao({ area, setor: setorEnc, tipoDestino: "setor" });
    const r = validarDistribuicao({ form: formOk(), area, setor: setorEnc, existentes: [existente], hoje: "2026-08-17" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/já tem/i);
  });

  it("barra sem área e sem setor", () => {
    expect(validarDistribuicao({ form: formOk(), area: null, hoje: "2026-08-17" }).ok).toBe(false);
    expect(validarDistribuicao({ form: formOk(), area, setor: null, hoje: "2026-08-17" }).ok).toBe(false);
  });
});

describe("novaCopiaFisica", () => {
  it("grava recebedor, data informada e vínculo com o colaborador", () => {
    const c = novaCopiaFisica({
      area, setor: setorEnc, tipoDestino: "setor", dataEntrega: "2026-08-14",
      entreguePor: " Lucas ", recebidoPor: " Cleber Antunes ", recebidoPorId: "c1",
      versao: "02", registradoPor: "Lucas",
    });
    expect(c).toMatchObject({
      destinoKey: "setor:PRO:enc", dataEntrega: "2026-08-14",
      entreguePor: "Lucas", recebidoPor: "Cleber Antunes", recebidoPorId: "c1", versao: "02",
    });
  });

  it("usa a data informada, não a de hoje", () => {
    expect(novaCopiaFisica({ area, setor: setorEnc, tipoDestino: "setor", dataEntrega: "2025-01-02" }).dataEntrega)
      .toBe("2025-01-02");
  });
});

describe("colaboradoresDoDestino", () => {
  it("traz o pessoal do setor de destino separado do resto", () => {
    const { doDestino, outros } = colaboradoresDoDestino(colaboradores, { areaId: "PRO", setorId: "enc", tipoDestino: "setor" }, catalogoAreas);
    expect(doDestino.map(c => c.id)).toEqual(["c2", "c1"]); // ordem alfabética: Bruno, Cleber
    expect(outros.map(c => c.id)).toEqual(["c4", "c3"]);
  });

  it("inclui quem NÃO tem login — é quem recebe a cópia no chão de fábrica", () => {
    const { doDestino } = colaboradoresDoDestino(colaboradores, { areaId: "PRO", setorId: "enc", tipoDestino: "setor" }, catalogoAreas);
    expect(doDestino.some(c => c.id === "c1" && !c.userId)).toBe(true);
  });

  it("área inteira alcança todos os setores da área", () => {
    const { doDestino } = colaboradoresDoDestino(colaboradores, { areaId: "PRO", tipoDestino: "area" }, catalogoAreas);
    expect(doDestino.map(c => c.id).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("desligado não aparece", () => {
    const todos = colaboradoresDoDestino(colaboradores, { areaId: "PRO", setorId: "enc", tipoDestino: "setor" }, catalogoAreas);
    expect([...todos.doDestino, ...todos.outros].some(c => c.id === "c5")).toBe(false);
  });

  it("sem destino escolhido, devolve todo mundo como 'outros'", () => {
    const { doDestino, outros } = colaboradoresDoDestino(colaboradores, {}, catalogoAreas);
    expect(doDestino).toEqual([]);
    expect(outros).toHaveLength(4);
  });
});

describe("recolha", () => {
  const copia = novaCopiaFisica({
    area, setor: setorEnc, tipoDestino: "setor", dataEntrega: "2026-03-02",
    entreguePor: "Lucas", recebidoPor: "Cleber Antunes", recebidoPorId: "c1", versao: "01",
  });
  const doc = { id: "d1", versao: "02", distribuicaoFisica: [copia] };
  const dados = { data: "2026-08-14", recolhidoPor: "Lucas", devolvidoPor: "Cleber Antunes" };

  it("exige data e quem recolheu", () => {
    expect(validarRecolha({ form: { data: "", recolhidoPor: "Lucas" } }).ok).toBe(false);
    expect(validarRecolha({ form: { data: "2026-08-14", recolhidoPor: " " } }).ok).toBe(false);
    expect(validarRecolha({ form: dados, hoje: "2026-08-17" }).ok).toBe(true);
  });

  it("não aceita recolha futura", () => {
    expect(validarRecolha({ form: { ...dados, data: "2026-12-01" }, hoje: "2026-08-17" }).ok).toBe(false);
  });

  it("guarda o ciclo inteiro: entrega, recebedor, recolha e quem devolveu", () => {
    const e = registroDeRecolha({ copia, ...dados });
    expect(e).toMatchObject({
      destinoLabel: "PRO — Produção / Encapsulamento", versao: "01",
      entregaEm: "2026-03-02", entreguePor: "Lucas", recebidoPor: "Cleber Antunes",
      recolhaEm: "2026-08-14", recolhidoPor: "Lucas", devolvidoPor: "Cleber Antunes",
      motivo: "recolha",
    });
  });

  it("recolher tira da distribuição e ARQUIVA no histórico — não some o registro", () => {
    const d = comRecolha(doc, copia, dados);
    expect(d.distribuicaoFisica).toHaveLength(0);
    expect(d.historicoDistribuicao).toHaveLength(1);
    expect(d.historicoDistribuicao[0].recebidoPor).toBe("Cleber Antunes");
  });

  it("recolha de cópia obsoleta baixa a pendência e arquiva com o motivo próprio", () => {
    const pend = { ...copia, versaoAnterior: "01" };
    const comPend = { ...doc, recolhaPendente: [pend] };
    const d = comRecolhaObsoleta(comPend, pend, dados);
    expect(d.recolhaPendente).toBeNull();
    expect(d.historicoDistribuicao[0]).toMatchObject({ motivo: "obsoleta", versao: "01" });
  });

  it("baixar uma pendência não derruba as outras", () => {
    const p1 = { ...copia, versaoAnterior: "01" };
    const p2 = { ...novaCopiaFisica({ area, setor: area.setores[1], tipoDestino: "setor" }), versaoAnterior: "01" };
    const d = comRecolhaObsoleta({ ...doc, recolhaPendente: [p1, p2] }, p1, dados);
    expect(d.recolhaPendente).toHaveLength(1);
    expect(d.recolhaPendente[0].destinoKey).toBe("setor:PRO:com");
  });

  it("funciona com registro antigo, sem destinoKey e sem recebedor", () => {
    const antiga = { setor: "PRO", dataEntrega: "2025-01-10", entreguePor: "Fulano" };
    const d = comRecolha({ id: "d1", versao: "02", distribuicaoFisica: [antiga] }, antiga, dados);
    expect(d.distribuicaoFisica).toHaveLength(0);
    expect(d.historicoDistribuicao[0]).toMatchObject({ recebidoPor: "", entregaEm: "2025-01-10" });
  });

  it("não muta o documento recebido", () => {
    const antes = JSON.parse(JSON.stringify(doc));
    comRecolha(doc, copia, dados);
    expect(doc).toEqual(antes);
  });

  it("acumula recolhas no histórico", () => {
    const um = comRecolha(doc, copia, dados);
    const outra = novaCopiaFisica({ area, setor: area.setores[1], tipoDestino: "setor", dataEntrega: "2026-04-01" });
    const dois = comRecolha({ ...um, distribuicaoFisica: [outra] }, outra, dados);
    expect(dois.historicoDistribuicao).toHaveLength(2);
  });
});
