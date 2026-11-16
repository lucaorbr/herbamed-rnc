import { buildDesvioHTML } from "./pdfExports";
import { figurasDoDesvio } from "../rnc/anexoFotograficoLogic";

const base = {
  num: "DV-2026-0012", status: "Registrado", dataOcorrencia: "2026-11-10", dataRegistro: "2026-11-10",
  registradoPor: "Ana Souza", setor: "Envase 1", tipo: "Outros", tipoOutro: "Vazamento <tampa>",
  produto: "Calcivitam — Lote 25-001", desc: "Tampa solta.\n\n(ana · 11/11/2026 09:00) Também no lote 25-002.",
  acaoImediata: "Sim", acaoDesc: "Lote segregado.",
  anexos: [{ url: "/api/files/1", name: "foto.jpg", type: "image/jpeg" }, { url: "/api/files/2", name: "laudo.pdf", type: "application/pdf" }],
  historico: [{ data: "2026-11-10", acao: "Desvio registrado", resp: "Ana Souza" }],
};

test("traz registro, acréscimos e anexos com a figura", () => {
  const html = buildDesvioHTML(base, figurasDoDesvio(base), {}, { hoje: "2026-11-20" });
  expect(html).toContain("DV-2026-0012");
  expect(html).toContain("Outros — Vazamento &lt;tampa&gt;"); // texto livre escapado
  expect(html).toContain("Também no lote 25-002.");
  expect(html).toContain("Lote segregado.");
  expect(html).toContain("foto.jpg (Figura 1), laudo.pdf");
  expect(html).toContain("Anexo fotográfico");
  expect(html).toContain("há 10 dia(s)");
  expect(html).toContain("(atrasado)");
  expect(html).toContain("Desvio registrado");
});

test("encerrado mostra justificativa; convertido mostra a RNC", () => {
  const enc = buildDesvioHTML({ ...base, anexos: [], status: "Encerrado", encerradoPor: "Lucas", encerradoEm: "2026-11-12", encerramentoMotivo: "Ação imediata sanou." });
  expect(enc).toContain("Ação imediata sanou.");
  expect(enc).not.toContain("Aguardando triagem");
  expect(enc).not.toContain("Anexo fotográfico");
  const conv = buildDesvioHTML({ ...base, status: "Convertido em RNC", convertidoPor: "Lucas", convertidoEm: "2026-11-12", rncNum: "NC-2026-031" });
  expect(conv).toContain("NC-2026-031");
});

test("sem ação imediata diz isso, e só imagens viram figura", () => {
  const html = buildDesvioHTML({ ...base, acaoImediata: "Não", acaoDesc: "" });
  expect(html).toContain("Não houve ação imediata registrada.");
  expect(figurasDoDesvio(base).map(f => f.anexo.name)).toEqual(["foto.jpg"]);
});
