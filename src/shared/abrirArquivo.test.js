import { abreNoNavegador, htmlDaMoldura } from "./abrirArquivo";

describe("abreNoNavegador", () => {
  it("PDF e imagem abrem na moldura, pelo tipo ou pela extensão", () => {
    expect(abreNoNavegador({ type: "application/pdf", name: "x" })).toBe(true);
    expect(abreNoNavegador({ type: "image/jpeg" })).toBe(true);
    expect(abreNoNavegador({ name: "Laudo FOR-01.PDF" })).toBe(true);
    expect(abreNoNavegador({ nome: "foto.webp" })).toBe(true);
  });
  it("Word/Excel seguem o link normal (o navegador baixa)", () => {
    expect(abreNoNavegador({ name: "plano.docx", type: "application/octet-stream" })).toBe(false);
    expect(abreNoNavegador({ name: "planilha.xlsx" })).toBe(false);
    expect(abreNoNavegador({})).toBe(false);
  });
});

describe("htmlDaMoldura", () => {
  it("põe o nome no <title> e escapa HTML", () => {
    const h = htmlDaMoldura('POP-SGQ-002 Rev.01 — "Limpeza" <x>', "blob:http://a/1");
    expect(h).toContain("<title>POP-SGQ-002 Rev.01 — &quot;Limpeza&quot; &lt;x&gt;</title>");
    expect(h).toContain('<iframe src="blob:http://a/1"');
  });
  it("sem arquivo ainda, mostra carregando", () => {
    expect(htmlDaMoldura("Doc")).toContain("Carregando Doc");
  });
});
