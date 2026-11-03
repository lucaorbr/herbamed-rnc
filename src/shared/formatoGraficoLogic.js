// Formato dos gráficos de série por categoria (severidade, impacto): os mesmos números
// vistos de três jeitos. A escolha fica no navegador de cada pessoa, por gráfico,
// como o filtro de período (`sgq_periodo:<tela>`).

export const FORMATOS = [
  { id: "empilhado", label: "Empilhado", dica: "Mostra o total do mês" },
  { id: "lado",      label: "Lado a lado", dica: "Compara as categorias entre si" },
  { id: "linhas",    label: "Linhas", dica: "Mostra a tendência de cada categoria" },
];

const VALIDOS = new Set(FORMATOS.map(f => f.id));

export const chaveFormato = grafico => `sgq_formato:${grafico}`;

/** Valor gravado vira formato válido; qualquer outra coisa cai no padrão. */
export const formatoValido = (v, padrao = "empilhado") => (VALIDOS.has(v) ? v : padrao);
