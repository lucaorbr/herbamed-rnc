const crypto = require("crypto");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const EMPTY_VALUES = new Set(["", "n/a", "na", "não se aplica", "nao se aplica", "-"]);

const STOP_WORDS = new Set(`
  a ao aos aquela aquelas aquele aqueles aquilo as até com como da das de dela delas dele deles
  depois do dos e ela elas ele eles em entre era eram essa essas esse esses esta estas este estes
  foi foram há isso isto já lhe lhes mais mas me mesmo meu minha muito na nas nem no nos nós o os
  ou para pela pelas pelo pelos por qual quando que quem se sem ser seu sua suas seus só também tem
  tendo ter um uma umas uns vai são não deve devem cada onde conforme mediante através sobre durante
`.trim().split(/\s+/));

const SECTION_HEADINGS = [
  "objetivo", "finalidade", "escopo", "alcance", "aplicação", "aplicacao",
  "responsabilidades", "responsabilidade", "definições", "definicoes",
  "procedimento", "descrição do procedimento", "descricao do procedimento",
  "informações complementares", "informacoes complementares", "referências", "referencias",
  "registros", "anexos", "materiais", "equipamentos",
];

function decodeEntities(value) {
  const named = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    atilde: "ã", otilde: "õ", ccedil: "ç", acirc: "â", ecirc: "ê", ocirc: "ô",
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const code = parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] || " ";
  });
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " "));

  return text
    .replace(/\r/g, "")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isUseful(value) {
  const text = cleanText(value);
  return text.length > 2 && !EMPTY_VALUES.has(text.toLowerCase());
}

function normalizeForMatch(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isDocumentNoise(value) {
  const normalized = normalizeForMatch(value);
  return !normalized
    || /^(copia nao controlada|rascunho - sem valor)$/.test(normalized)
    || /^(codigo do formulario|titulo do formulario\/documento)$/.test(normalized)
    || /^pop-[a-z0-9-]+.*pagina \d+ de \d+$/.test(normalized)
    || /^(copia nao controlada|rascunho - sem valor).*pagina \d+ de \d+$/.test(normalized);
}

function removePdfNoise(value) {
  const lines = cleanText(value).split(/\n/).map(line => line.trim());
  const counts = new Map();
  lines.forEach(line => {
    const key = normalizeForMatch(line);
    if (key && line.length <= 140) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return lines.filter(line => {
    if (!line) return true;
    if (isDocumentNoise(line)) return false;
    const key = normalizeForMatch(line);
    return !(line.length <= 140 && (counts.get(key) || 0) >= 3);
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function flattenSection(value) {
  return cleanText(value).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function splitSentences(value) {
  const text = cleanText(value);
  if (!text) return [];
  return text
    .split(/\n+|(?<=[.!?;:])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/u)
    .flatMap(part => part.length > 500 ? part.split(/(?<=[.;])\s+/) : [part])
    .map(part => part.replace(/^\s*(?:[-•▪◦]|\d+(?:\.\d+)*[.)-]?)\s*/, "").trim())
    .filter(part => part.length >= 12 && !isDocumentNoise(part));
}

function uniqueSentences(sentences) {
  const seen = new Set();
  return sentences.filter(sentence => {
    const key = normalizeForMatch(sentence).replace(/\W/g, "").slice(0, 180);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function wordFrequencies(text) {
  const counts = new Map();
  const words = normalizeForMatch(text).match(/[a-z0-9]{3,}/g) || [];
  words.forEach(word => {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  });
  return counts;
}

function shorten(value, maxChars = 420) {
  const text = cleanText(value);
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars + 1);
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("; "), clipped.lastIndexOf(" "));
  return `${clipped.slice(0, boundary > maxChars * 0.6 ? boundary + 1 : maxChars).trim()}…`;
}

function selectSentences(value, limit = 3, maxChars = 900, preferredTerms = []) {
  const sentences = uniqueSentences(splitSentences(value));
  if (sentences.length <= limit) return sentences.map(sentence => shorten(sentence, Math.floor(maxChars / Math.max(1, sentences.length))));

  const frequencies = wordFrequencies(value);
  const preferred = preferredTerms.map(normalizeForMatch);
  const ranked = sentences.map((sentence, index) => {
    const words = normalizeForMatch(sentence).match(/[a-z0-9]{3,}/g) || [];
    const meaningful = words.filter(word => !STOP_WORDS.has(word));
    const frequencyScore = meaningful.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(1, meaningful.length);
    const preferredScore = preferred.some(term => term && normalizeForMatch(sentence).includes(term)) ? 4 : 0;
    const positionScore = index < 3 ? 1.5 - (index * 0.35) : 0;
    const lengthScore = sentence.length >= 35 && sentence.length <= 300 ? 1 : 0;
    return { sentence, index, score: frequencyScore + preferredScore + positionScore + lengthScore };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map(item => shorten(item.sentence, Math.floor(maxChars / limit)));
}

function headingPattern(requireNumber = false) {
  const labels = SECTION_HEADINGS
    .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const number = requireNumber
    ? `\\d+(?:\\.\\d+)*[.\\s):-]*`
    : `(?:\\d+(?:\\.\\d+)*[.\\s):-]*)?`;
  return new RegExp(`(?:^|\\n)\\s*${number}(${labels})\\s*:?[ \\t]*(?:\\n|$)`, "giu");
}

function extractSection(fullText, labels) {
  const text = cleanText(fullText);
  if (!text) return "";
  const normalizedLabels = labels.map(normalizeForMatch);
  let matches = [...text.matchAll(headingPattern(true))];
  let selectedIndex = matches.findIndex(match => normalizedLabels.includes(normalizeForMatch(match[1])));
  if (selectedIndex < 0) {
    matches = [...text.matchAll(headingPattern(false))];
    selectedIndex = matches.findIndex(match => normalizedLabels.includes(normalizeForMatch(match[1])));
  }
  if (selectedIndex < 0) return "";
  const start = matches[selectedIndex].index + matches[selectedIndex][0].length;
  const end = matches[selectedIndex + 1]?.index ?? text.length;
  return cleanText(text.slice(start, end));
}

function sectionOrFile(docValue, fileText, labels) {
  if (isUseful(docValue)) return cleanText(docValue);
  return extractSection(fileText, labels);
}

function keywordSentences(text, terms, limit = 6) {
  const normalizedTerms = terms.map(normalizeForMatch);
  const matches = uniqueSentences(splitSentences(text)).filter(sentence => {
    const normalized = normalizeForMatch(sentence);
    return normalizedTerms.some(term => normalized.includes(term));
  });
  return matches.slice(0, limit).map(sentence => shorten(sentence, 300));
}

function normalizeSteps(items, limit = 8) {
  return uniqueSentences(items.flatMap(item => splitSentences(item)))
    .filter(item => !isDocumentNoise(item))
    .slice(0, limit)
    .map(step => shorten(step, 320));
}

function extractResponsibilityItems(value, limit = 6) {
  const lines = cleanText(value).split(/\n/).map(line => line.trim()).filter(Boolean);
  const groups = [];
  let current = null;
  let currentChild = null;

  for (const line of lines) {
    const top = line.match(/^3\.(\d+)(?!\.)\s+(.+)$/);
    const child = line.match(/^3\.\d+\.\d+(?:\.\d+)*\s+(.+)$/);
    if (top) {
      current = { label: "", parts: [] };
      groups.push(current);
      currentChild = null;
      const content = top[2].trim();
      const colon = content.indexOf(":");
      if (colon >= 0) {
        current.label = content.slice(0, colon + 1);
        const rest = content.slice(colon + 1).trim();
        if (rest) current.parts.push(rest);
      } else {
        current.label = content;
      }
      continue;
    }
    if (child && current) {
      currentChild = child[1].trim();
      current.parts.push(currentChild);
      continue;
    }
    if (current && line && !/^\d+(?:\.\d+)+\s+/.test(line)) {
      if (current.parts.length) current.parts[current.parts.length - 1] += ` ${line}`;
      else current.label += ` ${line}`;
    }
  }

  return groups.slice(0, limit).map(group => {
    const details = group.parts.slice(0, 3).join(" ");
    return shorten(`${group.label} ${details}`.trim(), 420);
  }).filter(isUseful);
}

function extractProcedureOutline(value, limit = 8) {
  const lines = cleanText(value).split(/\n/).map(line => line.trim()).filter(Boolean);
  const topLevel = [];
  const seen = new Set();
  for (const line of lines) {
    const match = line.match(/^5\.(\d+)(?!\.)\s+(.+)$/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    topLevel.push(shorten(match[2], 320));
  }
  if (topLevel.length >= 2) return topLevel.slice(0, limit);

  const detailed = [];
  for (const line of lines) {
    const match = line.match(/^5\.\d+\.\d+(?:\.\d+)*\s+(.+)$/);
    if (match && !isDocumentNoise(match[1])) detailed.push(shorten(match[1], 320));
    if (detailed.length >= limit) break;
  }
  return detailed.length ? detailed : normalizeSteps(selectSentences(value, limit, 2_400, ["deve", "realizar", "verificar", "registrar"]));
}

function buildDocumentSourceHash(doc, fileHashes = []) {
  const relevant = {
    id: doc?.id,
    versao: doc?.versao,
    titulo: doc?.titulo,
    objetivo: doc?.objetivo,
    alcance: doc?.alcance,
    responsabilidades: doc?.responsabilidades,
    definicoes: doc?.definicoes,
    procedimento: doc?.procedimento,
    infComplementares: doc?.infComplementares,
    referencias: doc?.referencias,
    registros: doc?.registros,
    anexos: doc?.anexos,
    etapas: doc?.etapas,
    materiais: doc?.materiais,
    fileHashes,
  };
  return crypto.createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

async function extractTextFromStoredFile(file, options = {}) {
  if (!file?.data?.length) return { text: "", warning: "Arquivo vazio." };
  const maxFileBytes = Number(options.maxFileBytes || 25 * 1024 * 1024);
  const maxTextChars = Number(options.maxTextChars || 180_000);
  if (file.data.length > maxFileBytes) {
    return { text: "", warning: "Arquivo acima do limite de leitura automática; foram usados apenas os campos cadastrados." };
  }

  const name = String(file.original_name || "").toLowerCase();
  const type = String(file.mime_type || "").toLowerCase();
  try {
    if (type.includes("pdf") || name.endsWith(".pdf")) {
      const parsed = await pdfParse(file.data, { max: Number(options.maxPages || 80) });
      const text = removePdfNoise(parsed.text).slice(0, maxTextChars);
      return text.length >= 80
        ? { text, source: "PDF oficial" }
        : { text, warning: "O PDF parece ser uma imagem digitalizada e não possui texto pesquisável." };
    }
    if (type.includes("wordprocessingml") || name.endsWith(".docx")) {
      const parsed = await mammoth.extractRawText({ buffer: file.data });
      const text = cleanText(parsed.value).slice(0, maxTextChars);
      return text ? { text, source: "arquivo Word" } : { text: "", warning: "Não foi possível encontrar texto no arquivo Word." };
    }
    return { text: "", warning: "Este formato não permite leitura automática. Use PDF pesquisável ou Word (.docx)." };
  } catch (error) {
    return { text: "", warning: `Não foi possível ler o arquivo anexado: ${error.message}` };
  }
}

function createLocalSummary(doc, fileText = "", metadata = {}) {
  const objetivo = flattenSection(sectionOrFile(doc.objetivo, fileText, ["objetivo", "finalidade"]));
  const alcance = flattenSection(sectionOrFile(doc.alcance, fileText, ["alcance", "escopo", "aplicação", "aplicacao"]));
  const responsabilidades = sectionOrFile(doc.responsabilidades, fileText, ["responsabilidades", "responsabilidade"]);
  const procedimento = sectionOrFile(doc.procedimento, fileText, ["procedimento", "descrição do procedimento", "descricao do procedimento"]);
  const registros = sectionOrFile(doc.registros, fileText, ["registros"]);
  const anexos = sectionOrFile(doc.anexos, fileText, ["anexos"]);
  const secoesDisponiveis = [
    objetivo, alcance, responsabilidades, procedimento,
    doc.infComplementares, registros, anexos,
  ].filter(isUseful);
  const contextoCompleto = secoesDisponiveis.length
    ? secoesDisponiveis.map(flattenSection).join("\n")
    : flattenSection(fileText);

  const visaoBase = [objetivo, alcance].filter(Boolean).join(" ") || contextoCompleto;
  const visaoGeral = selectSentences(visaoBase, 3, 900).join(" ");
  const aplicacao = selectSentences(alcance, 4, 900, ["aplica", "abrange", "destina"]);
  const responsaveisExtraidos = extractResponsibilityItems(responsabilidades);
  const responsaveis = responsaveisExtraidos.length
    ? responsaveisExtraidos
    : selectSentences(flattenSection(responsabilidades), 6, 1_500, ["responsável", "compete", "deve"]);

  const etapasCadastradas = Array.isArray(doc.etapas)
    ? doc.etapas.flatMap(etapa => [etapa?.titulo, etapa?.descricao].filter(isUseful).join(": "))
    : [];
  const passos = etapasCadastradas.length
    ? normalizeSteps(etapasCadastradas)
    : extractProcedureOutline(procedimento || contextoCompleto);

  const pontosAtencao = keywordSentences(contextoCompleto, [
    "atenção", "atencao", "obrigatório", "obrigatorio", "proibido", "não deve", "nao deve",
    "deve", "risco", "cuidado", "imediatamente", "limite", "epi", "registrar",
  ], 7);

  const registrosGerados = normalizeSteps([
    ...selectSentences(registros, 5, 1_200, ["registro", "formulário", "formulario", "planilha"]),
    ...(isUseful(anexos) ? selectSentences(anexos, 6, 1_200) : []),
  ], 6);

  const materiais = Array.isArray(doc.materiais)
    ? doc.materiais.filter(isUseful).map(cleanText).slice(0, 12)
    : [];

  const hasContent = Boolean(visaoGeral || aplicacao.length || responsaveis.length || passos.length);
  return {
    documentId: String(doc.id || ""),
    codigo: doc.codigo || "",
    versao: doc.versao || "",
    titulo: doc.titulo || "Documento",
    metodo: "resumo-local-extrativo",
    geradoEm: new Date().toISOString(),
    fonte: metadata.source || (fileText ? "arquivo anexado" : "campos cadastrados"),
    avisoExtracao: metadata.warning || "",
    visaoGeral,
    aplicacao,
    responsaveis,
    passos,
    pontosAtencao,
    registros: registrosGerados,
    materiais,
    hasContent,
    disclaimer: "Resumo automático para apoio à leitura. Não substitui o documento oficial vigente, seus anexos ou o treinamento obrigatório.",
  };
}

module.exports = {
  buildDocumentSourceHash,
  cleanText,
  createLocalSummary,
  extractSection,
  extractTextFromStoredFile,
  removePdfNoise,
  selectSentences,
};
