import {
  montarGrupos, montarAbas, abaDaTela, telasDoGrupo, telasParaBusca, buscarTelas, ABAS_TOPO,
} from "./navegacao";

const admin = { isAdmin: true, isViewer: false };
const viewer = { isAdmin: false, isViewer: true };

const rncs = [{ status: "Aberta" }, { status: "Aberta" }, { status: "Eficaz" }];
const desvios = [{ status: "Registrado" }];

describe("montarGrupos", () => {
  it("entrega os 8 grupos do menu para o admin", () => {
    expect(montarGrupos({ ...admin }).map(g => g.id)).toEqual([
      "principal", "desvios-grupo", "qualidade", "cq", "producao", "analise", "cadastros", "gestao",
    ]);
  });

  it("conta as RNCs abertas e os desvios a triar no badge", () => {
    const g = montarGrupos({ ...admin, rncs, desvios });
    expect(g[0].items.find(i => i.id === "lista").badge).toBe(2);
    expect(g[1].items.find(i => i.id === "desvios").badge).toBe(1);
  });

  it("esconde do viewer o que ele não pode fazer", () => {
    const ids = montarGrupos({ ...viewer }).flatMap(g => g.items.map(i => i.id));
    expect(ids).not.toContain("nova");
    expect(ids).not.toContain("novo-desvio");
    expect(montarGrupos({ ...viewer }).map(g => g.id)).not.toContain("qualidade");
  });

  it("só admin vê trilha de auditoria e administração", () => {
    const doAdmin = montarGrupos({ ...admin }).find(g => g.id === "gestao").items.map(i => i.id);
    const doUser = montarGrupos({ isAdmin: false, isViewer: false }).find(g => g.id === "gestao").items.map(i => i.id);
    expect(doAdmin).toEqual(expect.arrayContaining(["audit-log", "admin"]));
    expect(doUser).not.toContain("audit-log");
    expect(doUser).not.toContain("admin");
  });

  it("laudos respeita a permissão própria", () => {
    const semPerm = montarGrupos({ ...admin, perm: () => false }).find(g => g.id === "cadastros");
    expect(semPerm.items.map(i => i.id)).not.toContain("laudos");
    const comPerm = montarGrupos({ ...admin, perm: () => true }).find(g => g.id === "cadastros");
    expect(comPerm.items.map(i => i.id)).toContain("laudos");
  });
});

describe("telasDoGrupo", () => {
  it("achata o subgrupo de 3º nível — barra de abas não tem terceiro nível", () => {
    const cq = montarGrupos({ ...admin }).find(g => g.id === "cq");
    const telas = telasDoGrupo(cq).map(t => t.id);
    expect(telas).toContain("revalidacao");
    expect(telas).toContain("nova-revalidacao");
    expect(telas).not.toContain("revalidacao-sub");
  });

  it("o 'Registros' do subgrupo herda o nome do subgrupo, para não ficar ambíguo", () => {
    const cq = montarGrupos({ ...admin }).find(g => g.id === "cq");
    const tela = telasDoGrupo(cq).find(t => t.id === "revalidacao");
    expect(tela.label).toBe("Revalidações");
  });
});

describe("montarAbas", () => {
  const abas = () => montarAbas(montarGrupos({ ...admin, rncs, desvios }));

  it("entrega 8 abas, com Início na frente", () => {
    expect(abas().map(a => a.id)).toEqual([
      "inicio", "rncs", "desvios", "qualidade", "producao", "documentos", "indicadores", "cadastros",
    ]);
  });

  it("as Ferramentas da Qualidade entram na aba RNCs — é de onde são usadas", () => {
    const rncsAba = abas().find(a => a.id === "rncs");
    expect(rncsAba.telas.map(t => t.id)).toEqual(
      expect.arrayContaining(["lista", "nova", "reunioes", "ishikawa", "5w2h", "eficacia", "fmea"])
    );
  });

  it("NENHUMA tela do menu fica órfã — toda tela cabe em alguma aba", () => {
    const grupos = montarGrupos({ ...admin });
    const doMenu = grupos.flatMap(telasDoGrupo).map(t => t.id).sort();
    const nasAbas = montarAbas(grupos).flatMap(a => a.telas.map(t => t.id)).sort();
    expect(nasAbas).toEqual(doMenu);
  });

  it("nenhuma tela aparece em duas abas", () => {
    const ids = abas().flatMap(a => a.telas.map(t => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("soma os badges das telas na aba", () => {
    expect(abas().find(a => a.id === "rncs").badge).toBe(2);
    expect(abas().find(a => a.id === "desvios").badge).toBe(1);
  });

  it("aba que ficaria vazia não aparece — mas Início sempre fica", () => {
    const vazio = montarAbas([]);
    expect(vazio.map(a => a.id)).toEqual(["inicio"]);
  });

  it("todo grupo declarado em ABAS_TOPO existe de verdade no menu", () => {
    const existentes = new Set(montarGrupos({ ...admin }).map(g => g.id));
    const declarados = ABAS_TOPO.flatMap(a => a.grupos);
    expect(declarados.filter(g => !existentes.has(g))).toEqual([]);
  });

  it("todo grupo do menu está declarado em alguma aba", () => {
    const declarados = new Set(ABAS_TOPO.flatMap(a => a.grupos));
    const doMenu = montarGrupos({ ...admin }).map(g => g.id);
    expect(doMenu.filter(g => !declarados.has(g))).toEqual([]);
  });
});

describe("abaDaTela", () => {
  const abas = montarAbas(montarGrupos({ ...admin }));

  it("acha a aba de cada tela", () => {
    expect(abaDaTela(abas, "lista")).toBe("rncs");
    expect(abaDaTela(abas, "fmea")).toBe("rncs");
    expect(abaDaTela(abas, "gestao-docs")).toBe("documentos");
    expect(abaDaTela(abas, "nova-revalidacao")).toBe("qualidade");
  });

  it("home e telas fora do menu caem em Início", () => {
    expect(abaDaTela(abas, "home")).toBe("inicio");
    expect(abaDaTela(abas, "tela-que-nao-existe")).toBe("inicio");
  });
});

describe("busca de telas", () => {
  const telas = telasParaBusca(montarGrupos({ ...admin }));

  it("cada tela carrega o caminho, para desambiguar nomes repetidos", () => {
    const indicadores = telas.filter(t => t.label === "Indicadores");
    expect(indicadores.map(t => t.caminho)).toEqual(["Desvios"]);
    expect(telas.find(t => t.id === "dashboard").caminho).toBe("Indicadores");
  });

  it("busca ignorando acento e caixa", () => {
    expect(buscarTelas(telas, "revalida").map(t => t.id)).toEqual(["revalidacao", "nova-revalidacao"]);
    expect(buscarTelas(telas, "PRODUCAO").map(t => t.id)).toContain("producao-processos");
    expect(buscarTelas(telas, "auditoria").map(t => t.id)).toEqual(expect.arrayContaining(["auditorias", "audit-log"]));
  });

  it("acha também pelo nome da aba", () => {
    expect(buscarTelas(telas, "cadastros").map(t => t.id)).toEqual(
      expect.arrayContaining(["fornecedores", "clientes", "laudos"])
    );
  });

  it("termo vazio devolve tudo", () => {
    expect(buscarTelas(telas, "  ")).toHaveLength(telas.length);
  });

  it("termo sem resultado devolve vazio, sem quebrar", () => {
    expect(buscarTelas(telas, "zzzz")).toEqual([]);
  });
});
