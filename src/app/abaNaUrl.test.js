import { abaDaUrl, urlComAba, ABAS_VALIDAS } from "./abaNaUrl";

describe("abaDaUrl", () => {
  test("sem parâmetro abre a Home", () => {
    expect(abaDaUrl("")).toBe("home");
    expect(abaDaUrl("?outro=1")).toBe("home");
  });
  test("tela do menu é aceita", () => {
    expect(abaDaUrl("?aba=lista")).toBe("lista");
    expect(abaDaUrl("?aba=gestao-docs")).toBe("gestao-docs");
    expect(abaDaUrl("?aba=nova-revalidacao")).toBe("nova-revalidacao"); // subitem
  });
  test("telas fora do menu, abertas por atalho, são aceitas", () => {
    expect(abaDaUrl("?aba=config-desvios")).toBe("config-desvios");
    expect(abaDaUrl("?aba=admin")).toBe("admin");
  });
  test("tela desconhecida ou adulterada cai na Home, em vez de página em branco", () => {
    expect(abaDaUrl("?aba=nao-existe")).toBe("home");
    expect(abaDaUrl("?aba=<script>")).toBe("home");
    expect(abaDaUrl("?aba=")).toBe("home");
  });
  test("a lista de válidas vem do menu, sem id vazio", () => {
    expect(ABAS_VALIDAS.has("desvios")).toBe(true);
    expect(ABAS_VALIDAS.has("")).toBe(false);
  });
});

describe("urlComAba", () => {
  const base = "http://localhost:9027/";
  test("Home deixa o endereço limpo", () => {
    expect(urlComAba(base + "?aba=lista", "home")).toBe("/");
  });
  test("outras telas viram ?aba=", () => {
    expect(urlComAba(base, "lista")).toBe("/?aba=lista");
    expect(urlComAba(base + "?aba=lista", "desvios")).toBe("/?aba=desvios");
  });
  test("preserva outros parâmetros e o #", () => {
    expect(urlComAba(base + "?x=1#topo", "cep")).toBe("/?x=1&aba=cep#topo");
    expect(urlComAba(base + "?x=1&aba=cep", "home")).toBe("/?x=1");
  });
});
