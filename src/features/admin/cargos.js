// Catálogo de Cargos — regras puras, sem React.
//
// Fundação da Matriz de Treinamento (modelo SE Suite): a exigência de treinamento
// nasce do CARGO, não da pessoa. Até aqui `cargo` era texto livre no cadastro do
// usuário, o que impede qualquer agrupamento confiável ("Analista de CQ",
// "analista de cq" e "Analista C.Q." viram três cargos diferentes).
//
// Convivência com o legado: `user.cargoId` aponta para o catálogo, e `user.cargo`
// segue existindo como RÓTULO denormalizado — ele é copiado para o snapshot imutável
// da assinatura eletrônica (server/auth.js publicUser + capa do PDF renderizado),
// então não pode virar só um ID.

/** Agrupa grafias equivalentes: sem acento, minúsculo, espaços colapsados. */
export const normCargo = (str) => (str || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/**
 * Id estável e legível a partir do nome. Estável é o ponto: renomear o cargo no
 * catálogo não pode desvincular quem já está apontando para ele.
 */
export function slugCargo(nome) {
  const base = normCargo(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "cargo";
}

/** Id novo, garantidamente livre no catálogo (sufixa -2, -3... em caso de colisão). */
export function novoCargoId(nome, catalogo = []) {
  const base = slugCargo(nome);
  const usados = new Set((catalogo || []).map(c => c.id));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Somente cargos ativos, na ordem do catálogo. */
export function cargosAtivos(catalogo = []) {
  return (catalogo || []).filter(c => c && c.ativo !== false);
}

/** Acha um cargo do catálogo pelo nome, ignorando caixa e acento. */
export function acharCargoPorNome(nome, catalogo = []) {
  const alvo = normCargo(nome);
  if (!alvo) return null;
  return (catalogo || []).find(c => normCargo(c.nome) === alvo) || null;
}

/**
 * Resolve o cargo de um usuário, cobrindo os quatro estados possíveis durante e
 * depois da migração:
 *  - "catalogo": tem cargoId e o cargo existe        → fonte confiável
 *  - "orfao":    tem cargoId mas o cargo sumiu       → mostra o rótulo guardado
 *  - "legado":   só o texto livre antigo             → precisa ser importado
 *  - null:       sem cargo nenhum
 */
export function cargoDoUsuario(user, catalogo = []) {
  if (!user) return null;
  if (user.cargoId) {
    const achado = (catalogo || []).find(c => c.id === user.cargoId);
    if (achado) return { id: achado.id, nome: achado.nome, origem: "catalogo" };
    return { id: user.cargoId, nome: user.cargo || user.cargoId, origem: "orfao" };
  }
  const texto = (user.cargo || "").trim();
  if (texto) return { id: null, nome: texto, origem: "legado" };
  return null;
}

/**
 * Cargos em texto livre que ainda não existem no catálogo, deduplicados por
 * grafia equivalente. Alimenta o botão "Importar cargos já cadastrados":
 * evita digitar de novo o que já está no cadastro dos usuários.
 * Retorna [{ nome, quantidade }], mais usados primeiro.
 */
export function cargosParaImportar(users = [], catalogo = []) {
  const mapa = new Map();
  for (const u of users || []) {
    if (u?.cargoId) continue;                       // já migrado
    const texto = (u?.cargo || "").trim();
    if (!texto) continue;
    if (acharCargoPorNome(texto, catalogo)) continue; // nome já existe no catálogo
    const chave = normCargo(texto);
    const atual = mapa.get(chave);
    // Mantém a primeira grafia vista como canônica, e conta as ocorrências.
    if (atual) atual.quantidade += 1;
    else mapa.set(chave, { nome: texto, quantidade: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
}

/**
 * Usuários com cargo em texto livre que JÁ casam com um cargo do catálogo — só
 * falta criar o vínculo. Sem isto, quem tem a grafia de um cargo já cadastrado
 * fica órfão para sempre: `cargosParaImportar` (com razão) não o traz, porque
 * não há cargo novo a criar. Retorna [{ user, cargo }].
 */
export function usuariosParaVincular(users = [], catalogo = []) {
  const out = [];
  for (const u of users || []) {
    if (u?.cargoId) continue;
    const texto = (u?.cargo || "").trim();
    if (!texto) continue;
    const cargo = acharCargoPorNome(texto, catalogo);
    if (cargo) out.push({ user: u, cargo });
  }
  return out;
}

/** Usuários que ocupam um cargo — base da herança de treinamento da Fase 2. */
export function usuariosDoCargo(users = [], cargoId) {
  if (!cargoId) return [];
  return (users || []).filter(u => u?.cargoId === cargoId);
}

/** Quantos usuários ainda estão com cargo em texto livre (pendência de migração). */
export function pendentesDeMigracao(users = []) {
  return (users || []).filter(u => !u?.cargoId && (u?.cargo || "").trim()).length;
}
