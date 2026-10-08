// Busca de fornecedor no CQ — regras puras (sem React), testadas em fornecedorBuscaLogic.test.js.
// O valor gravado na análise continua sendo o NOME do fornecedor (string): nada muda no dado,
// só a forma de encontrá-lo.

export function normalizarBusca(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

// Casa quando TODAS as palavras digitadas aparecem no nome ou no CNPJ, em qualquer ordem e
// em qualquer posição: "brasil" acha "Distribuidora Brasil Ltda", "quim sul" acha "Sul Química".
// CNPJ também casa digitado sem pontuação.
export function casaFornecedor(f, termo) {
  const palavras = normalizarBusca(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const texto = normalizarBusca([f?.nome, f?.cnpj].filter(Boolean).join(" "));
  const cnpj = soDigitos(f?.cnpj);
  return palavras.every(p => texto.includes(p) || (/^\d+$/.test(p) && cnpj.includes(p)));
}

// Quem começa com o termo vem antes de quem só o contém; depois, ordem alfabética.
export function filtrarFornecedores(lista, termo) {
  const t = normalizarBusca(termo);
  const achados = (lista || []).filter(f => casaFornecedor(f, termo));
  if (!t) return achados;
  const comeca = (f) => normalizarBusca(f.nome).startsWith(t) ? 0 : 1;
  return [...achados].sort((a, b) => comeca(a) - comeca(b) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

const fmtData = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

// Fornecedores já ligados ao material, para aparecerem no topo da lista:
// 1) o fornecedor padrão do cadastro; 2) os usados em análises anteriores deste material, do
// mais recente para o mais antigo; 3) os das fichas técnicas. Só entra quem está na lista
// recebida (os ativos) — fornecedor inativo não é sugerido.
export function sugestoesDoMaterial(material, analises, fornecedores) {
  if (!material) return [];
  const porNome = new Map((fornecedores || []).map(f => [normalizarBusca(f.nome), f]));
  const saida = [];
  const vistos = new Set();
  const incluir = (nome, motivo) => {
    const chave = normalizarBusca(nome);
    if (!chave || vistos.has(chave)) return;
    const f = porNome.get(chave);
    if (!f) return;
    vistos.add(chave);
    saida.push({ fornecedor: f, motivo });
  };

  if (material.fornecedorPadrao && material.fornecedorPadrao !== "Vários") incluir(material.fornecedorPadrao, "Fornecedor padrão");

  const doMaterial = (analises || [])
    .filter(a => (material.id != null && String(a.materialId) === String(material.id)) || (a.materialNome && a.materialNome === material.nome))
    .filter(a => a.fornecedor)
    .sort((a, b) => (b.criadoTs || 0) - (a.criadoTs || 0));
  for (const a of doMaterial) {
    const data = fmtData(a.dataRecebimento || a.dataAnalise || a.criadoEm);
    incluir(a.fornecedor, data ? `Última análise em ${data}` : "Já analisado");
  }

  for (const ft of material.fichasTecnicas || []) incluir(ft.fornecedorNome, "Ficha técnica");

  return saida;
}

// Ao sair do campo com texto digitado e sem ter escolhido na lista: escolhe sozinho quando
// não há dúvida — nome exato (sem acento/caixa) ou uma única opção restante. Havendo mais de
// uma, devolve null e o campo avisa, em vez de apagar o que foi digitado.
export function escolhaAoSair(opcoes, termo) {
  const t = normalizarBusca(termo);
  if (!t) return null;
  const exata = (opcoes || []).find(o => normalizarBusca(o.label) === t);
  if (exata) return exata;
  return (opcoes || []).length === 1 ? opcoes[0] : null;
}
