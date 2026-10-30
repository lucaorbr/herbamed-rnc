// Desenha a apresentação semanal em PowerPoint (.pptx editável) a partir de
// montarApresentacao(). Mesmo "rosto" dos PDFs: faixa verde no topo, folha branca,
// rodapé fino. O pptxgenjs só é carregado no clique (não pesa no bundle das telas).
import { MARCA } from "../../shared/marca";
import { fmt } from "../../core/utils";
import { LINHAS_POR_SLIDE, paginar } from "./apresentacaoLogic";

const cor = hex => hex.replace("#", "").toUpperCase();
const VERDE = cor(MARCA.verde), CLARO = cor(MARCA.claro), RODAPE = cor(MARCA.rodape), TEXTO_FAIXA = cor(MARCA.verdeTexto);
const TEXTO = "1F2A24", TEXTO2 = "5B6B61", BORDA = "D5DDD7", ZEBRA = "F6F8F6";
const VERMELHO = "C0392B", AMARELO = "B7791F";
const FONTE = "Calibri";
const LARG = 13.333, X0 = 0.45, W = LARG - 2 * X0;

const prazoTxt = p => (!p ? "—" : p >= "2099-01-01" ? "A definir" : fmt(p));
const dias = n => `${n} dia${n === 1 ? "" : "s"}`;

async function iconeDataUrl() {
  try {
    const resp = await fetch("/favicon-512.png");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((ok, falha) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).replace(/^data:/, ""));
      fr.onerror = falha;
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

const cab = txt => ({ text: txt, options: { bold: true, color: CLARO, fill: { color: VERDE } } });

function tabela(slide, cabecalho, linhas, colW, y = 1.25) {
  const rows = [cabecalho.map(cab), ...linhas.map((l, i) => l.map(c => {
    const cel = typeof c === "object" && c !== null ? c : { text: String(c ?? "—") };
    return { text: cel.text, options: { fill: { color: i % 2 ? ZEBRA : "FFFFFF" }, ...cel.options } };
  }))];
  slide.addTable(rows, {
    x: X0, y, w: W, colW, fontFace: FONTE, fontSize: 12, color: TEXTO, valign: "middle",
    border: { type: "solid", pt: 0.5, color: BORDA }, margin: [3, 6, 3, 6], rowH: 0.42,
  });
}

function vazio(slide, msg) {
  slide.addText(msg, { x: X0, y: 3, w: W, h: 1, align: "center", fontFace: FONTE, fontSize: 20, color: TEXTO2 });
}

const titulo = (base, i, n) => (n > 1 ? `${base} (${i + 1}/${n})` : base);

export async function gerarApresentacaoPptx(a, { usuario } = {}) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = usuario || "SGQ Herbamed";
  pptx.company = "Herbamed";
  pptx.title = "Qualidade: RNCs e desvios";

  const icone = await iconeDataUrl();
  const periodoTxt = `${fmt(a.semana.de)} a ${fmt(a.semana.ate)}`;

  pptx.defineSlideMaster({
    title: "SGQ",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: LARG, h: 0.95, fill: { color: VERDE } } },
      ...(icone ? [{ image: { x: X0, y: 0.17, w: 0.6, h: 0.6, data: icone } }] : []),
      { rect: { x: 0, y: 7.1, w: LARG, h: 0.4, fill: { color: RODAPE } } },
      { text: { text: `Herbamed · SGQ · Qualidade · semana de ${periodoTxt}`, options: { x: X0, y: 7.1, w: 9, h: 0.4, fontFace: FONTE, fontSize: 10, color: TEXTO2 } } },
    ],
    slideNumber: { x: 12.3, y: 7.15, w: 0.6, h: 0.3, fontFace: FONTE, fontSize: 10, color: TEXTO2 },
  });

  const novoSlide = (txt, sub) => {
    const s = pptx.addSlide({ masterName: "SGQ" });
    s.addText(txt, { x: icone ? 1.2 : X0, y: 0.12, w: 8.0, h: 0.7, fontFace: FONTE, fontSize: 22, bold: true, color: CLARO, valign: "middle", fit: "shrink" });
    if (sub) s.addText(sub, { x: 9.2, y: 0.12, w: LARG - 9.2 - X0, h: 0.7, fontFace: FONTE, fontSize: 12, color: TEXTO_FAIXA, align: "right", valign: "middle" });
    return s;
  };

  // 1. Capa
  const capa = pptx.addSlide();
  capa.background = { color: VERDE };
  if (icone) capa.addImage({ data: icone, x: X0 + 0.3, y: 1.6, w: 1.6, h: 1.6 });
  capa.addText("Qualidade", { x: X0 + 0.3, y: 3.5, w: 11, h: 0.9, fontFace: FONTE, fontSize: 44, bold: true, color: CLARO });
  capa.addText("RNCs e desvios em aberto", { x: X0 + 0.3, y: 4.35, w: 11, h: 0.7, fontFace: FONTE, fontSize: 26, color: CLARO });
  capa.addText(`Reunião semanal · semana de ${periodoTxt}`, { x: X0 + 0.3, y: 5.1, w: 11, h: 0.5, fontFace: FONTE, fontSize: 16, color: TEXTO_FAIXA });
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  capa.addText(`Gerado do SGQ em ${agora}${usuario ? ` por ${usuario}` : ""}`, { x: X0 + 0.3, y: 6.6, w: 11, h: 0.4, fontFace: FONTE, fontSize: 11, color: TEXTO_FAIXA });

  // 2. Resumo da semana
  const resumo = novoSlide("Resumo da semana", periodoTxt);
  const { rnc, desvio } = a.resumo;
  const cartoes = (y, rotulo, itens) => {
    resumo.addText(rotulo, { x: X0, y, w: W, h: 0.45, fontFace: FONTE, fontSize: 16, bold: true, color: VERDE });
    const cw = (W - 3 * 0.25) / 4;
    itens.forEach((it, i) => {
      const x = X0 + i * (cw + 0.25);
      resumo.addShape(pptx.ShapeType.roundRect, { x, y: y + 0.5, w: cw, h: 2.0, fill: { color: "F6F8F6" }, line: { color: BORDA, width: 0.75 }, rectRadius: 0.08 });
      resumo.addText(String(it.n), { x, y: y + 0.6, w: cw, h: 0.95, align: "center", fontFace: FONTE, fontSize: 40, bold: true, color: it.cor || TEXTO });
      resumo.addText(it.l, { x, y: y + 1.5, w: cw, h: 0.4, align: "center", fontFace: FONTE, fontSize: 14, color: TEXTO });
      if (it.sub) resumo.addText(it.sub, { x, y: y + 1.9, w: cw, h: 0.4, align: "center", fontFace: FONTE, fontSize: 11, color: TEXTO2 });
    });
  };
  cartoes(1.15, "RNCs", [
    { n: rnc.abertas, l: "Abertas na semana", sub: `Semana anterior: ${rnc.anterior.abertas}` },
    { n: rnc.encerradas, l: "Encerradas na semana", sub: `Semana anterior: ${rnc.anterior.encerradas}` },
    { n: rnc.emAberto, l: "Em aberto hoje" },
    { n: rnc.vencidas, l: "Com prazo vencido", cor: rnc.vencidas ? VERMELHO : TEXTO },
  ]);
  cartoes(4.0, "Desvios", [
    { n: desvio.registrados, l: "Registrados na semana", sub: `Semana anterior: ${desvio.anterior.registrados}` },
    { n: desvio.triados, l: "Triados na semana", sub: `Semana anterior: ${desvio.anterior.triados}` },
    { n: desvio.emAberto, l: "Aguardando triagem" },
    { n: desvio.atrasados, l: `Triagem acima de ${a.metaTriagem} dias`, cor: desvio.atrasados ? AMARELO : TEXTO },
  ]);

  // 3. RNCs vencidas
  const pagsVenc = paginar(a.rncsVencidas);
  pagsVenc.forEach((pag, i) => {
    const s = novoSlide(titulo("RNCs com prazo vencido", i, pagsVenc.length), `${a.rncsVencidas.length} RNC(s)`);
    if (!pag.length) return vazio(s, "Nenhuma RNC com prazo vencido.");
    tabela(s, ["Nº", "Assunto", "Responsável", "Setor", "Prazo", "Atraso", "Etapa atual"],
      pag.map(r => [r.num, r.assunto || "—", r.resp, r.setor, prazoTxt(r.prazo),
        { text: dias(r.diasAtraso), options: { bold: true, color: VERMELHO } }, r.etapa]),
      [1.4, 3.9, 1.8, 1.4, 1.1, 1.0, 1.83]);
  });

  // 4. RNCs em andamento por responsável (linha de grupo + itens; grupo não fica órfão no fim da página)
  const linhasResp = [];
  a.rncsPorResponsavel.forEach(g => {
    linhasResp.push({ grupo: `${g.resp} · ${g.itens.length} RNC(s)` });
    g.itens.forEach(it => linhasResp.push(it));
  });
  const pagsResp = [];
  let atual = [];
  linhasResp.forEach(l => {
    if (atual.length >= LINHAS_POR_SLIDE + 1 || (l.grupo && atual.length >= LINHAS_POR_SLIDE)) { pagsResp.push(atual); atual = []; }
    atual.push(l);
  });
  pagsResp.push(atual);
  pagsResp.forEach((pag, i) => {
    const total = a.rncsPorResponsavel.reduce((n, g) => n + g.itens.length, 0);
    const s = novoSlide(titulo("RNCs em andamento no prazo", i, pagsResp.length), `${total} RNC(s), por responsável`);
    if (!pag.length) return vazio(s, "Nenhuma outra RNC em aberto.");
    tabela(s, ["Nº", "Assunto", "Severidade", "Prazo", "Etapa atual", "Ações CAPA"],
      pag.map(l => l.grupo
        ? [{ text: l.grupo, options: { colspan: 6, bold: true, color: VERDE, fill: { color: "E3ECE5" } } }]
        : [l.num, l.assunto || "—", l.sev, prazoTxt(l.prazo), l.etapa,
          l.capa.total ? `${l.capa.concluidas} de ${l.capa.total} concluída(s)` : "Sem plano"]),
      [1.4, 4.6, 1.3, 1.2, 2.0, 1.93]);
  });

  // 5. Desvios com triagem atrasada
  const pagsDev = paginar(a.desviosAtrasados);
  pagsDev.forEach((pag, i) => {
    const s = novoSlide(titulo(`Desvios aguardando triagem há mais de ${a.metaTriagem} dias`, i, pagsDev.length), `${a.desviosAtrasados.length} desvio(s)`);
    if (!pag.length) return vazio(s, "Nenhum desvio com triagem atrasada.");
    tabela(s, ["Nº", "Assunto", "Setor", "Tipo", "Impacto", "Aberto há"],
      pag.map(d => [d.num, d.assunto || "—", d.setor, d.tipo, d.impacto,
        { text: dias(d.dias), options: { bold: true, color: d.dias > 15 ? VERMELHO : AMARELO } }]),
      [1.6, 4.4, 1.9, 2.0, 1.2, 1.33]);
  });

  // 6. Desvios por setor (gráfico nativo, editável no PowerPoint)
  const sSet = novoSlide("Desvios por setor", "Em aberto e registrados nos últimos 30 dias");
  if (!a.desviosPorSetor.length) vazio(sSet, "Nenhum desvio em aberto ou registrado nos últimos 30 dias.");
  else {
    const labels = a.desviosPorSetor.map(x => x.setor).reverse();
    sSet.addChart(pptx.ChartType.bar, [
      { name: "Registrados nos últimos 30 dias", labels, values: a.desviosPorSetor.map(x => x.ultimos30).reverse() },
      { name: "Aguardando triagem", labels, values: a.desviosPorSetor.map(x => x.abertos).reverse() },
    ], {
      x: X0, y: 1.2, w: W, h: 5.7, barDir: "bar", barGrouping: "clustered", chartColors: ["8FB59A", VERDE],
      showLegend: true, legendPos: "b", legendFontFace: FONTE, legendFontSize: 12,
      showValue: true, dataLabelFontSize: 11, dataLabelColor: TEXTO, dataLabelFormatCode: "0",
      catAxisLabelFontFace: FONTE, catAxisLabelFontSize: 12, catAxisLabelColor: TEXTO,
      valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 60,
    });
  }

  // 7. Ações CAPA que precisam das áreas
  const pagsAc = paginar(a.acoesCapa);
  pagsAc.forEach((pag, i) => {
    const s = novoSlide(titulo("Ações CAPA vencidas ou vencendo em 7 dias", i, pagsAc.length), `${a.acoesCapa.length} ação(ões)`);
    if (!pag.length) return vazio(s, "Nenhuma ação CAPA vencida ou vencendo nos próximos 7 dias.");
    tabela(s, ["RNC", "Ação", "Responsável", "Prazo", "Situação"],
      pag.map(x => [x.rnc, x.acao, x.resp, prazoTxt(x.prazo),
        x.vencida ? { text: `Vencida há ${dias(x.diasAtraso)}`, options: { bold: true, color: VERMELHO } } : "Vence nesta semana"]),
      [1.5, 5.4, 2.3, 1.2, 2.03]);
  });

  // 8. Encaminhamentos (para preencher na reunião)
  const enc = novoSlide("Encaminhamentos", "Preencher na reunião");
  tabela(enc, ["Encaminhamento", "Responsável", "Prazo"], Array.from({ length: 6 }, () => [" ", " ", " "]), [7.4, 3.0, 2.03]);

  await pptx.writeFile({ fileName: `Qualidade_semana_${a.semana.ate}.pptx` });
}
