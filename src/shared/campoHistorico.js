// Campo de texto append-only (onda 11) — lógica pura, testável sem montar componente.
//
// PROBLEMA: descrição de RNC/desvio e ação de contenção/imediata eram texto livre
// sobrescrito na edição. O que estava escrito antes sumia; sobrava só um resumo
// "campo: 'velho' → 'novo'" perdido no meio do `historico` genérico. Num SGQ o
// texto original É a evidência — corrigir não pode significar apagar.
//
// ⚠️ DECISÃO DE ARQUITETURA: o campo continua sendo UMA STRING, não vira array.
// Tudo que já lê `rnc.desc` / `desvio.acaoDesc` (PDF, Excel, e-mail, formulário do
// fornecedor, busca da lista, prefill de desvio→RNC, indicadores) segue funcionando
// sem tocar em nada, e nenhum registro precisa de migração. O que muda é só a REGRA
// DE ESCRITA: o texto já gravado é prefixo imutável e a edição só ACRESCENTA no fim,
// carimbada com login, data e hora. Mesma razão do `userId` da Fase 6 e do nome do
// setor na etapa 3 dos catálogos — não se reescreve registro existente.
//
// `blocosDoCampo` só existe para exibir bonito (destacar o carimbo). Se o parse não
// reconhecer o formato, o bloco cai como texto puro — a string é a fonte, o parse é
// cosmético e nunca pode virar requisito de leitura.

// Separador entre blocos. Linha em branco: legível no textarea, no PDF e no Excel.
export const SEP_BLOCO = "\n\n";

// Carimbo no INÍCIO do bloco acrescentado (não no fim): quem lê já sabe na primeira
// palavra que aquilo é acréscimo posterior, sem precisar chegar ao fim do parágrafo.
// O bloco original (o do registro) fica SEM carimbo de propósito — sua autoria já
// está em "Registrado por X em Y" no próprio registro, e carimbá-lo mudaria o texto
// de todo registro novo (incluindo o que sai no PDF) sem acrescentar informação.

const RE_CARIMBO = /^\(([^()·]+?)\s·\s(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2})\)\s?/;

// O "login" pedido é a conta de acesso: a parte local do e-mail. Cai para o nome
// quando não há e-mail (usuário legado/semeado). Função única para ser um lugar só
// de mudar caso um dia se prefira exibir o nome completo.
export function identificacaoUsuario(user) {
  const email = (user?.email || "").trim();
  if (email) return email.split("@")[0];
  return (user?.name || "sistema").trim();
}

function dataHoraBR(quando) {
  const d = quando instanceof Date ? quando : new Date(quando || Date.now());
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${aa} ${hh}:${mi}`;
}

export function carimbo(user, quando) {
  return `(${identificacaoUsuario(user)} · ${dataHoraBR(quando)})`;
}

export function campoVazio(texto) {
  return !String(texto ?? "").trim();
}

// Acrescenta um bloco carimbado ao fim. Devolve o texto atual INTACTO quando não há
// nada a acrescentar — chamar isto sem digitar nada nunca pode alterar o registro.
export function acrescentarAoCampo(atual, adicao, user, quando) {
  const base = String(atual ?? "");
  const nova = String(adicao ?? "").trim();
  if (!nova) return base;
  const bloco = `${carimbo(user, quando)} ${nova}`;
  if (campoVazio(base)) return bloco;
  return `${base.replace(/\s+$/, "")}${SEP_BLOCO}${bloco}`;
}

// Quebra o texto em blocos para exibição, separando o carimbo do conteúdo.
// Bloco sem carimbo reconhecido (o original, ou registro antigo anterior a esta
// onda) volta com `login`/`quando` nulos e é renderizado como texto comum.
export function blocosDoCampo(texto) {
  const t = String(texto ?? "");
  if (!t.trim()) return [];
  return t.split(/\n{2,}/).map(parte => {
    const bruto = parte.replace(/\s+$/, "");
    const m = bruto.match(RE_CARIMBO);
    if (!m) return { texto: bruto, login: null, quando: null };
    return { texto: bruto.slice(m[0].length), login: m[1], quando: m[2] };
  }).filter(b => b.texto || b.login);
}

// Resumo curto do acréscimo para a linha do `historico` da RNC/desvio — a timeline
// continua sendo a fonte de "o que aconteceu quando"; o texto inteiro já está no campo.
export function resumoAcrescimo(adicao, limite = 120) {
  const t = String(adicao ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= limite) return t;
  return t.slice(0, limite - 1) + "…";
}
