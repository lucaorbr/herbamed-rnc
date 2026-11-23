// Trilha de auditoria gerada no SERVIDOR.
//
// Até a v3.34 a trilha era gravada pelo navegador: a tela mandava a entrada pronta,
// com o nome de quem fez, e o servidor só guardava. Dava para gravar entrada em nome
// de outra pessoa, quem alterava dados direto pela API não deixava rastro, e o
// "antes/depois" era cortado em 2000 caracteres. Numa inspeção BPF a trilha tem de
// ser do sistema.
//
// Agora cada gravação no servidor (coleções, RNCs, usuários, login, assinatura)
// registra, na tabela própria `audit_log`:
//   - QUEM: da sessão, nunca do corpo do pedido;
//   - QUANDO: relógio do servidor;
//   - O QUÊ: as diferenças campo a campo entre o registro antes e depois.
// A tela continua mandando o NOME da ação ("Assinou como Aprovador", "Nova Revisão"),
// que é só descrição: o servidor o pendura na entrada que ele mesmo gravou
// (`rotulo`). A tabela não aceita UPDATE (salvo preencher o rótulo uma vez) nem
// DELETE — trava no próprio banco (migrate.js).
//
// Registro antigo (coleção genérica `audit_log`, gravado pelo navegador) não é
// migrado: aparece na tela marcado como antigo.

const { query } = require("./db");

// Campos que mudam a cada gravação e não dizem nada sobre o registro.
const CAMPOS_IGNORADOS = new Set(["updatedAt", "updated_at", "atualizadoEm", "online", "ultimoAcesso", "ultimo_acesso"]);

const LIMITE_TEXTO = 20000;

/** Arquivo embutido (data URI) vira um marcador; o resto passa inteiro. */
function enxuto(valor) {
  if (typeof valor === "string") {
    if (/^data:[^;]+;base64,/.test(valor)) {
      return `[arquivo embutido, ${Math.round(valor.length * 0.75 / 1024)} KB]`;
    }
    return valor.length > LIMITE_TEXTO ? `${valor.slice(0, LIMITE_TEXTO)}… [${valor.length} caracteres]` : valor;
  }
  if (Array.isArray(valor)) return valor.map(enxuto);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, enxuto(v)]));
  }
  return valor;
}

function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canonico(v[k]); return o; }, {});
  }
  return v;
}
const igual = (a, b) => JSON.stringify(canonico(a ?? null)) === JSON.stringify(canonico(b ?? null));

const simples = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Diferenças de 1º nível entre dois registros.
 * Lista que só cresceu no fim (histórico, anexos) vira `acrescentado` — guardar a
 * lista inteira de novo a cada gravação dobraria a trilha sem dizer nada a mais.
 * Devolve [{ campo, antes, depois }] ou [{ campo, acrescentado }].
 */
function diferencas(antes, depois) {
  const a = antes || {};
  const d = depois || {};
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])].sort();
  const lista = [];
  for (const campo of campos) {
    if (CAMPOS_IGNORADOS.has(campo)) continue;
    const va = a[campo];
    const vd = d[campo];
    if (igual(va, vd)) continue;
    // Objeto que mudou só em alguns itens (permissões, rota, disposição) lista só
    // esses itens, como "permissoes.excluirRNC" — não o objeto inteiro duas vezes.
    if (simples(va) && simples(vd)) {
      for (const sub of diferencas(va, vd)) {
        lista.push({ ...sub, campo: `${campo}.${sub.campo}` });
      }
      continue;
    }
    if (Array.isArray(va) && Array.isArray(vd) && vd.length > va.length
        && va.every((item, i) => igual(item, vd[i]))) {
      lista.push({ campo, acrescentado: enxuto(vd.slice(va.length)) });
      continue;
    }
    lista.push({ campo, antes: va === undefined ? null : enxuto(va), depois: vd === undefined ? null : enxuto(vd) });
  }
  return lista;
}

/** Nome da ação gerado pelo servidor, a partir do que aconteceu com o registro. */
function acaoDoServidor(antes, depois) {
  if (!antes && depois) return "Criou";
  if (antes && !depois) return "Excluiu";
  return "Alterou";
}

/** Nome legível do registro, para a lista da trilha. */
function nomeDoRegistro(dado, id) {
  const d = dado || {};
  return d.num || d.codigo || d.numero || d.name || d.nome || d.titulo || d.email || String(id || "—");
}

/**
 * Monta a entrada (pura, testável). `user` vem SEMPRE da sessão.
 */
function entradaDeAuditoria({ user, acao, colecao, docId, docNome, antes = null, depois = null, detalhe = null }) {
  const alteracoes = antes || depois ? diferencas(antes, depois) : [];
  return {
    usuario: user?.name || "—",
    email: user?.email || "—",
    userId: user?.id != null ? String(user.id) : null,
    acao: acao || acaoDoServidor(antes, depois),
    colecao: colecao || null,
    docId: docId != null ? String(docId) : null,
    docNome: docNome || nomeDoRegistro(depois || antes, docId),
    alteracoes: detalhe ? [...alteracoes, ...[].concat(detalhe)] : alteracoes,
  };
}

/**
 * Grava a entrada. Falha de auditoria NÃO desfaz a gravação do dado (o registro já
 * foi salvo), mas fica no log do servidor — nunca some em silêncio.
 * Alteração vazia (gravou o mesmo conteúdo) não gera entrada.
 */
async function registrarAuditoria(params) {
  try {
    const e = entradaDeAuditoria(params);
    if (params.antes && params.depois && e.alteracoes.length === 0) return null;
    const r = await query(`
      INSERT INTO audit_log (ts, data, usuario, email, user_id, acao, colecao, doc_id, doc_nome, alteracoes, origem)
      VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'servidor')
      RETURNING id
    `, [Date.now(), e.usuario, e.email, e.userId, e.acao, e.colecao, e.docId, e.docNome, JSON.stringify(e.alteracoes)]);
    return r.rows[0]?.id || null;
  } catch (error) {
    console.error("[auditoria] falha ao registrar:", error.message, params?.colecao, params?.docId);
    return null;
  }
}

// A tela usa "usuarios" para o cadastro; as demais coleções têm o mesmo nome dos dois lados.
const JANELA_ROTULO_MS = 30 * 1000;

/**
 * Rótulo vindo da tela: pendura na entrada mais recente do MESMO usuário, mesmo
 * registro, ainda sem rótulo, dos últimos 30 segundos. Sem par (ação só de tela,
 * como sair por inatividade), vira entrada própria — com o usuário da sessão.
 */
async function rotularAuditoria(user, { acao, colecao, docId, docNome }) {
  const rotulo = String(acao || "").trim().slice(0, 200);
  if (!rotulo) return null;
  const par = await query(`
    SELECT id FROM audit_log
     WHERE user_id = $1 AND colecao IS NOT DISTINCT FROM $2 AND doc_id IS NOT DISTINCT FROM $3
       AND rotulo IS NULL AND origem = 'servidor' AND ts >= $4
     ORDER BY ts DESC LIMIT 1
  `, [String(user.id), colecao || null, docId != null ? String(docId) : null, Date.now() - JANELA_ROTULO_MS]);
  if (par.rowCount) {
    await query("UPDATE audit_log SET rotulo = $2 WHERE id = $1", [par.rows[0].id, rotulo]);
    return par.rows[0].id;
  }
  const e = entradaDeAuditoria({ user, acao: rotulo, colecao, docId, docNome });
  const r = await query(`
    INSERT INTO audit_log (ts, data, usuario, email, user_id, acao, colecao, doc_id, doc_nome, alteracoes, origem, rotulo)
    VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, 'tela', $5)
    RETURNING id
  `, [Date.now(), e.usuario, e.email, e.userId, rotulo, e.colecao, e.docId, String(docNome || docId || "—").slice(0, 300)]);
  return r.rows[0]?.id || null;
}

/** Linha da tabela → forma que a tela lê (mesmos nomes da trilha antiga). */
function linhaParaTela(row) {
  return {
    id: `s${row.id}`,
    ts: Number(row.ts) || new Date(row.data).getTime(),
    data: new Date(row.data).toISOString(),
    usuario: row.usuario,
    email: row.email,
    userId: row.user_id,
    acao: row.rotulo || row.acao,
    acaoSistema: row.acao,
    colecao: row.colecao,
    docId: row.doc_id,
    docNome: row.doc_nome,
    alteracoes: row.alteracoes || [],
    origem: row.origem || "servidor",
  };
}

module.exports = {
  diferencas,
  entradaDeAuditoria,
  registrarAuditoria,
  rotularAuditoria,
  linhaParaTela,
  JANELA_ROTULO_MS,
};
