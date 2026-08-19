import {
  SEP_BLOCO, identificacaoUsuario, carimbo, campoVazio,
  acrescentarAoCampo, blocosDoCampo, resumoAcrescimo,
} from "./campoHistoricoLogic";

const user = { name: "Lucas Ribeiro", email: "lucas.ribeiro@herbamed.com.br" };
const quando = new Date(2026, 7, 19, 14, 32); // 19/08/2026 14:32 (mês 7 = agosto)

describe("identificacaoUsuario", () => {
  test("usa a parte local do e-mail como login", () => {
    expect(identificacaoUsuario(user)).toBe("lucas.ribeiro");
  });
  test("cai para o nome quando não há e-mail (usuário legado)", () => {
    expect(identificacaoUsuario({ name: "Administrador SGQ" })).toBe("Administrador SGQ");
  });
  test("não quebra sem usuário", () => {
    expect(identificacaoUsuario(null)).toBe("sistema");
  });
});

describe("carimbo", () => {
  test("formato (login · dd/mm/aaaa hh:mm)", () => {
    expect(carimbo(user, quando)).toBe("(lucas.ribeiro · 19/08/2026 14:32)");
  });
  test("zero à esquerda em dia, mês e hora", () => {
    expect(carimbo(user, new Date(2026, 0, 5, 9, 7))).toBe("(lucas.ribeiro · 05/01/2026 09:07)");
  });
});

describe("acrescentarAoCampo", () => {
  test("primeiro acréscimo em campo vazio vira o único bloco, já carimbado", () => {
    expect(acrescentarAoCampo("", "Lote segregado.", user, quando))
      .toBe("(lucas.ribeiro · 19/08/2026 14:32) Lote segregado.");
  });

  test("PRESERVA o texto anterior e acrescenta no fim", () => {
    const antes = "Cápsulas com coloração amarelada.";
    const depois = acrescentarAoCampo(antes, "Reinspeção confirmou 3%.", user, quando);
    expect(depois.startsWith(antes)).toBe(true);
    expect(depois).toBe(antes + SEP_BLOCO + "(lucas.ribeiro · 19/08/2026 14:32) Reinspeção confirmou 3%.");
  });

  test("acréscimo vazio ou só espaço NÃO altera o registro", () => {
    const antes = "Texto original.";
    expect(acrescentarAoCampo(antes, "", user, quando)).toBe(antes);
    expect(acrescentarAoCampo(antes, "   \n ", user, quando)).toBe(antes);
    expect(acrescentarAoCampo(antes, null, user, quando)).toBe(antes);
  });

  test("acréscimos sucessivos empilham em ordem, mais recente por último", () => {
    const outro = { email: "maria@herbamed.com.br" };
    let t = "Original.";
    t = acrescentarAoCampo(t, "Primeiro.", user, quando);
    t = acrescentarAoCampo(t, "Segundo.", outro, new Date(2026, 7, 20, 9, 10));
    const blocos = blocosDoCampo(t);
    expect(blocos.map(b => b.texto)).toEqual(["Original.", "Primeiro.", "Segundo."]);
    expect(blocos.map(b => b.login)).toEqual([null, "lucas.ribeiro", "maria"]);
  });

  test("não duplica linhas em branco quando o texto anterior termina com quebra", () => {
    const t = acrescentarAoCampo("Original.\n\n", "Novo.", user, quando);
    expect(t).toBe("Original." + SEP_BLOCO + "(lucas.ribeiro · 19/08/2026 14:32) Novo.");
  });
});

describe("blocosDoCampo", () => {
  test("campo vazio não tem blocos", () => {
    expect(blocosDoCampo("")).toEqual([]);
    expect(blocosDoCampo(null)).toEqual([]);
  });

  test("registro antigo, sem carimbo, volta como bloco único de texto puro", () => {
    expect(blocosDoCampo("Descrição gravada antes desta onda."))
      .toEqual([{ texto: "Descrição gravada antes desta onda.", login: null, quando: null }]);
  });

  test("texto do usuário começando com parêntese não é confundido com carimbo", () => {
    const [b] = blocosDoCampo("(conforme POP-CQ-003) o lote foi reprovado.");
    expect(b.login).toBe(null);
    expect(b.texto).toBe("(conforme POP-CQ-003) o lote foi reprovado.");
  });

  test("separa carimbo do conteúdo", () => {
    const [b] = blocosDoCampo("(lucas.ribeiro · 19/08/2026 14:32) Reinspeção confirmou 3%.");
    expect(b).toEqual({ texto: "Reinspeção confirmou 3%.", login: "lucas.ribeiro", quando: "19/08/2026 14:32" });
  });

  test("bloco com várias linhas internas continua um bloco só", () => {
    const blocos = blocosDoCampo("Linha 1\nLinha 2" + SEP_BLOCO + "(a · 01/01/2026 00:00) Novo");
    expect(blocos).toHaveLength(2);
    expect(blocos[0].texto).toBe("Linha 1\nLinha 2");
  });
});

describe("campoVazio / resumoAcrescimo", () => {
  test("campoVazio ignora espaço em branco", () => {
    expect(campoVazio("  \n ")).toBe(true);
    expect(campoVazio("x")).toBe(false);
  });
  test("resumo corta texto longo e normaliza espaços", () => {
    expect(resumoAcrescimo("a  b\nc")).toBe("a b c");
    expect(resumoAcrescimo("x".repeat(200)).length).toBe(120);
    expect(resumoAcrescimo("x".repeat(200)).endsWith("…")).toBe(true);
  });
});
