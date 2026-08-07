// Cadastro de Colaboradores — regras puras, sem React.
//
// Por que existe: até aqui a Matriz de Treinamento derivava a exigência de
// `users` — quem tem LOGIN no sistema. Numa fábrica, a maioria de quem precisa
// treinar em POP é operador, e operador não tem login. O efeito é que a
// conformidade media só o pessoal de escritório: ficção.
//
// Modelo (SE Suite): cadastro de FUNCIONÁRIOS é separado dos USUÁRIOS do sistema.
// O colaborador é a pessoa; o usuário é a credencial. Quem tem as duas coisas
// carrega `userId` apontando para a conta.
//
// ⚠️ DECISÃO QUE TORNA A MIGRAÇÃO GRATUITA: para quem já tinha login, o
// `colaborador.id` é IGUAL ao `users.id`. As evidências gravadas guardam
// `userId: String(user.id)`; mantendo o id, todo o histórico continua resolvendo
// sem que uma única evidência seja reescrita — o que num SGQ é justamente o que
// não se pode fazer. Por isso o campo da evidência SEGUE se chamando `userId`:
// ele agora significa "id da pessoa". Não renomear sem migrar registro imutável.

import { normCargo, acharCargoPorNome } from "../admin/cargos";

/**
 * Acha um local de trabalho no catálogo hierárquico Área → Setor pelo nome,
 * ignorando caixa e acento. Procura primeiro no SETOR (mais específico) e só
 * depois na ÁREA — "Produção" casa a área, "Encapsulamento" casa o setor.
 */
export function acharSetorPorNome(nome, catalogoAreas = []) {
  const alvo = normCargo(nome);
  if (!alvo) return null;
  for (const a of catalogoAreas || []) {
    for (const s of a?.setores || []) {
      if (normCargo(s?.nome) === alvo) return { id: s.id, nome: s.nome, areaId: a.id, areaNome: a.label, tipo: "setor" };
    }
  }
  for (const a of catalogoAreas || []) {
    if (normCargo(a?.label) === alvo) return { id: a.id, nome: a.label, areaId: a.id, areaNome: a.label, tipo: "area" };
  }
  return null;
}

/** Opções achatadas do catálogo para o <select>, com a hierarquia visível. */
export function opcoesDeLocal(catalogoAreas = []) {
  const out = [];
  for (const a of (catalogoAreas || []).filter(x => x?.ativo !== false)) {
    out.push({ id: a.id, rotulo: `${a.label} (área inteira)`, tipo: "area" });
    for (const s of (a.setores || []).filter(x => x?.ativo !== false)) {
      out.push({ id: s.id, rotulo: `${a.label} › ${s.nome}`, tipo: "setor" });
    }
  }
  return out;
}

/** Mesma normalização do catálogo de cargos — grafias equivalentes colapsam. */
export const normNome = normCargo;

/** Matrícula é a chave natural vinda do RH: só dígitos e letras, sem zeros à esquerda. */
export function normMatricula(m) {
  const s = String(m ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.replace(/^0+(?=.)/, "");
}

/** Colaborador com login pode confirmar leitura sozinho; sem login, só presencial. */
export function temLogin(colab) {
  return !!colab?.userId;
}

/** Ativos apenas — desligado sai do cálculo, mas a evidência dele permanece. */
export function colaboradoresAtivos(lista = []) {
  return (lista || []).filter(c => c && c.ativo !== false);
}

/**
 * Um colaborador novo, pronto para gravar.
 * `id` é obrigatório vir de fora nos casos migrados (tem de ser o `users.id`).
 */
export function novoColaborador({ id, nome, matricula, cargoId, cargoNome, setor, setorId, dataAdmissao, userId, origem = "manual" }) {
  return {
    id: id || `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: String(nome || "").trim(),
    matricula: normMatricula(matricula),
    cargoId: cargoId || null,
    // Rótulo denormalizado, mesmo motivo do `user.cargo`: sobrevive ao cargo sumir.
    cargoNome: cargoNome || "",
    // `setorId` aponta para o catálogo Área → Setor; `setor` é o rótulo (e o texto
    // livre legado, enquanto a vinculação não é feita).
    setorId: setorId || null,
    setor: setor || "",
    dataAdmissao: dataAdmissao || null,
    userId: userId ? String(userId) : null,
    ativo: true,
    origem,
    criadoEm: new Date().toISOString(),
  };
}

// ── Migração dos usuários existentes ─────────────────────────────────────────

/**
 * Plano de migração: cada usuário com cargo vira colaborador COM O MESMO ID.
 * Idempotente — quem já tem colaborador não é recriado, então rodar de novo é
 * seguro e só pega quem entrou depois.
 *
 * Usuário sem cargo nenhum não migra: sem cargo não há exigência a derivar, e
 * criar colaborador sem cargo só suja a matriz. Ele é reportado em `semCargo`
 * para a tela poder avisar.
 */
export function planoMigracaoColaboradores({ users = [], colaboradores = [], catalogoCargos = [] }) {
  const existentesPorId = new Set((colaboradores || []).map(c => String(c.id)));
  const jaVinculados = new Set((colaboradores || []).filter(c => c.userId).map(c => String(c.userId)));
  const novos = [];
  const semCargo = [];
  let jaMigrados = 0;

  for (const u of users || []) {
    if (!u?.id) continue;
    const uid = String(u.id);
    if (existentesPorId.has(uid) || jaVinculados.has(uid)) { jaMigrados++; continue; }
    if (!u.cargoId) { semCargo.push({ id: uid, nome: u.name || "—" }); continue; }
    const cargo = (catalogoCargos || []).find(c => c.id === u.cargoId);
    novos.push(novoColaborador({
      id: uid,                       // ← o ponto: preserva o vínculo com a evidência
      nome: u.name, matricula: "",
      cargoId: u.cargoId, cargoNome: cargo?.nome || u.cargo || "",
      setor: u.setor, dataAdmissao: null,
      userId: uid, origem: "migracao",
    }));
  }
  return { novos, semCargo, jaMigrados };
}

// ── Importação em massa (planilha do RH) ─────────────────────────────────────

/**
 * Interpreta linhas de planilha e decide, para cada uma, se cria ou atualiza.
 *
 * Chave de casamento, nesta ordem:
 *   1. MATRÍCULA — a chave do RH. Reimportar a mesma planilha atualiza, não duplica.
 *   2. NOME normalizado — só quando a linha não traz matrícula.
 *
 * Nome ambíguo (dois cadastros com a mesma grafia) NÃO é resolvido por adivinhação:
 * vira `conflito`, para a pessoa decidir. Num cadastro que alimenta registro de
 * treinamento, casar a pessoa errada é pior do que não casar.
 *
 * @param linhas [{ nome, matricula, cargo, setor, dataAdmissao }]
 * @returns { criar, atualizar, conflitos, ignorados, cargosDesconhecidos }
 */
export function planoImportacaoColaboradores({ linhas = [], colaboradores = [], catalogoCargos = [], catalogoAreas = [] }) {
  const porMatricula = new Map();
  const porNome = new Map();
  for (const c of colaboradores || []) {
    const m = normMatricula(c.matricula);
    if (m) porMatricula.set(m, c);
    const n = normNome(c.nome);
    if (n) porNome.set(n, [...(porNome.get(n) || []), c]);
  }

  const criar = [], atualizar = [], conflitos = [], ignorados = [];
  const cargosDesconhecidos = new Map();
  const setoresDesconhecidos = new Map();
  const matriculasNaLeva = new Set();
  const nomesNaLeva = new Set();

  for (const [i, linha] of (linhas || []).entries()) {
    const nome = String(linha?.nome || "").trim();
    const mat = normMatricula(linha?.matricula);
    const nomeNorm = normNome(nome);
    const num = i + 1;

    if (!nome) { ignorados.push({ linha: num, motivo: "sem nome" }); continue; }

    // Duplicata dentro do próprio arquivo — a planilha é que está errada.
    if (mat && matriculasNaLeva.has(mat)) { conflitos.push({ linha: num, nome, motivo: `matrícula ${mat} repetida no arquivo` }); continue; }
    if (!mat && nomesNaLeva.has(nomeNorm)) { conflitos.push({ linha: num, nome, motivo: "nome repetido no arquivo e sem matrícula para distinguir" }); continue; }

    const cargoTexto = String(linha?.cargo || "").trim();
    const cargo = cargoTexto ? acharCargoPorNome(cargoTexto, catalogoCargos) : null;
    if (cargoTexto && !cargo) {
      cargosDesconhecidos.set(normCargo(cargoTexto), cargoTexto);
      ignorados.push({ linha: num, nome, motivo: `cargo "${cargoTexto}" não existe no catálogo` });
      continue;
    }

    // Setor da planilha é resolvido no catálogo Área → Setor. Não achou, guarda o
    // texto para não perder a informação, e a tela sinaliza como não vinculado —
    // diferente do cargo, que barra a linha: sem setor a pessoa ainda é utilizável.
    const setorTexto = String(linha?.setor || "").trim();
    const local = setorTexto ? acharSetorPorNome(setorTexto, catalogoAreas) : null;
    if (setorTexto && !local) setoresDesconhecidos.set(normCargo(setorTexto), setorTexto);

    const campos = {
      nome,
      matricula: mat,
      cargoId: cargo?.id || null,
      cargoNome: cargo?.nome || "",
      setorId: local?.id || null,
      setor: local?.nome || setorTexto,
      dataAdmissao: linha?.dataAdmissao || null,
    };

    const alvo = mat ? porMatricula.get(mat) : null;
    if (alvo) {
      atualizar.push({ id: alvo.id, antes: alvo, campos });
    } else if (!mat) {
      const candidatos = porNome.get(nomeNorm) || [];
      if (candidatos.length > 1) { conflitos.push({ linha: num, nome, motivo: "mais de um cadastro com este nome — informe a matrícula" }); continue; }
      if (candidatos.length === 1) atualizar.push({ id: candidatos[0].id, antes: candidatos[0], campos });
      else criar.push(novoColaborador({ ...campos, origem: "importacao" }));
    } else {
      criar.push(novoColaborador({ ...campos, origem: "importacao" }));
    }

    if (mat) matriculasNaLeva.add(mat); else nomesNaLeva.add(nomeNorm);
  }

  return { criar, atualizar, conflitos, ignorados, cargosDesconhecidos: [...cargosDesconhecidos.values()], setoresDesconhecidos: [...setoresDesconhecidos.values()] };
}

/**
 * Parser de CSV com separador `;` ou `,`, cabeçalho tolerante a acento e caixa.
 * Colunas aceitas: nome, matricula, cargo, setor, admissao (ou dataAdmissao).
 */
export function parseCSVColaboradores(texto) {
  const linhas = String(texto || "").split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
  const corta = (l) => l.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
  const cab = corta(linhas[0]).map(c => normCargo(c).replace(/\s+/g, ""));
  const idx = (...nomes) => {
    for (const n of nomes) { const i = cab.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iNome = idx("nome", "colaborador", "funcionario");
  const iMat  = idx("matricula", "matr", "registro");
  const iCar  = idx("cargo", "funcao");
  const iSet  = idx("setor", "departamento", "area");
  const iAdm  = idx("admissao", "dataadmissao", "dtadmissao");
  if (iNome < 0) return [];

  return linhas.slice(1).map(l => {
    const c = corta(l);
    return {
      nome: c[iNome] || "",
      matricula: iMat >= 0 ? c[iMat] || "" : "",
      cargo: iCar >= 0 ? c[iCar] || "" : "",
      setor: iSet >= 0 ? c[iSet] || "" : "",
      dataAdmissao: iAdm >= 0 ? normData(c[iAdm]) : null,
    };
  });
}

/** Aceita dd/mm/aaaa ou aaaa-mm-dd; devolve sempre ISO curto, ou null. */
export function normData(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}
