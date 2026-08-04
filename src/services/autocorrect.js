import { isDescriptiveTextField, upperFirstLetter } from "../core/utils";
import { ALVOS, PROTEGIDAS } from "./lexico.generated";

// Somente trocas de alta confiança. Evitamos palavras dependentes de contexto
// (por exemplo: esta/está, tem/têm) para não alterar o sentido do registro.
const SAFE_CORRECTIONS = Object.freeze({
  nao: "não",
  acao: "ação",
  acoes: "ações",
  analise: "análise",
  analises: "análises",
  analize: "análise",
  analizes: "análises",
  aprovacao: "aprovação",
  aprovadoa: "aprovada",
  aprovdo: "aprovado",
  armazenameto: "armazenamento",
  atribuicao: "atribuição",
  atribuicoes: "atribuições",
  avaliacao: "avaliação",
  avaliacoes: "avaliações",
  calibracao: "calibração",
  classificacao: "classificação",
  condicao: "condição",
  condicoes: "condições",
  conclusao: "conclusão",
  conclusoes: "conclusões",
  contencao: "contenção",
  correcao: "correção",
  correcoes: "correções",
  descricao: "descrição",
  descricoes: "descrições",
  documentacao: "documentação",
  documentcao: "documentação",
  eficacia: "eficácia",
  embalagemm: "embalagem",
  embalgem: "embalagem",
  equipamentoo: "equipamento",
  equipameto: "equipamento",
  especificacao: "especificação",
  especificacoes: "especificações",
  evidencia: "evidência",
  evidencias: "evidências",
  excessao: "exceção",
  excessoes: "exceções",
  fabricacao: "fabricação",
  fisico: "físico",
  forncedor: "fornecedor",
  fornecdor: "fornecedor",
  identificacao: "identificação",
  informacao: "informação",
  informacoes: "informações",
  inspecao: "inspeção",
  investigacao: "investigação",
  liberacao: "liberação",
  manutencao: "manutenção",
  materail: "material",
  materia: "matéria",
  materias: "matérias",
  metodo: "método",
  metodos: "métodos",
  microbiologico: "microbiológico",
  necessario: "necessário",
  necessaria: "necessária",
  observacao: "observação",
  observacoes: "observações",
  ocorrencia: "ocorrência",
  ocorrencias: "ocorrências",
  ocorencia: "ocorrência",
  ocorencias: "ocorrências",
  parametro: "parâmetro",
  parametros: "parâmetros",
  possivel: "possível",
  prevencao: "prevenção",
  procedimentoo: "procedimento",
  procedimeto: "procedimento",
  producao: "produção",
  prodto: "produto",
  prouto: "produto",
  poduto: "produto",
  qualdade: "qualidade",
  qualdiade: "qualidade",
  quantidde: "quantidade",
  quimico: "químico",
  recepcao: "recepção",
  recebimeto: "recebimento",
  reprovacao: "reprovação",
  responsavel: "responsável",
  responsaveis: "responsáveis",
  resposavel: "responsável",
  retencao: "retenção",
  revisao: "revisão",
  solicitacao: "solicitação",
  tambem: "também",
  temperatura: "temperatura",
  temperatua: "temperatura",
  validacao: "validação",
  verificacao: "verificação",
});

const WORD_END = /([A-Za-zÀ-ÖØ-öø-ÿĀ-ž]{3,})$/;
const COMPLETION_CHAR = /[\s.,;:!?()[\]{}"“”'’/\-]/;
const LETTER_ONLY = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+$/;
const flashTimers = new WeakMap();
const correctionHistory = new WeakMap();

const preserveCase = (source, correction) => {
  if (source === source.toLocaleUpperCase("pt-BR")) {
    return correction.toLocaleUpperCase("pt-BR");
  }
  if (source[0] === source[0].toLocaleUpperCase("pt-BR")) {
    return correction[0].toLocaleUpperCase("pt-BR") + correction.slice(1);
  }
  return correction;
};

// Abaixo deste comprimento, distância 1 deixa de ser erro de digitação e vira
// outra palavra ("esta"/"está", "lote"/"love"). Palavras curtas ficam a cargo
// exclusivo de SAFE_CORRECTIONS.
const MIN_DIFUSA = 5;

const ALVOS_SET = new Set(ALVOS);
const PROTEGIDAS_SET = new Set(PROTEGIDAS);

/** A própria palavra mais cada variante com um caractere removido. */
const variantes = palavra => {
  const saida = [palavra];
  for (let i = 0; i < palavra.length; i += 1) saida.push(palavra.slice(0, i) + palavra.slice(i + 1));
  return saida;
};

/** Distância de edição ≤ 1, contando transposição de adjacentes (Damerau). */
const distanciaAte1 = (a, b) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    let dif = -1;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] === b[i]) continue;
      if (dif >= 0) {
        return dif === i - 1 && a[dif] === b[i] && a[i] === b[dif] && a.slice(i + 1) === b.slice(i + 1);
      }
      dif = i;
    }
    return true;
  }

  const [curta, longa] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < curta.length && curta[i] === longa[i]) i += 1;
  return curta.slice(i) === longa.slice(i + 1);
};

// Índice de deleções (SymSpell): cada alvo entra indexado por si mesmo e por
// cada variante com um caractere a menos. Duas palavras a distância 1 sempre
// compartilham ao menos uma dessas chaves, então achar candidatos vira lookup
// de hash em vez de comparar o que foi digitado com todo o vocabulário.
const INDICE = new Map();
for (const alvo of ALVOS) {
  for (const chave of variantes(alvo)) {
    const atual = INDICE.get(chave);
    if (atual) atual.push(alvo);
    else INDICE.set(chave, [alvo]);
  }
}

/**
 * Correção por distância de edição, restrita ao vocabulário do SGQ.
 * Três travas contra falso positivo, nesta ordem:
 *   1. palavra que já é um alvo    — está certa, não se mexe;
 *   2. palavra listada em PROTEGIDAS — existe em português ("produtor"), não se mexe;
 *   3. candidato tem de ser único   — havendo empate, não há como saber a intenção.
 */
export const getFuzzyCorrection = word => {
  const alvo = word.toLocaleLowerCase("pt-BR");
  if (alvo.length < MIN_DIFUSA || ALVOS_SET.has(alvo) || PROTEGIDAS_SET.has(alvo)) return null;

  const candidatos = new Set();
  for (const chave of variantes(alvo)) {
    const encontrados = INDICE.get(chave);
    if (!encontrados) continue;
    for (const candidato of encontrados) {
      if (distanciaAte1(alvo, candidato)) candidatos.add(candidato);
    }
  }

  if (candidatos.size !== 1) return null;
  return preserveCase(word, [...candidatos][0]);
};

export const isAutocorrectField = element => {
  if (!element) return false;
  if (element.dataset?.autocorrect === "off") return false;
  if (element.dataset?.autocorrect === "on") return true;
  return isDescriptiveTextField(element);
};

export const getAutocorrection = word => {
  if (!word || !LETTER_ONLY.test(word)) return null;
  const correction = SAFE_CORRECTIONS[word.toLocaleLowerCase("pt-BR")];
  // A tabela manual tem precedência: são trocas conferidas uma a uma, que devem
  // ganhar do algoritmo. O difuso cobre o resto — os erros que ninguém previu.
  return correction ? preserveCase(word, correction) : getFuzzyCorrection(word);
};

export const autocorrectCompletedWord = (value, cursor) => {
  if (!value || !cursor || !COMPLETION_CHAR.test(value[cursor - 1])) return null;
  const beforeDelimiter = value.slice(0, cursor - 1);
  const match = beforeDelimiter.match(WORD_END);
  if (!match) return null;

  const original = match[1];
  const correction = getAutocorrection(original);
  if (!correction || correction === original) return null;

  const start = cursor - 1 - original.length;
  const nextValue = value.slice(0, start) + correction + value.slice(cursor - 1);
  return {
    value: nextValue,
    cursor: cursor + correction.length - original.length,
    original,
    correction,
  };
};

const setNativeValue = (element, value) => {
  const prototype = element.tagName === "TEXTAREA"
    ? globalThis.HTMLTextAreaElement?.prototype
    : globalThis.HTMLInputElement?.prototype;
  const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
};

const capitalizeWithNativeValue = element => {
  if (!isDescriptiveTextField(element)) return;
  const normalized = upperFirstLetter(element.value);
  if (normalized !== element.value) setNativeValue(element, normalized);
};

const announceCorrection = (element, detail) => {
  element.dataset.autocorrected = "true";
  clearTimeout(flashTimers.get(element));
  flashTimers.set(element, setTimeout(() => {
    delete element.dataset.autocorrected;
    flashTimers.delete(element);
  }, 900));

  if (globalThis.window && globalThis.CustomEvent) {
    window.dispatchEvent(new CustomEvent("sgq:autocorrect", { detail }));
  }
};

export const prepareAutocorrectField = event => {
  const element = event?.target;
  if (!isAutocorrectField(element)) return;
  element.lang = "pt-BR";
  element.spellcheck = true;
};

export const handleWritingInput = event => {
  const element = event?.target;
  if (!isAutocorrectField(element)) {
    capitalizeWithNativeValue(element);
    return;
  }
  if (event.nativeEvent?.isComposing || event.isComposing || element.dataset?.autocorrectUndo === "true") {
    delete element.dataset.autocorrectUndo;
    return;
  }

  const before = element.value;
  const cursor = element.selectionStart;
  const result = autocorrectCompletedWord(before, cursor);
  if (!result) {
    capitalizeWithNativeValue(element);
    return;
  }

  setNativeValue(element, result.value);
  element.setSelectionRange?.(result.cursor, result.cursor);
  capitalizeWithNativeValue(element);
  correctionHistory.set(element, { before, after: element.value, cursor });
  announceCorrection(element, { original: result.original, correction: result.correction });
};

export const handleAutocorrectUndo = event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key?.toLowerCase() !== "z") return;
  const element = event.target;
  const history = correctionHistory.get(element);
  if (!history || element.value !== history.after) return;

  event.preventDefault();
  correctionHistory.delete(element);
  element.dataset.autocorrectUndo = "true";
  setNativeValue(element, history.before);
  element.setSelectionRange?.(history.cursor, history.cursor);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};