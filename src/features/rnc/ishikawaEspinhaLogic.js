// Desenho do Ishikawa em espinha de peixe (v3.30.0) — fonte única da geometria.
// A tela (IshikawaEspinha.jsx) e o PDF da RNC (espinhaSvg) desenham a partir do mesmo
// layout, então os dois nunca divergem. Puro: as cores entram por papel e a medida do
// texto é injetável (canvas na tela, estimativa no PDF e nos testes).

export const CATS_ESPINHA = [["mao", "Mão de obra"], ["maquina", "Máquina"], ["metodo", "Método"], ["material", "Material"], ["medicao", "Medição"], ["meioamb", "Meio ambiente"]];
export const MAX_POR_OSSO = 5;

// Geometria fixa: tudo sai destas constantes. Ossos paralelos e igualmente espaçados.
const G = { W: 1120, H: 600, Y: 300, X0: 40, XH: 900, COLS: [360, 620, 880], DX: 170, YTOP: 78, YBOT: 522, FONTE: 12, LH: 14 };

/** Estimativa de largura de texto (px) quando não há canvas: PDF e testes. */
export const medidaAproximada = (t, peso, tam) => String(t).length * tam * (peso >= 700 ? 0.6 : 0.56);

/** Medida real pelo canvas do navegador (tela e PDF); sem canvas, cai na estimativa. */
export function medidaCanvas(familia) {
  let ctx = null;
  return (t, peso, tam) => {
    try {
      ctx = ctx || document.createElement("canvas").getContext("2d");
      if (!ctx) return medidaAproximada(t, peso, tam);
      ctx.font = `${peso} ${tam}px ${familia}`;
      return ctx.measureText(String(t)).width;
    } catch { return medidaAproximada(t, peso, tam); }
  };
}

/** Quebra em linhas que cabem em `larg`; passa de `maxLinhas`, corta com reticências. */
export function quebrarTexto(texto, larg, mede, peso, tam, maxLinhas) {
  const linhas = []; let atual = "";
  for (const p of String(texto || "").trim().split(/\s+/).filter(Boolean)) {
    const teste = atual ? `${atual} ${p}` : p;
    if (!atual || mede(teste, peso, tam) <= larg) atual = teste; else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLinhas) return linhas;
  const corte = linhas.slice(0, maxLinhas);
  let ult = `${corte[maxLinhas - 1]}…`;
  while (mede(ult, peso, tam) > larg && ult.length > 2) ult = `${ult.slice(0, -2)}…`;
  corte[maxLinhas - 1] = ult;
  return corte;
}

/** Ishikawa tem alguma causa levantada? (decide se vale desenhar) */
export const temCausasIshikawa = ishi => CATS_ESPINHA.some(([k]) => (ishi?.causes?.[k] || []).some(c => String(c || "").trim()));

/**
 * Layout do desenho. Devolve { largura, altura, elementos }, cada elemento
 * { tag, attrs, texto?, papel, filhos?, causa? }. `papel` diz que cor usar; os grupos
 * de causa (`tag: "g"`) trazem `causa` para a tela poder marcá-la.
 */
export function layoutEspinha({ efeito, causes, whyCausa } = {}, mede = medidaAproximada) {
  const { W, H, Y, X0, XH, COLS, DX, YTOP, YBOT, FONTE, LH } = G;
  const els = [];
  const add = (tag, attrs, papel, texto) => { const e = { tag, attrs, papel }; if (texto != null) e.texto = texto; els.push(e); return e; };

  // cauda, espinha e cabeça
  add("path", { d: `M${X0} ${Y} L${X0 - 26} ${Y - 26} L${X0 - 18} ${Y} L${X0 - 26} ${Y + 26} Z` }, "osso-preenchido");
  add("line", { x1: X0, y1: Y, x2: XH, y2: Y, "stroke-width": 5, "stroke-linecap": "round" }, "osso");
  const HW = 200, HH = 150;
  add("path", { d: `M${XH} ${Y - HH / 2} C${XH + HW * 0.75} ${Y - HH / 2}, ${XH + HW} ${Y - 30}, ${XH + HW} ${Y} C${XH + HW} ${Y + 30}, ${XH + HW * 0.75} ${Y + HH / 2}, ${XH} ${Y + HH / 2} Z`, "stroke-width": 2.5 }, "cabeca");
  add("text", { x: XH + 92, y: Y - 40, "text-anchor": "middle", "font-size": 10, "font-weight": 700, "letter-spacing": 1 }, "apagado", "EFEITO");
  const lEf = quebrarTexto(efeito || "—", 150, mede, 700, 14, 3);
  lEf.forEach((l, i) => add("text", { x: XH + 92, y: Y + 5 - (lEf.length - 1) * 9 + i * 18, "text-anchor": "middle", "font-size": 14, "font-weight": 700 }, "texto", l));

  CATS_ESPINHA.forEach(([k, label], i) => {
    const cima = i < 3, xEnd = COLS[i % 3], yOut = cima ? YTOP : YBOT, xOut = xEnd - DX;
    const xAt = y => xOut + (xEnd - xOut) * (y - yOut) / (Y - yOut);
    const causas = (causes?.[k] || []).map(c => String(c || "").trim()).filter(Boolean);
    const vazio = !causas.length;
    add("line", { x1: xOut, y1: yOut, x2: xEnd, y2: Y, "stroke-width": 3, "stroke-linecap": "round" }, "osso");
    // rótulo da categoria na ponta do osso, com o total
    const txt = label.toUpperCase(), tw = mede(txt, 700, 12) + 44, by = cima ? yOut - 40 : yOut + 8;
    add("rect", { x: xOut - tw / 2, y: by, width: tw, height: 30, rx: 15, "stroke-width": 1.5 }, vazio ? "rotulo-vazio" : "rotulo");
    add("text", { x: xOut - 10, y: by + 19.5, "text-anchor": "middle", "font-size": 12, "font-weight": 700, "letter-spacing": 0.6 }, vazio ? "rotulo-texto-vazio" : "rotulo-texto", txt);
    add("text", { x: xOut + tw / 2 - 16, y: by + 19.5, "text-anchor": "middle", "font-size": 11, "font-weight": 700 }, vazio ? "apagado" : "rotulo-texto", String(causas.length));

    // posições fixas ao longo do osso, da ponta para a espinha, na ordem de inclusão.
    // O texto fica do lado do ramo em que o osso se afasta: abaixo nos ossos de cima,
    // acima nos de baixo — senão o osso inclinado passa por cima das letras.
    const yIni = cima ? yOut + 22 : yOut - 22, yFim = cima ? Y - 50 : Y + 50;
    const passo = (yFim - yIni) / (MAX_POR_OSSO - 1);
    if (vazio) {
      const ym = (yIni + yFim) / 2;
      add("text", { x: xAt(ym) - 12, y: ym + 4, "text-anchor": "end", "font-size": 11, "font-style": "italic" }, "apagado", "nenhuma causa");
      return;
    }
    const lista = causas.length > MAX_POR_OSSO ? [...causas.slice(0, MAX_POR_OSSO - 1), { mais: causas.length - (MAX_POR_OSSO - 1) }] : causas;
    lista.forEach((cz, j) => {
      const y = yIni + passo * j, px = xAt(y);
      const limite = i % 3 === 0 ? X0 + 6 : px - (COLS[1] - COLS[0]) + 14; // osso vizinho na mesma altura
      const larg = Math.min(px - 14 - limite, 230);
      if (typeof cz === "object") {
        add("line", { x1: px - 70, y1: y, x2: px, y2: y, "stroke-width": 1.2, "stroke-dasharray": "3 3" }, "ramo");
        add("text", { x: px - 10, y: cima ? y + 15 : y - 5, "text-anchor": "end", "font-size": 11, "font-style": "italic" }, "apagado", `+${cz.mais} na lista`);
        return;
      }
      const sel = !!whyCausa && whyCausa.trim() === cz;
      const peso = sel ? 700 : 500;
      const linhas = quebrarTexto(cz, larg, mede, peso, FONTE, 2);
      const largTexto = Math.max(...linhas.map(l => mede(l, peso, FONTE)));
      const x1 = px - largTexto - 18;
      const yLinha = li => (cima ? y + 15 + li * LH : y - 6 - (linhas.length - 1 - li) * LH);
      const topo = cima ? y - 4 : y - 6 - linhas.length * LH, base = cima ? y + 8 + linhas.length * LH : y + 4;
      const filhos = [
        { tag: "rect", attrs: { x: x1 - 6, y: topo - 2, width: px - x1 + 6, height: base - topo + 2, rx: 6 }, papel: sel ? "fundo-sel" : "fundo" },
        { tag: "line", attrs: { x1, y1: y, x2: px, y2: y, "stroke-width": sel ? 2.2 : 1.4, "stroke-linecap": "round" }, papel: sel ? "ramo-sel" : "ramo" },
        { tag: "circle", attrs: { cx: px, cy: y, r: sel ? 4.5 : 3.2 }, papel: sel ? "ponto-sel" : "ponto" },
        ...linhas.map((l, li) => ({ tag: "text", attrs: { x: px - 10, y: yLinha(li), "text-anchor": "end", "font-size": FONTE, "font-weight": peso }, papel: sel ? "texto-sel" : "texto", texto: l })),
      ];
      els.push({ tag: "g", attrs: {}, papel: "causa", causa: cz, categoria: label, marcada: sel, filhos });
    });
  });
  return { largura: W, altura: H, elementos: els };
}

/** Atributos de cor (fill/stroke) de cada papel. `c` = paleta já resolvida. */
export function pintura(papel, c) {
  switch (papel) {
    case "osso": return { stroke: c.osso };
    case "osso-preenchido": return { fill: c.osso };
    case "cabeca": return { fill: c.cabecaFundo, stroke: c.osso };
    case "texto": return { fill: c.texto };
    case "apagado": return { fill: c.apagado };
    case "rotulo": return { fill: c.destaque, stroke: c.destaque };
    case "rotulo-vazio": return { fill: c.fundo, stroke: c.destaque };
    case "rotulo-texto": return { fill: c.sobreDestaque };
    case "rotulo-texto-vazio": return { fill: c.destaque };
    case "ramo": return { stroke: c.ramo, fill: "none" };
    case "ramo-sel": return { stroke: c.sel, fill: "none" };
    case "ponto": return { fill: c.osso };
    case "ponto-sel": return { fill: c.sel };
    case "texto-sel": return { fill: c.sel };
    case "fundo": return { fill: "transparent" };
    case "fundo-sel": return { fill: c.selFundo };
    default: return {};
  }
}

/** Paleta clara do PDF — o mesmo verde da faixa do buildPDFShell. */
export const CORES_PDF = { osso: "#2f6b47", cabecaFundo: "#e3eee5", texto: "#1d2a22", apagado: "#6b7c70", destaque: "#1a4a2e", sobreDestaque: "#ffffff", fundo: "#ffffff", ramo: "#9fb5a6", sel: "#c4572a", selFundo: "#fbe9df" };

const escXml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrsXml = a => Object.entries(a).map(([k, v]) => `${k}="${escXml(v)}"`).join(" ");
const elXml = (e, c) => e.tag === "g"
  ? `<g>${e.filhos.map(f => elXml(f, c)).join("")}<title>${escXml(e.causa)}</title></g>`
  : `<${e.tag} ${attrsXml({ ...e.attrs, ...pintura(e.papel, c) })}${e.texto != null ? `>${escXml(e.texto)}</${e.tag}>` : "/>"}`;

/** SVG em texto, para o PDF da RNC. Vazio quando não há causa levantada. */
export function espinhaSvg(ishi, cores = CORES_PDF, mede = medidaAproximada) {
  if (!temCausasIshikawa(ishi)) return "";
  const { largura, altura, elementos } = layoutEspinha(ishi, mede);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="100%" style="font-family:Arial,Helvetica,sans-serif" role="img" aria-label="Diagrama de Ishikawa">${elementos.map(e => elXml(e, cores)).join("")}</svg>`;
}
