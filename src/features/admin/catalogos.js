// Catálogos — metadados e contagem de uso. Regras puras, sem React.
//
// A tela de catálogos era uma fileira de 7 abas irmãs, sem dizer para que cada
// uma serve nem onde é usada. Duas consequências práticas: ninguém sabia qual
// abrir, e excluir um item era decisão às cegas — o `confirm` avisava em texto
// genérico ("registros já criados não são afetados"), mas não dizia se ALGUÉM
// estava usando aquilo.
//
// Aqui ficam as duas coisas que faltavam:
//   1. o mapa (que catálogo é, a que família pertence, onde é consumido);
//   2. a contagem de uso real, para o item mostrar "em uso por N" e a exclusão
//      poder ser barrada em vez de apenas avisada.
//
// Uso é contado sobre os REGISTROS existentes, não sobre a configuração: o que
// importa é se apagar aquele item deixaria algum registro órfão de rótulo.

import { normCargo } from "./cargos";

/** Famílias — agrupam os catálogos por assunto na tela índice. */
export const FAMILIAS = [
  { id: "documentos",  titulo: "Documentos",       resumo: "Alimentam a identificação e o ciclo de vida do documento controlado." },
  { id: "organizacao", titulo: "Organização",      resumo: "Quem é quem e onde trabalha. Sustentam a Matriz de Treinamento e a distribuição de cópias." },
  { id: "modulos",     titulo: "Listas por módulo", resumo: "Listas fechadas de um módulo específico — evitam grafias divergentes que distorcem indicadores." },
];

/**
 * Os 7 catálogos. `id` é o mesmo valor que já era usado no seletor de aba, para
 * não invalidar nada que aponte para eles.
 *
 * `usadoEm` é a informação que mais faltava na tela: onde aquele catálogo é
 * consumido de verdade. Note que Cargos e Áreas/Setores aparecem em mais de um
 * módulo — é o que torna as duas listas críticas e o que justifica separá-las
 * das listas de módulo único.
 */
export const CATALOGOS = [
  {
    id: "deptos", icone: "🏛️", titulo: "Departamentos", familia: "documentos",
    resumo: "Departamento responsável pelo documento (sigla + nome). É posição no organograma, não local físico — para local, use Áreas e Setores.",
    usadoEm: ["Gestão de Documentos"],
  },
  {
    id: "tipos", icone: "📄", titulo: "Tipos de Documento", familia: "documentos",
    resumo: "Código, descrição, prazo de revisão periódica e modelo de renderização (com/sem capa e marca d'água).",
    usadoEm: ["Gestão de Documentos"],
  },
  {
    id: "cargos", icone: "👔", titulo: "Cargos", familia: "organizacao",
    resumo: "Cargos/funções dos colaboradores. É por cargo que a exigência de treinamento é herdada.",
    usadoEm: ["Colaboradores", "Matriz de Treinamento"],
  },
  {
    id: "distribuicao", icone: "🗂️", titulo: "Áreas e Setores", familia: "organizacao",
    resumo: "Estrutura física da fábrica (área › setor). Destino das cópias controladas e local de trabalho do colaborador.",
    usadoEm: ["Distribuição de cópias", "Colaboradores", "Matriz de Treinamento"],
  },
  {
    id: "desvios", icone: "⚠️", titulo: "Tipos de Desvio", familia: "modulos",
    resumo: "Classificação do desvio. Lista fechada mantém o Pareto e a matriz Setor × Tipo confiáveis.",
    usadoEm: ["Desvios"],
  },
  {
    id: "setores", icone: "🏭", titulo: "Setores de Desvio", familia: "modulos",
    resumo: "Setor onde o desvio ocorreu. Lista própria, ainda separada de Áreas e Setores.",
    usadoEm: ["Desvios"],
  },
  {
    id: "reval", icone: "🔁", titulo: "Tipos de Revalidação", familia: "modulos",
    resumo: "Tipo de revalidação e o checklist-semente que cada um carrega para o formulário.",
    usadoEm: ["Revalidações"],
  },
];

export const acharCatalogo = (id) => CATALOGOS.find(c => c.id === id) || null;

/** Catálogos de uma família, na ordem declarada. */
export const catalogosDaFamilia = (familiaId) => CATALOGOS.filter(c => c.familia === familiaId);

/**
 * Chave pela qual os registros apontam para o item. Metade dos catálogos usa
 * código/slug (`id`) e a outra metade grava o próprio nome no registro — a
 * diferença é histórica, e é justamente ela que impede uma contagem única.
 */
export function chaveDoItem(catalogoId, item) {
  if (!item) return "";
  if (catalogoId === "deptos" || catalogoId === "tipos" || catalogoId === "cargos") return String(item.id || "");
  if (catalogoId === "distribuicao") return String(item.id || "");
  return normCargo(item.nome || "");
}

const inc = (mapa, chave) => { if (chave) mapa[chave] = (mapa[chave] || 0) + 1; };

/**
 * Quantos registros usam cada item, por catálogo.
 *
 * Devolve `{ [catalogoId]: { [chave]: n } }`. Catálogo cujos registros não estão
 * carregados devolve objeto vazio — que a tela trata como "não sei", nunca como
 * "zero" (ver `podeExcluirItem`): dizer que ninguém usa quando a lista sequer foi
 * carregada seria pior que não dizer nada.
 */
export function contarUsos({ docs = [], desvios = [], revalidacoes = [], colaboradores = [] } = {}) {
  const usos = { deptos: {}, tipos: {}, cargos: {}, distribuicao: {}, desvios: {}, setores: {}, reval: {} };

  for (const d of docs || []) {
    if (!d) continue;
    inc(usos.deptos, String(d.depto || ""));
    inc(usos.tipos, String(d.tipo || ""));
    // Exigência de treinamento: o documento aponta para cargos e setores.
    for (const c of d.treinamento?.cargos || []) inc(usos.cargos, String(c));
    for (const sx of d.treinamento?.setores || []) inc(usos.distribuicao, String(sx));
    // Cópia controlada entregue: área ou setor, conforme o destino escolhido.
    for (const dist of d.distribuicaoFisica || []) {
      inc(usos.distribuicao, String(dist?.setorId || dist?.areaId || ""));
    }
  }

  for (const p of colaboradores || []) {
    if (!p || p.ativo === false) continue;
    inc(usos.cargos, String(p.cargoId || ""));
    inc(usos.distribuicao, String(p.setorId || ""));
  }

  for (const d of desvios || []) {
    if (!d) continue;
    inc(usos.desvios, normCargo(d.tipo || ""));
    inc(usos.setores, normCargo(d.setor || ""));
  }

  for (const r of revalidacoes || []) {
    if (!r) continue;
    inc(usos.reval, normCargo(r.tipoRevalidacao || "Material Gráfico"));
  }

  return usos;
}

/** Quantos registros usam este item. */
export function usoDoItem(usos, catalogoId, item) {
  return usos?.[catalogoId]?.[chaveDoItem(catalogoId, item)] || 0;
}

/**
 * Resumo do catálogo para o card do índice: itens ativos, total e quantos
 * registros dependem dele.
 */
export function resumoCatalogo(catalogoId, itens = [], usos = {}) {
  const lista = itens || [];
  const ativos = lista.filter(x => x && x.ativo !== false).length;
  const registros = Object.values(usos?.[catalogoId] || {}).reduce((n, x) => n + x, 0);
  return { ativos, total: lista.length, registros };
}

/**
 * Item em uso não se exclui — desativa-se. Excluir apagaria o rótulo de registros
 * já emitidos, e num SGQ registro não perde informação depois de criado.
 */
export function podeExcluirItem(usos, catalogoId, item) {
  const n = usoDoItem(usos, catalogoId, item);
  if (n > 0) return { pode: false, usos: n };
  return { pode: true, usos: 0 };
}
