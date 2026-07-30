/**
 * Gera `src/services/lexico.generated.js` a partir do dicionário hunspell pt-BR
 * (devDependency `dictionary-pt-br`, licença LGPLv3/MPL — projeto VERO).
 *
 * Por que existe: a autocorreção por distância de edição precisa de duas listas.
 *   ALVOS      — as palavras para as quais podemos corrigir (vocabulário do SGQ).
 *   PROTEGIDAS — palavras que EXISTEM em português e estão a distância 1 de algum
 *                alvo. São a trava contra falso positivo: sem elas, "produtor"
 *                (palavra legítima) viraria "produto" e adulteraria o registro.
 *
 * O dicionário completo (4,3 MB) fica só aqui, em tempo de build. O arquivo
 * gerado é pequeno e é ele que vai para o bundle. Rode com `npm run lexico`
 * sempre que mexer em ALVOS, e commite a saída.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const AFF = path.join(RAIZ, "node_modules", "dictionary-pt-br", "index.aff");
const DIC = path.join(RAIZ, "node_modules", "dictionary-pt-br", "index.dic");
const SAIDA = path.join(RAIZ, "src", "services", "lexico.generated.js");

// Comprimento mínimo para correção difusa. Em palavras curtas a distância 1
// deixa de ser um erro de digitação e vira outra palavra.
const MIN_ALVO = 5;

// Vocabulário do domínio: o que se escreve em RNC, desvio, CQ, auditoria e
// documentos. Só entra palavra que faça sentido num registro da qualidade —
// cada alvo é uma superfície de correção, então a lista é curada, não genérica.
const ALVOS_BRUTOS = `
  qualidade processo processos procedimento procedimentos produto produtos produção
  fabricação material materiais matéria matérias insumo insumos embalagem embalagens
  rótulo rótulos cartucho cartuchos amostra amostras lotes estoque almoxarifado
  fornecedor fornecedores cliente clientes laboratório setor setores área áreas

  equipamento equipamentos instrumento instrumentos balança temperatura umidade
  pressão validade vencimento armazenamento transporte recebimento expedição
  devolução segregação quarentena liberação reprovação aprovação aprovado aprovada
  reprovado reprovada conforme conformidade

  desvio desvios ocorrência ocorrências reclamação reclamações investigação
  investigações causa análise análises ensaio ensaios resultado resultados
  laudo laudos especificação especificações parâmetro parâmetros método métodos
  metodologia protocolo relatório relatórios registro registros

  documento documentos formulário formulários revisão revisões versão versões
  elaborador revisor aprovador assinatura assinaturas responsável responsáveis
  gerente supervisor operador analista técnico técnica treinamento treinamentos
  capacitação auditoria auditorias auditor inspeção inspeções

  verificação verificações validação validações calibração calibrações manutenção
  preventiva preventivas corretiva corretivas imediata ações contenção correção
  correções prevenção eficácia evidência evidências

  prazo prazos cronograma planejamento execução monitoramento acompanhamento
  indicador indicadores criticidade severidade gravidade urgência tendência
  impacto risco riscos frequência recorrência reincidência

  quantidade unidade unidades volume dosagem concentração aspecto físico física
  química químico microbiológico microbiológica contaminação integridade
  estabilidade higiene limpeza sanitização esterilização rastreabilidade

  identificação classificação descrição descrições justificativa observação
  observações conclusão conclusões recomendação recomendações solicitação
  deliberação decisão reunião reuniões participantes encerramento abertura
  tratamento disposição retrabalho descarte destruição concessão

  notificação comunicação informação informações sistema empresa filial norma
  normas legislação regulamento portaria resolução farmacopeia condição condições
  ambiente ambiental atribuição atribuições competência função funções

  atividade atividades tarefa tarefas etapa etapas fases situação pendente
  pendência pendências concluído concluída realizado realizada verificado
  verificada aplicável necessário necessária possível adequado adequada
  inadequado inadequada incorreto incorreta correto correta

  falha falhas problema problemas defeito defeitos avaria vazamento também
  através durante portanto entretanto mediante referente seguinte seguintes
  anterior posterior específico específica interno interna externo externa
  oficial original cópia cópias anexo anexos arquivo arquivos planilha
  tabela gráfico imagem
`;

const ALVOS = [...new Set(ALVOS_BRUTOS.trim().split(/\s+/))]
  .filter(p => p.length >= MIN_ALVO)
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

const SO_LETRAS = /^[a-zà-öø-ÿ]+$/;

/** Lê os blocos SFX/PFX do .aff com as condições já compiladas em regex. */
const lerAfixos = texto => {
  const regras = new Map();
  for (const linha of texto.split(/\r?\n/)) {
    const partes = linha.trim().split(/\s+/);
    const tipo = partes[0];
    if (tipo !== "SFX" && tipo !== "PFX") continue;

    // Cabeçalho do bloco: "SFX <flag> <Y|N> <quantidade>", onde Y/N diz se o
    // afixo pode ser combinado com um do outro tipo (cross-product do hunspell).
    if (partes.length === 4 && /^[YN]$/.test(partes[2]) && /^\d+$/.test(partes[3])) {
      regras.set(partes[1], { tipo, cruzado: partes[2] === "Y", itens: [] });
      continue;
    }
    const bloco = regras.get(partes[1]);
    if (!bloco || partes.length < 4) continue;

    const strip = partes[2] === "0" ? "" : partes[2];
    const append = (partes[3] === "0" ? "" : partes[3]).split("/")[0];
    const cond = !partes[4] || partes[4] === "." ? null : partes[4];
    bloco.itens.push({
      strip,
      append,
      re: cond ? new RegExp(tipo === "SFX" ? `${cond}$` : `^${cond}`) : null,
    });
  }
  return regras;
};

/** Aplica um bloco de afixos a uma palavra. */
const aplicar = (palavra, bloco) => {
  const saida = [];
  for (const { strip, append, re } of bloco.itens) {
    if (re && !re.test(palavra)) continue;
    if (bloco.tipo === "SFX") {
      if (strip && !palavra.endsWith(strip)) continue;
      saida.push(palavra.slice(0, palavra.length - strip.length) + append);
    } else {
      if (strip && !palavra.startsWith(strip)) continue;
      saida.push(append + palavra.slice(strip.length));
    }
  }
  return saida;
};

/**
 * Aplica as flags de uma entrada do .dic e devolve as formas flexionadas.
 * Inclui o cross-product do hunspell (prefixo + sufixo na mesma palavra), sem o
 * qual boa parte do vocabulário derivado some — "revisão" (re + visão),
 * "reprovado" (re + provado), "incorreto" (in + correto).
 */
const expandir = (base, flags, regras) => {
  const blocos = [];
  for (const flag of flags) {
    const bloco = regras.get(flag);
    if (bloco) blocos.push(bloco);
  }

  const sufixadas = [];
  const sufixadasCruzaveis = [];
  for (const bloco of blocos) {
    if (bloco.tipo !== "SFX") continue;
    const formas = aplicar(base, bloco);
    sufixadas.push(...formas);
    if (bloco.cruzado) sufixadasCruzaveis.push(...formas);
  }

  const formas = [base, ...sufixadas];
  for (const bloco of blocos) {
    if (bloco.tipo !== "PFX") continue;
    formas.push(...aplicar(base, bloco));
    if (!bloco.cruzado) continue;
    for (const sufixada of sufixadasCruzaveis) formas.push(...aplicar(sufixada, bloco));
  }
  return formas;
};

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

const main = () => {
  if (!fs.existsSync(AFF) || !fs.existsSync(DIC)) {
    console.error("dictionary-pt-br não encontrado. Rode `npm install` antes.");
    process.exit(1);
  }

  const regras = lerAfixos(fs.readFileSync(AFF, "utf8"));
  const conjuntoAlvos = new Set(ALVOS);

  // Índice de deleções dos alvos: chave -> alvos que a produzem.
  const indice = new Map();
  for (const alvo of ALVOS) {
    for (const chave of variantes(alvo)) {
      if (!indice.has(chave)) indice.set(chave, []);
      indice.get(chave).push(alvo);
    }
  }

  const protegidas = new Set();
  const alvosAtestados = new Set();
  let formasLidas = 0;

  const linhas = fs.readFileSync(DIC, "utf8").split(/\r?\n/);
  for (let i = 1; i < linhas.length; i += 1) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const [baseBruta, flagsBrutas = ""] = linha.split("/");
    const base = baseBruta.toLocaleLowerCase("pt-BR");
    if (!base) continue;

    for (const forma of expandir(base, Array.from(flagsBrutas), regras)) {
      formasLidas += 1;
      if (!SO_LETRAS.test(forma)) continue;
      if (conjuntoAlvos.has(forma)) { alvosAtestados.add(forma); continue; }
      if (forma.length < MIN_ALVO - 1) continue;

      for (const chave of variantes(forma)) {
        const candidatos = indice.get(chave);
        if (candidatos && candidatos.some(alvo => distanciaAte1(forma, alvo))) {
          protegidas.add(forma);
          break;
        }
      }
    }
  }

  const naoAtestados = ALVOS.filter(a => !alvosAtestados.has(a));
  const lista = itens => itens.map(p => `  "${p}",`).join("\n");
  const conteudo = `// GERADO POR scripts/genLexico.js — não editar à mão.
// Fonte: dictionary-pt-br (projeto VERO, LGPLv3/MPL).
// Para regerar: npm run lexico

/** Palavras do domínio para as quais a autocorreção pode corrigir. */
export const ALVOS = [
${lista(ALVOS)}
];

/** Palavras reais a distância 1 de algum alvo — nunca podem ser corrigidas. */
export const PROTEGIDAS = [
${lista([...protegidas].sort((a, b) => a.localeCompare(b, "pt-BR")))}
];
`;

  fs.writeFileSync(SAIDA, conteudo, "utf8");

  console.log(`formas analisadas : ${formasLidas.toLocaleString("pt-BR")}`);
  console.log(`alvos             : ${ALVOS.length}`);
  console.log(`protegidas        : ${protegidas.size}`);
  console.log(`saída             : ${Math.round(Buffer.byteLength(conteudo) / 1024)} KB`);
  if (naoAtestados.length) {
    console.log(`\nAVISO — alvos ausentes do dicionário (revise a grafia):\n  ${naoAtestados.join(", ")}`);
  }
};

main();
