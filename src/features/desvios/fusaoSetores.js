// Fusão dos setores de desvio no catálogo de Áreas e Setores — regras puras.
//
// Existiam duas listas para a mesma realidade física: `catalogo_setores_desvio`
// (lista plana, usada só pelos Desvios) e `catalogo_areas_setores_distribuicao`
// (hierárquica Área › Setor, usada pela distribuição de cópias, pelo cadastro de
// colaboradores e pela exigência de treinamento). "Encapsulamento 1" existia nas
// duas com ids diferentes, e ninguém sabia onde cadastrar um setor novo.
//
// Decisão: **a hierarquia vence** — é ela que já é usada por três módulos. Os
// Desvios passam a ler dela, e a lista plana é aposentada.
//
// ⚠️ O desvio continua gravando o **nome** do setor em `d.setor`, não um id.
// Mudar para id obrigaria a reescrever todo desvio já registrado; pelo mesmo
// motivo da Fase 6 (evidências guardando `userId`), não se reescreve registro
// emitido sem necessidade. Como consequência, quando o nome do setor difere
// entre as duas listas ("Encapsulamento 1" × "Encapsulamento"), a reescrita é
// inevitável — e aí ela é feita explicitamente pelo admin, registrada no
// `historico` de cada desvio, como já faz a reclassificação de "Outros" (v2.12.0).

/** Mesma normalização usada na reclassificação: sem acento, minúsculo, espaços colapsados. */
export const normSetor = (str) => (str || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/** "Outros" é a válvula de escape do texto livre — nunca entra na hierarquia. */
export const ehOutros = (nome) => normSetor(nome) === "outros";

/** Setores ativos da hierarquia, achatados com a área a que pertencem. */
export function setoresDaHierarquia(catalogoAreas = []) {
  const out = [];
  for (const a of (catalogoAreas || [])) {
    if (!a || a.ativo === false) continue;
    for (const sx of (a.setores || [])) {
      if (!sx || sx.ativo === false || !sx.nome) continue;
      out.push({ setorId: sx.id, nome: sx.nome, areaId: a.id, areaLabel: a.label || a.id });
    }
  }
  return out;
}

/**
 * Nomes de setor efetivamente usados pelos desvios já registrados, com contagem.
 * "Outros" fica de fora: quem está em "Outros" + texto livre é caso da
 * reclassificação que já existe, não desta fusão.
 */
export function usosNosDesvios(desvios = []) {
  const mapa = new Map();
  for (const d of (desvios || [])) {
    const nome = String(d?.setor || "").trim();
    if (!nome || ehOutros(nome)) continue;
    const chave = normSetor(nome);
    if (!mapa.has(chave)) mapa.set(chave, { chave, nome, ids: [], usos: 0 });
    const g = mapa.get(chave);
    g.ids.push(d.id);
    g.usos++;
    if (nome.length > g.nome.length) g.nome = nome; // grafia mais completa como rótulo
  }
  return mapa;
}

/**
 * Plano da fusão: o que já está resolvido e o que precisa de decisão do admin.
 *
 * Junta duas origens — os itens da lista plana antiga e os nomes que os desvios
 * realmente usam. A segunda importa mais: um setor pode ter sumido do catálogo e
 * continuar carimbado em desvios antigos, e é ele que ficaria órfão no filtro.
 *
 * `status`:
 *   "vinculado" — já existe setor de mesmo nome na hierarquia, nada a fazer;
 *   "pendente"  — não existe, o admin decide criar ou mapear.
 */
export function planoFusao({ catalogoSetoresDesvio = [], catalogoAreas = [], desvios = [] } = {}) {
  const hierarquia = setoresDaHierarquia(catalogoAreas);
  const porNome = new Map(hierarquia.map(sx => [normSetor(sx.nome), sx]));
  const usos = usosNosDesvios(desvios);

  const itens = new Map();
  const registrar = (nome, origem) => {
    const limpo = String(nome || "").trim();
    if (!limpo || ehOutros(limpo)) return;
    const chave = normSetor(limpo);
    if (!itens.has(chave)) {
      itens.set(chave, { chave, nome: limpo, origens: new Set(), usos: 0, ids: [], destino: null, status: "pendente" });
    }
    itens.get(chave).origens.add(origem);
  };

  for (const sx of (catalogoSetoresDesvio || [])) {
    if (sx?.ativo === false) continue; // setor já desativado não precisa migrar
    registrar(sx?.nome, "catalogo");
  }
  for (const g of usos.values()) registrar(g.nome, "desvios");

  const lista = [...itens.values()].map(item => {
    const uso = usos.get(item.chave);
    const destino = porNome.get(item.chave) || null;
    return {
      ...item,
      origens: [...item.origens],
      usos: uso?.usos || 0,
      ids: uso?.ids || [],
      destino,
      status: destino ? "vinculado" : "pendente",
    };
  });

  // Pendentes primeiro, e entre eles os mais usados — é onde a decisão pesa.
  lista.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === "pendente" ? -1 : 1) ||
    (b.usos - a.usos) ||
    a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    itens: lista,
    resumo: {
      total: lista.length,
      vinculados: lista.filter(x => x.status === "vinculado").length,
      pendentes: lista.filter(x => x.status === "pendente").length,
      desviosAfetados: lista.filter(x => x.status === "pendente").reduce((n, x) => n + x.usos, 0),
    },
  };
}

/** Id de setor novo, derivado da área — mesmo padrão do editor de Áreas e Setores. */
export function novoSetorId(areaId, nome, existentes = []) {
  const slug = normSetor(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "setor";
  const base = `${areaId}-${slug}`;
  if (!existentes.includes(base)) return base;
  let n = 2;
  while (existentes.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Aplica as decisões do admin.
 *
 * `decisoes` é `{ [chave]: { acao: "criar", areaId } | { acao: "mapear", setorId } }`.
 * Item sem decisão é ignorado — migração parcial é permitida de propósito: o admin
 * pode resolver o que entende e voltar depois, sem ficar travado num item duvidoso.
 *
 * Devolve o que **gravar**, sem gravar nada:
 *   `catalogoAreas`      — hierarquia com os setores criados (mesma referência se nada mudou);
 *   `desviosParaSalvar`  — só os desvios cujo `setor` muda de nome, já com a entrada de histórico;
 *   `criados` / `mapeados` — para o resumo na tela.
 */
export function aplicarDecisoes({ itens = [], decisoes = {}, catalogoAreas = [], desvios = [], usuario = "—", data = "" } = {}) {
  let areas = (catalogoAreas || []).map(a => ({ ...a, setores: [...(a.setores || [])] }));
  const idsExistentes = areas.flatMap(a => (a.setores || []).map(sx => sx.id)).filter(Boolean);
  const porId = new Map(setoresDaHierarquia(catalogoAreas).map(sx => [sx.setorId, sx]));
  const porIdDesvio = new Map((desvios || []).map(d => [d.id, d]));

  const desviosParaSalvar = [];
  const criados = [];
  const mapeados = [];
  let mudouCatalogo = false;

  for (const item of itens) {
    if (item.status !== "pendente") continue;
    const dec = decisoes[item.chave];
    if (!dec || !dec.acao) continue;

    if (dec.acao === "criar") {
      const ai = areas.findIndex(a => a.id === dec.areaId);
      if (ai < 0) continue;
      // Já existe setor de mesmo nome nessa área? Então não duplica.
      if ((areas[ai].setores || []).some(sx => normSetor(sx.nome) === item.chave)) continue;
      const id = novoSetorId(dec.areaId, item.nome, idsExistentes);
      idsExistentes.push(id);
      areas[ai] = { ...areas[ai], setores: [...areas[ai].setores, { id, nome: item.nome, ativo: true }] };
      criados.push({ nome: item.nome, areaId: dec.areaId, setorId: id });
      mudouCatalogo = true;
      // Nada a reescrever: o nome gravado nos desvios continua valendo.
      continue;
    }

    if (dec.acao === "mapear") {
      const alvo = porId.get(dec.setorId);
      if (!alvo) continue;
      mapeados.push({ de: item.nome, para: alvo.nome, usos: item.usos });
      if (normSetor(alvo.nome) === item.chave) continue; // mesmo nome, nada a reescrever
      for (const id of item.ids) {
        const d = porIdDesvio.get(id);
        if (!d) continue;
        desviosParaSalvar.push({
          ...d,
          setor: alvo.nome,
          historico: [
            ...(d.historico || []),
            { data, acao: `Setor unificado: "${d.setor}" → ${alvo.nome} (Áreas e Setores)`, resp: usuario },
          ],
        });
      }
    }
  }

  return {
    catalogoAreas: mudouCatalogo ? areas : catalogoAreas,
    catalogoMudou: mudouCatalogo,
    desviosParaSalvar,
    criados,
    mapeados,
  };
}
