// Distribuição de cópias controladas impressas — regras puras.
//
// Por que existe: até aqui o registro provava que ALGUÉM ENTREGOU, não que alguém
// recebeu. Faltava o `recebidoPor` (quem no setor ficou responsável pela cópia) e a
// data era `tod()` cravada no código — entrega de sexta registrada na segunda ficava
// gravada como segunda. Numa distribuição de cópia controlada o registro que a
// inspeção quer é o do recebedor: é dele que se cobra a devolução quando a versão
// vira obsoleta.
//
// A recolha tinha o problema espelhado: apagava a linha e não guardava quem
// recolheu, quando, nem quem devolveu — o ciclo "este setor teve cópia da Rev.01
// entre março e agosto" não existia em lugar nenhum. Por isso a recolha agora
// ARQUIVA em `historicoDistribuicao[]` em vez de sumir com o registro.

import { normNome } from "../colaboradores/colaboradores";

/**
 * Chave de comparação de destino. Registro antigo não tem `destinoKey` (era só um
 * `setor` em texto), então o fallback `legado:` mantém as cópias já registradas
 * comparáveis sem reescrever nenhuma.
 */
export const chaveDestino = (x) => x?.destinoKey || `legado:${x?.setor ?? ""}`;

/** Identificação do destino a partir da seleção de área/setor. */
export function destinoDaSelecao({ area, setor, tipoDestino }) {
  if (!area) return null;
  const porArea = tipoDestino === "area";
  return {
    destinoKey: porArea ? `area:${area.id}` : `setor:${area.id}:${setor?.id}`,
    tipoDestino: porArea ? "area" : "setor",
    areaId: area.id,
    areaNome: area.label,
    setorId: porArea ? null : (setor?.id || null),
    setorNome: porArea ? null : (setor?.nome || null),
    setor: porArea ? area.id : `${area.id}/${setor?.id}`,
  };
}

export function destinoLabel(destino) {
  if (!destino) return "—";
  if (destino.areaNome) {
    return destino.tipoDestino === "area"
      ? `${destino.areaId} — ${destino.areaNome} (área inteira)`
      : `${destino.areaId} — ${destino.areaNome} / ${destino.setorNome || destino.setorId}`;
  }
  return destino.setor || "—";
}

/**
 * Travas antes de registrar. Cópia controlada sem recebedor identificado é registro
 * incompleto: quando a versão virar obsoleta, não há a quem cobrar a devolução.
 */
export function validarDistribuicao({ form = {}, area, setor, existentes = [], hoje }) {
  if (!area) return { ok: false, erro: "Selecione a área que recebeu a cópia." };
  if (form.tipoDestino === "setor" && !setor) return { ok: false, erro: "Selecione o setor que recebeu a cópia." };
  const destino = destinoDaSelecao({ area, setor, tipoDestino: form.tipoDestino });
  if ((existentes || []).some(x => chaveDestino(x) === chaveDestino(destino))) {
    return { ok: false, erro: "Este destino já tem cópia controlada registrada." };
  }
  if (!String(form.entreguePor || "").trim()) return { ok: false, erro: "Informe quem entregou a cópia." };
  if (!String(form.recebidoPor || "").trim()) return { ok: false, erro: "Informe quem recebeu a cópia no destino." };
  if (!form.dataEntrega) return { ok: false, erro: "Informe a data da entrega." };
  if (hoje && form.dataEntrega > hoje) return { ok: false, erro: "A data da entrega não pode ser futura." };
  return { ok: true, erro: "" };
}

export function novaCopiaFisica({ area, setor, tipoDestino, dataEntrega, entreguePor, recebidoPor, recebidoPorId, versao, registradoPor }) {
  return {
    ...destinoDaSelecao({ area, setor, tipoDestino }),
    dataEntrega: dataEntrega || null,
    entreguePor: String(entreguePor || "").trim(),
    recebidoPor: String(recebidoPor || "").trim(),
    recebidoPorId: recebidoPorId || null,
    versao: versao || null,
    registradoEm: new Date().toISOString(),
    registradoPor: registradoPor || "",
  };
}

/**
 * Colaboradores candidatos a receber a cópia, separados entre os lotados no destino
 * e o resto. Os do destino vêm primeiro porque são a resposta certa quase sempre —
 * o resto continua acessível para o caso do gerente que retira pelo setor.
 *
 * A fonte é a coleção `colaboradores` (Fase 6), **com e sem login**: quem recebe a
 * cópia impressa no chão de fábrica é quase sempre operador, e operador não tem
 * conta no sistema. Usar `users` aqui repetiria o erro que a Fase 6 corrigiu.
 */
export function colaboradoresDoDestino(colaboradores = [], { areaId, setorId, tipoDestino } = {}, catalogoAreas = []) {
  const ativos = (colaboradores || []).filter(c => c && c.ativo !== false);
  const ordenar = (lista) => [...lista].sort((a, b) => normNome(a?.nome).localeCompare(normNome(b?.nome)));
  if (!areaId) return { doDestino: [], outros: ordenar(ativos) };

  const setoresDaArea = (catalogoAreas || []).find(a => a?.id === areaId)?.setores || [];
  const alvo = tipoDestino === "area"
    ? new Set(setoresDaArea.map(s => String(s?.id)))
    : new Set([String(setorId)]);

  const doDestino = ativos.filter(c => c.setorId && alvo.has(String(c.setorId)));
  const chaves = new Set(doDestino.map(c => String(c.id)));
  return { doDestino: ordenar(doDestino), outros: ordenar(ativos.filter(c => !chaves.has(String(c.id)))) };
}

/**
 * Entrada arquivada no histórico ao recolher. Guarda o ciclo inteiro — quando a
 * cópia foi entregue, a quem, quando voltou e por quem — que é justamente o que
 * sumia quando a recolha apenas removia a linha.
 */
export function registroDeRecolha({ copia, data, recolhidoPor, devolvidoPor, motivo = "recolha", versaoDoc }) {
  return {
    id: `dist-${chaveDestino(copia)}-${Date.now()}`,
    destinoKey: copia?.destinoKey || null,
    destinoLabel: destinoLabel(copia),
    tipoDestino: copia?.tipoDestino || null,
    areaId: copia?.areaId || null,
    setorId: copia?.setorId || null,
    setor: copia?.setor || null,
    versao: copia?.versaoAnterior || copia?.versao || versaoDoc || null,
    entregaEm: copia?.dataEntrega || null,
    entreguePor: copia?.entreguePor || "",
    recebidoPor: copia?.recebidoPor || "",
    recebidoPorId: copia?.recebidoPorId || null,
    recolhaEm: data || null,
    recolhidoPor: String(recolhidoPor || "").trim(),
    devolvidoPor: String(devolvidoPor || "").trim(),
    // `recolha` = cópia vigente recolhida/destruída; `obsoleta` = baixa da pendência
    // aberta quando o documento foi revisado.
    motivo,
  };
}

export function validarRecolha({ form = {}, hoje }) {
  if (!form.data) return { ok: false, erro: "Informe a data da recolha." };
  if (hoje && form.data > hoje) return { ok: false, erro: "A data da recolha não pode ser futura." };
  if (!String(form.recolhidoPor || "").trim()) return { ok: false, erro: "Informe quem recolheu a cópia." };
  return { ok: true, erro: "" };
}

/** Recolhe uma cópia vigente: sai da distribuição, entra no histórico. */
export function comRecolha(doc, copia, dados = {}) {
  const entrada = registroDeRecolha({ copia, ...dados, motivo: "recolha", versaoDoc: doc?.versao });
  return {
    ...doc,
    distribuicaoFisica: (doc?.distribuicaoFisica || []).filter(x => chaveDestino(x) !== chaveDestino(copia)),
    historicoDistribuicao: [...(doc?.historicoDistribuicao || []), entrada],
  };
}

/** Baixa da pendência de recolha aberta pela revisão nova — mesmo arquivamento. */
export function comRecolhaObsoleta(doc, pendencia, dados = {}) {
  const entrada = registroDeRecolha({ copia: pendencia, ...dados, motivo: "obsoleta", versaoDoc: doc?.versao });
  const restantes = (doc?.recolhaPendente || []).filter(x => chaveDestino(x) !== chaveDestino(pendencia));
  return {
    ...doc,
    recolhaPendente: restantes.length ? restantes : null,
    historicoDistribuicao: [...(doc?.historicoDistribuicao || []), entrada],
  };
}
