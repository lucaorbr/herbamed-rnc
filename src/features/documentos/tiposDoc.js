// Tipos de documento e departamentos — sementes do catálogo e cálculo do prazo
// de revisão. Vivem aqui, e não dentro de `GestaoDocumentosTab.jsx`, porque a
// tela de Configuração de Documentos também precisa deles: importar do módulo
// grande criaria um ciclo (a tela grande renderiza a de configuração).
//
// `GestaoDocumentosTab` reexporta os três nomes, então quem já importava de lá
// continua funcionando.

/**
 * Semente dos tipos de documento. É apenas o ponto de partida: uma vez que o
 * catálogo (`configuracoes/catalogo_tipos_doc`) tenha itens, ele manda.
 */
export const TIPOS_DOC_GD = [
  { id: "PO",   label: "Procedimento Operacional",       icon: "📋", cor: "#2ab84a", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "IT",   label: "Instrução de Trabalho",           icon: "🔧", cor: "#4fc3f7", prazoRevisaoAnos: 2, departamentoResponsavel: "SGQ" },
  { id: "MOP",  label: "Manual Operacional",              icon: "📖", cor: "#a78bfa", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "FO",   label: "Formulário",                     icon: "📝", cor: "#ffd166", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ", semCapa: true, semMarcaDagua: true },
  { id: "ESP",  label: "Especificação",                   icon: "🧪", cor: "#ff8c42", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "MAN",  label: "Manual",                         icon: "📚", cor: "#ff4f6a", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "ANX",  label: "Anexo",                          icon: "📎", cor: "#5dd4b0", prazoRevisaoAnos: 3, departamentoResponsavel: "SGQ" },
  { id: "EMP",  label: "Proc. de Embalagem",             icon: "📦", cor: "#64748b", prazoRevisaoAnos: 2, departamentoResponsavel: "PRO" },
  { id: "EME",  label: "Proc. de Emergência",            icon: "🚨", cor: "#ef4444", prazoRevisaoAnos: 2, departamentoResponsavel: "SSM" },
  { id: "EPA",  label: "Esp. de Produto Acabado",        icon: "🧴", cor: "#06b6d4", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "MTA",  label: "Método de Técnica Analítica",    icon: "🔬", cor: "#8b5cf6", prazoRevisaoAnos: 1, departamentoResponsavel: "SGQ" },
  { id: "PCAL", label: "Plano de Calibração",            icon: "📏", cor: "#f59e0b", prazoRevisaoAnos: 1, departamentoResponsavel: "TEC" },
  { id: "EPI",  label: "Controle de EPI",                icon: "🦺", cor: "#f97316", prazoRevisaoAnos: 2, departamentoResponsavel: "SSM" },
];

/**
 * Semente dos departamentos. Departamento é posição no organograma (dono do
 * documento, e a sigla entra no código dele) — não é local físico. Para local
 * de trabalho e destino de cópia impressa existe o catálogo de Áreas e Setores.
 */
export const DEPARTAMENTOS_GD = [
  { id: "ADM", label: "Administrativo",                   cor: "#5dd4b0" },
  { id: "ALM", label: "Almoxarifado",                     cor: "#818cf8" },
  { id: "COM", label: "Comercial",                        cor: "#ff4f6a" },
  { id: "DIR", label: "Diretoria",                        cor: "#f59e0b" },
  { id: "EXP", label: "Expedição",                        cor: "#10b981" },
  { id: "FIN", label: "Financeiro",                       cor: "#3b82f6" },
  { id: "LIM", label: "Serviços Gerais / Limpeza",        cor: "#6b7280" },
  { id: "LOG", label: "Logística",                        cor: "#ff8c42" },
  { id: "MAN", label: "Manutenção",                       cor: "#f97316" },
  { id: "MKT", label: "Marketing",                        cor: "#ec4899" },
  { id: "PCP", label: "PCP — Plan. e Controle de Prod.",  cor: "#8b5cf6" },
  { id: "PED", label: "Pedidos / Atendimento ao Cliente", cor: "#06b6d4" },
  { id: "PRO", label: "Produção",                         cor: "#ffd166" },
  { id: "REG", label: "Regulatório / Assuntos Reg.",      cor: "#14b8a6" },
  { id: "REH", label: "Recursos Humanos",                 cor: "#a78bfa" },
  { id: "SGQ", label: "Sistema de Gestão da Qualidade",   cor: "#2ab84a" },
  { id: "SSM", label: "Segurança e Saúde no Trabalho",    cor: "#ef4444" },
  { id: "SUP", label: "Suprimentos / Compras",            cor: "#f59e0b" },
  { id: "TEC", label: "Tecnologia da Informação",         cor: "#60a5fa" },
  { id: "VEN", label: "Vendas",                           cor: "#fb923c" },
];

/**
 * Prazo de revisão (anos) efetivo de um tipo.
 *
 * A fonte é `configuracoes/tipos_revisao` — é o que a tela de Configuração de
 * Documentos grava e sempre foi o único valor realmente lido pelo cálculo da
 * próxima revisão.
 *
 * O 3º argumento existe por causa de um furo: um tipo criado no catálogo (fora
 * da semente acima) não estava em lugar nenhum que esta função consultasse e
 * caía no fallback de 3 anos, ignorando o prazo que o admin digitou ao criá-lo.
 * Agora o `prazoRevisaoAnos` gravado no catálogo cobre esse caso.
 */
export function prazoRevisaoTipo(tipoId, tiposRevisaoCfg, catalogoTipos = []) {
  const cfg = tiposRevisaoCfg && tiposRevisaoCfg[tipoId];
  if (cfg !== undefined && cfg !== null && cfg !== "" && Number(cfg) > 0) return Number(cfg);
  const doCatalogo = (catalogoTipos || []).find(t => t?.id === tipoId)?.prazoRevisaoAnos;
  if (Number(doCatalogo) > 0) return Number(doCatalogo);
  const tipo = TIPOS_DOC_GD.find(t => t.id === tipoId);
  return tipo?.prazoRevisaoAnos ?? 3;
}
