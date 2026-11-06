// Preenche a vigência das versões arquivadas ANTES da v3.26.1.
//
// A capa (historicoCapa.js) mostra em cada linha a data de aprovação/vigência da
// versão, lida de `vigenciaVersao` na entrada do histórico. Só as revisões abertas
// a partir da v3.26.1 gravam esse campo; nas antigas a capa cai no `data`, que é a
// última alteração da versão antes de abrirem a revisão seguinte.
//
// A vigência não se perdeu: está no log de auditoria. Cada versão aprovada tem um
// "Assinou como Aprovador" (com `dataVigencia` desde a Fase 8) entre a "Nova Revisão"
// que a criou e a "Nova Revisão" que a substituiu. Esta regra só LÊ e devolve o que
// gravar; quem grava é o script preencherVigenciaHistorico.js.

const APROVADO = new Set(["Vigente", "Aguardando Vigência", "Obsoleto"]);
const PREFIXO_NOVA = "Nova Revisão — Rev.";
const PREFIXO_APROV = "Assinou como Aprovador";

function parseJson(v) {
  if (v && typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

// Data (AAAA-MM-DD) no fuso de Brasília — o dia em que a pessoa assinou.
function diaBrasilia(ts) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(Number(ts)));
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function vigenciasParaPreencher(doc, auditoria) {
  const historico = Array.isArray(doc?.historicoRevisoes) ? doc.historicoRevisoes : [];
  const aud = (auditoria || [])
    .filter((a) => a && String(a.docId) === String(doc?.id) && Number(a.ts))
    .sort((a, b) => Number(a.ts) - Number(b.ts));
  const novas = aud.filter((a) => String(a.acao || "").startsWith(PREFIXO_NOVA))
    .map((a) => ({ ts: Number(a.ts), alvo: String(a.acao).slice(PREFIXO_NOVA.length).trim() }));
  const aprovacoes = aud.filter((a) => String(a.acao || "").startsWith(PREFIXO_APROV));

  const preencher = [];
  const pulados = [];

  historico.forEach((h, idx) => {
    if (h.vigenciaVersao) return; // já gravado (revisão aberta na v3.26.1+ ou script já rodou)
    const versao = String(h.versao ?? "");
    if (h.status && !APROVADO.has(h.status)) {
      pulados.push({ idx, versao, motivo: `versão arquivada em "${h.status}", nunca foi aprovada` });
      return;
    }
    const alvo = String(h.versaoAlvo || "");
    const fim = novas.find((n) => n.alvo === alvo);
    if (!fim) {
      pulados.push({ idx, versao, motivo: `sem "Nova Revisão — Rev.${alvo || "?"}" na auditoria` });
      return;
    }
    // Início: a nova revisão que criou esta versão (a última antes do fim). Versão inicial: desde sempre.
    const inicio = [...novas].reverse().find((n) => n.alvo === versao && n.ts < fim.ts);
    const desde = inicio ? inicio.ts : 0;
    const aprov = [...aprovacoes].reverse().find((a) => Number(a.ts) > desde && Number(a.ts) < fim.ts);
    if (!aprov) {
      pulados.push({ idx, versao, motivo: "sem assinatura do Aprovador registrada na auditoria para esta versão" });
      return;
    }
    const depois = parseJson(aprov.dadosDepois) || {};
    const dv = /^\d{4}-\d{2}-\d{2}/.test(String(depois.dataVigencia || "")) ? String(depois.dataVigencia).slice(0, 10) : null;
    const assinadoEm = diaBrasilia(aprov.ts).split("-").reverse().join("/");
    preencher.push({
      idx,
      versao,
      vigencia: dv || diaBrasilia(aprov.ts),
      fonte: dv
        ? `data de vigência registrada na aprovação de ${assinadoEm}`
        : `data da assinatura do Aprovador (${assinadoEm}), sem data de vigência registrada`,
    });
  });

  return { preencher, pulados };
}

// Documento com as vigências aplicadas. Não altera nenhum outro campo da entrada.
function aplicarVigencias(doc, preencher, quando) {
  const historico = [...(doc.historicoRevisoes || [])];
  preencher.forEach(({ idx, vigencia, fonte }) => {
    historico[idx] = {
      ...historico[idx],
      vigenciaVersao: vigencia,
      vigenciaVersaoOrigem: `Preenchida pelo sistema em ${quando} a partir do log de auditoria (${fonte}).`,
    };
  });
  return { ...doc, historicoRevisoes: historico };
}

module.exports = { vigenciasParaPreencher, aplicarVigencias, diaBrasilia };
