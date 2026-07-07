const sql = require("mssql");
const { query } = require("./db");

function enabled() {
  return String(process.env.ARECO_SYNC_ENABLED || "false").toLowerCase() === "true";
}

function configReady() {
  return missingConfig().length === 0;
}

function missingConfig() {
  return [
    "ARECO_SQLSERVER_HOST",
    "ARECO_SQLSERVER_PORT",
    "ARECO_SQLSERVER_DATABASE",
    "ARECO_SQLSERVER_USER",
    "ARECO_SQLSERVER_PASSWORD",
  ].filter(name => !process.env[name]);
}

async function recordSyncError(message) {
  for (const source of ["areco_recebimentos", "areco_materiais", "areco_fornecedores"]) {
    await query(`
      INSERT INTO areco_sync_state (source, last_error, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (source) DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = now()
    `, [source, message]);
  }
}

function getConfig() {
  return {
    server: process.env.ARECO_SQLSERVER_HOST,
    port: Number(process.env.ARECO_SQLSERVER_PORT || 1433),
    database: process.env.ARECO_SQLSERVER_DATABASE,
    user: process.env.ARECO_SQLSERVER_USER,
    password: process.env.ARECO_SQLSERVER_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      readOnlyIntent: true,
    },
    pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
    connectionTimeout: 15000,
  };
}

function recebimentosLimitClause() {
  const limit = Number(process.env.ARECO_RECEBIMENTOS_LIMIT || 1000);
  return limit > 0 ? `TOP (${limit})` : "";
}

function recebimentosDaysBack() {
  const days = Number(process.env.ARECO_RECEBIMENTOS_DAYS || 7);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

async function pruneOldRecebimentos() {
  const days = recebimentosDaysBack();
  const result = await query(`
    DELETE FROM areco_recebimentos
    WHERE data_entrada IS NOT NULL
      AND data_entrada < now() - ($1::int * interval '1 day')
  `, [days]);
  return result.rowCount || 0;
}

function defaultRecebimentosQuery() {
  return `
SELECT ${recebimentosLimitClause()}
  CAST(det.id_ItemNotaFiscalEntrada AS varchar(80)) AS areco_id,
  CAST(en.cd_NotaFiscal AS varchar(80)) AS nf_numero,
  CAST(en.SerieNF AS varchar(30)) AS nf_serie,
  CAST(COALESCE(nfe.DataGeracao, en.dt_EntregaMerc) AS datetime2) AS data_entrada,
  CAST(en.dt_notaFiscal AS date) AS data_emissao,
  CAST(en.id_Forn AS varchar(80)) AS fornecedor_codigo,
  CAST(LTRIM(RTRIM(ent.Nome)) AS varchar(255)) AS fornecedor_nome,
  CAST(LTRIM(RTRIM(COALESCE(pj.CNPJ, pj.CNPJNormalizado, pf.CPF, pf.CPFNormalizado))) AS varchar(30)) AS fornecedor_documento,
  CAST(det.id_Produto AS varchar(80)) AS produto_id_areco,
  CAST(prod.produto_referencia AS varchar(80)) AS produto_referencia,
  CAST(COALESCE(NULLIF(prod.produto_referencia, ''), CAST(det.id_Produto AS varchar(80))) AS varchar(80)) AS produto_codigo,
  CAST(prod.produto_descricao AS varchar(255)) AS produto_nome,
  CAST(prod.produto_descricao AS varchar(255)) AS produto_descricao,
  CAST(prod.produto_subgrupo AS varchar(120)) AS produto_subgrupo,
  CAST(prod.produto_categoria AS varchar(120)) AS produto_categoria,
  CAST(det.qtdItem AS decimal(18,6)) AS quantidade,
  CAST(det.id_unidMed AS varchar(30)) AS unidade,
  CAST(lote.Nro_lote AS varchar(80)) AS lote
FROM Entradas_Notas en
JOIN Det_Entr_Notas_Fiscais det ON det.id_NotaFiscalEntrada = en.id_NotaFiscalEntrada
LEFT JOIN CtrlRecebimentoNFE nfe ON nfe.id_NotaFiscalEntrada = en.id_NotaFiscalEntrada
LEFT JOIN Entidade ent ON ent.Id_Ent = en.id_Forn
LEFT JOIN Entid_PessoasJur pj ON pj.Id_Ent = ent.Id_Ent
LEFT JOIN Entid_PessoasFis pf ON pf.Id_Ent = ent.Id_Ent
OUTER APPLY (
  SELECT TOP 1
    COALESCE(NULLIF(LTRIM(RTRIM(m.cd_Referencia)), ''), NULLIF(LTRIM(RTRIM(v.cd_Referencia)), ''), CAST(det.id_Produto AS varchar(80))) AS produto_referencia,
    COALESCE(NULLIF(LTRIM(RTRIM(m.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(m.DescrResumo)), ''), NULLIF(LTRIM(RTRIM(v.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(v.ds_SubGrupoPrdT2090)), ''), NULLIF(LTRIM(RTRIM(v.ds_CatProdT440)), ''), CAST(det.id_Produto AS varchar(80))) AS produto_descricao,
    LTRIM(RTRIM(v.ds_SubGrupoPrdT2090)) AS produto_subgrupo,
    LTRIM(RTRIM(v.ds_CatProdT440)) AS produto_categoria
  FROM (VALUES (det.id_Produto)) p(id_Produto)
  LEFT JOIN Materiais m ON m.id_Produto = p.id_Produto
  LEFT JOIN ViewConsultaProdutos v ON v.id_Produto = p.id_Produto
) prod
OUTER APPLY (
  SELECT TOP 1 cl.Nro_lote
  FROM ControleLotes cl
  WHERE cl.id_Produto = det.id_Produto
    AND (cl.id_Forn = en.id_Forn OR cl.id_Forn IS NULL)
  ORDER BY cl.id_LoteMercEntradaSaida DESC
) lote
WHERE en.dt_EntregaMerc >= DATEADD(day, -${recebimentosDaysBack()}, GETDATE())
ORDER BY en.dt_EntregaMerc DESC
`;
}

function materiaisLimitClause() {
  const limit = Number(process.env.ARECO_MATERIAIS_LIMIT || 0);
  return limit > 0 ? `TOP (${limit})` : "";
}

function defaultMateriaisQuery() {
  return `
SELECT ${materiaisLimitClause()}
  CAST(p.id_Produto AS varchar(80)) AS codigo,
  CAST(MAX(COALESCE(NULLIF(LTRIM(RTRIM(m.cd_Referencia)), ''), NULLIF(LTRIM(RTRIM(v.cd_Referencia)), ''), CAST(p.id_Produto AS varchar(80)))) AS varchar(80)) AS referencia,
  CAST(MAX(COALESCE(NULLIF(LTRIM(RTRIM(m.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(m.DescrResumo)), ''), NULLIF(LTRIM(RTRIM(v.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(v.ds_SubGrupoPrdT2090)), ''), NULLIF(LTRIM(RTRIM(v.ds_CatProdT440)), ''), CAST(p.id_Produto AS varchar(80)))) AS varchar(255)) AS nome,
  CAST(MAX(COALESCE(NULLIF(LTRIM(RTRIM(m.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(m.DescrResumo)), ''), NULLIF(LTRIM(RTRIM(v.ds_Prod)), ''), CAST(p.id_Produto AS varchar(80)))) AS varchar(255)) AS descricao,
  CAST(NULL AS varchar(30)) AS unidade,
  CAST(MAX(LTRIM(RTRIM(v.ds_SubGrupoPrdT2090))) AS varchar(120)) AS grupo,
  CAST(MAX(LTRIM(RTRIM(v.ds_CatProdT440))) AS varchar(120)) AS categoria
FROM (
  SELECT id_Produto FROM ViewConsultaProdutos WHERE id_Produto IS NOT NULL
  UNION
  SELECT id_Produto FROM Materiais WHERE id_Produto IS NOT NULL
) p
LEFT JOIN ViewConsultaProdutos v ON v.id_Produto = p.id_Produto
LEFT JOIN Materiais m ON m.id_Produto = p.id_Produto
GROUP BY p.id_Produto
ORDER BY MAX(COALESCE(NULLIF(LTRIM(RTRIM(m.ds_Prod)), ''), NULLIF(LTRIM(RTRIM(m.DescrResumo)), ''), NULLIF(LTRIM(RTRIM(v.ds_Prod)), ''), CAST(p.id_Produto AS varchar(80))))
`;
}

function fornecedoresLimitClause() {
  const limit = Number(process.env.ARECO_FORNECEDORES_LIMIT || 5000);
  return limit > 0 ? `TOP (${limit})` : "";
}

function fornecedoresYearsBack() {
  const years = Number(process.env.ARECO_FORNECEDORES_YEARS || 5);
  return Number.isFinite(years) && years > 0 ? years : 5;
}

function defaultFornecedoresQuery() {
  return `
SELECT ${fornecedoresLimitClause()}
  CAST(en.id_Forn AS varchar(80)) AS fornecedor_codigo,
  CAST(LTRIM(RTRIM(ent.Nome)) AS varchar(255)) AS fornecedor_nome,
  CAST(LTRIM(RTRIM(COALESCE(pj.CNPJ, pj.CNPJNormalizado, pf.CPF, pf.CPFNormalizado))) AS varchar(30)) AS fornecedor_documento,
  CAST(MAX(en.dt_EntregaMerc) AS datetime2) AS ultima_entrada,
  CAST(COUNT(DISTINCT en.id_NotaFiscalEntrada) AS int) AS total_notas
FROM Entradas_Notas en
LEFT JOIN Entidade ent ON ent.Id_Ent = en.id_Forn
LEFT JOIN Entid_PessoasJur pj ON pj.Id_Ent = ent.Id_Ent
LEFT JOIN Entid_PessoasFis pf ON pf.Id_Ent = ent.Id_Ent
WHERE en.id_Forn IS NOT NULL
  AND NULLIF(LTRIM(RTRIM(ent.Nome)), '') IS NOT NULL
  AND en.dt_EntregaMerc >= DATEADD(year, -${fornecedoresYearsBack()}, GETDATE())
GROUP BY en.id_Forn, ent.Nome, pj.CNPJ, pj.CNPJNormalizado, pf.CPF, pf.CPFNormalizado
ORDER BY MAX(en.dt_EntregaMerc) DESC, ent.Nome
`;
}

function arecoLocalDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // The MSSQL driver returns Areco datetime values as UTC instants, but the
  // ERP stores them as local Sao Paulo wall-clock time. Shift them to the
  // equivalent UTC instant so Postgres timestamptz renders the same local time.
  return new Date(date.getTime() + 3 * 60 * 60 * 1000);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rowSearchText(row) {
  return normalizeText([
    row.tipo,
    row.grupo,
    row.categoria,
    row.nome,
    row.descricao,
    row.produto_nome,
    row.produto_descricao,
    row.produto_subgrupo,
    row.produto_categoria,
    row.produto_codigo,
    row.produto_referencia,
  ].filter(Boolean).join(" "));
}

function hasAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function classifyQualityScope(row) {
  const text = rowSearchText(row);
  const excludedTerms = [
    "frete",
    "servico",
    "servicos",
    "prestacao",
    "combustivel",
    "combustiveis",
    "lubrificante",
    "lubrificantes",
    "oleo motor",
    "oleo de motor",
    "oleo lubrificante",
    "graxa",
    "fluido hidraulico",
    "hidraulico",
    "diesel",
    "gasolina",
    "etanol",
    "motor",
    "compressor",
    "engrenagem",
    "rolamento",
    "corrente",
    "uso e consumo",
    "uso e con",
    "higiene e limpeza",
    "limpeza",
    "epi",
    "epis",
    "manutencao",
    "maquina",
    "maquinas",
    "equipamento",
    "equipamentos",
    "administrativo",
    "imobilizado",
    "moveis",
    "utensilio",
    "utensilios",
    "material escritorio",
    "saco de lixo",
  ];

  if (hasAny(text, excludedTerms)) {
    return { tipo: "Fora de escopo", escopo: false, motivo: "Item classificado como frete, servico, uso/consumo ou apoio operacional." };
  }

  if (hasAny(text, ["rotulo", "etiqueta", "label", "selo"])) {
    return { tipo: "Rotulo", escopo: true, motivo: "Rotulo ou identificacao de embalagem." };
  }

  if (hasAny(text, [
    "embal",
    "frasco",
    "pote",
    "tampa",
    "caixa",
    "cartucho",
    "blister",
    "bisnaga",
    "sache",
    "saco",
    "valvula",
    "dosador",
    "display",
  ])) {
    return { tipo: "Material de embalagem", escopo: true, motivo: "Material de embalagem." };
  }

  if (hasAny(text, [
    "materia prima",
    "materiaprima",
    "mp ",
    " mp",
    "extrato",
    "ativo",
    "insumo",
    "oleo",
    "essencia",
    "aroma",
    "corante",
    "conservante",
    "vitamina",
    "mineral",
  ])) {
    return { tipo: "Materia-prima", escopo: true, motivo: "Materia-prima ou insumo produtivo." };
  }

  return { tipo: "Fora de escopo", escopo: false, motivo: "Nao identificado como materia-prima, embalagem ou rotulo." };
}

function inferMaterialType(row) {
  const classified = classifyQualityScope(row);
  return classified.escopo ? classified.tipo : (row.tipo || row.grupo || "Outros");
}

function materialDoc(row) {
  const codigo = String(row.codigo || row.produto_codigo || "").trim();
  const referencia = String(row.referencia || row.produto_referencia || row.produto_codigo || codigo || "").trim();
  const nome = String(row.nome || row.descricao || row.produto_descricao || row.produto_nome || referencia || codigo || "Material Areco").trim();
  const tipo = inferMaterialType({ ...row, nome });
  return {
    id: `areco-${codigo}`,
    origem: "Areco",
    codigoAreco: codigo,
    referenciaAreco: referencia,
    nome,
    nomeBase: nome,
    apresentacao: "",
    linha: "",
    clienteId: "",
    tipo,
    fornecedorPadrao: "",
    unidadePadrao: row.unidade || "",
    ref: "Importado automaticamente do Areco",
    obs: `Material sincronizado do Areco. Referencia: ${referencia || codigo}. Complete os ensaios e especificacoes no SGQ quando necessario.`,
    ensaios: [],
    fichasTecnicas: [],
    criadoPor: "Sync Areco",
    criadoEm: new Date().toISOString().slice(0, 10),
    atualizadoEm: new Date().toISOString().slice(0, 10),
  };
}

async function upsertMaterial(row) {
  const codigo = String(row.codigo || row.produto_codigo || "").trim();
  if (!codigo) return false;
  const scope = classifyQualityScope(row);
  if (!scope.escopo) return false;
  const referencia = String(row.referencia || row.produto_referencia || row.produto_codigo || codigo).trim();
  const nome = String(row.nome || row.descricao || row.produto_descricao || row.produto_nome || referencia || codigo).trim();
  const tipo = scope.tipo;
  const doc = materialDoc({ ...row, codigo, referencia, nome, tipo });

  await query(`
    INSERT INTO areco_materiais (codigo, nome, tipo, unidade, referencia, descricao, grupo, categoria, payload, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
    ON CONFLICT (codigo) DO UPDATE SET
      nome = EXCLUDED.nome,
      tipo = EXCLUDED.tipo,
      unidade = EXCLUDED.unidade,
      referencia = EXCLUDED.referencia,
      descricao = EXCLUDED.descricao,
      grupo = EXCLUDED.grupo,
      categoria = EXCLUDED.categoria,
      payload = EXCLUDED.payload,
      updated_at = now()
  `, [codigo, nome, tipo, row.unidade || null, referencia, row.descricao || row.produto_descricao || nome, row.grupo || row.produto_subgrupo || null, row.categoria || row.produto_categoria || null, JSON.stringify(row)]);

  await query(`
    INSERT INTO generic_documents (collection, id, data, updated_at)
    VALUES ('cq_materiais', $1, $2::jsonb, now())
    ON CONFLICT (collection, id) DO UPDATE SET
      data = generic_documents.data || EXCLUDED.data || jsonb_build_object('ensaios', COALESCE(generic_documents.data->'ensaios', '[]'::jsonb)),
      updated_at = now()
  `, [doc.id, JSON.stringify(doc)]);

  return true;
}

async function upsertFornecedor(row) {
  const codigo = String(row.fornecedor_codigo || "").trim();
  const nome = String(row.fornecedor_nome || "").trim();
  if (!codigo || !nome) return false;

  const id = `areco-forn-${codigo}`;
  const existing = await query(
    "SELECT data FROM generic_documents WHERE collection = 'fornecedores' AND id = $1",
    [id]
  );
  const current = existing.rows[0]?.data || {};
  const today = new Date().toISOString().slice(0, 10);
  const imported = {
    id,
    origem: "Areco",
    codigoAreco: codigo,
    nome,
    cnpj: String(row.fornecedor_documento || "").trim(),
    categoria: "Outros",
    contato: "",
    email: "",
    telefone: "",
    cep: "",
    endereco: "",
    status: "Ativo",
    obs: "Fornecedor importado automaticamente do Areco.",
    criadoPor: "Sync Areco",
    criadoEm: today,
    atualizadoEm: today,
    ultimaEntradaAreco: arecoLocalDateTime(row.ultima_entrada || row.data_entrada),
    totalNotasAreco: row.total_notas || null,
  };
  const doc = {
    ...imported,
    ...current,
    id,
    origem: "Areco",
    codigoAreco: codigo,
    nome,
    cnpj: imported.cnpj || current.cnpj || "",
    categoria: current.categoria || imported.categoria,
    status: current.status || imported.status,
    criadoPor: current.criadoPor || imported.criadoPor,
    criadoEm: current.criadoEm || imported.criadoEm,
    atualizadoEm: today,
    ultimaEntradaAreco: imported.ultimaEntradaAreco || current.ultimaEntradaAreco || null,
    totalNotasAreco: imported.totalNotasAreco || current.totalNotasAreco || null,
  };

  await query(`
    INSERT INTO generic_documents (collection, id, data, updated_at)
    VALUES ('fornecedores', $1, $2::jsonb, now())
    ON CONFLICT (collection, id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = now()
  `, [doc.id, JSON.stringify(doc)]);

  return true;
}

async function syncFornecedores(pool) {
  const source = "areco_fornecedores";
  const result = await pool.request().query(process.env.ARECO_FORNECEDORES_QUERY || defaultFornecedoresQuery());
  let imported = 0;

  for (const row of result.recordset || []) {
    if (await upsertFornecedor(row)) imported += 1;
  }

  await query(`
    INSERT INTO areco_sync_state (source, last_success_at, last_cursor, last_error, updated_at)
    VALUES ($1, now(), $2, null, now())
    ON CONFLICT (source) DO UPDATE SET
      last_success_at = EXCLUDED.last_success_at,
      last_cursor = EXCLUDED.last_cursor,
      last_error = null,
      updated_at = now()
  `, [source, String(imported)]);

  return imported;
}

async function syncMateriais(pool) {
  const source = "areco_materiais";
  const result = await pool.request().query(process.env.ARECO_MATERIAIS_QUERY || defaultMateriaisQuery());
  let imported = 0;

  for (const row of result.recordset || []) {
    if (await upsertMaterial(row)) imported += 1;
  }

  await query(`
    INSERT INTO areco_sync_state (source, last_success_at, last_cursor, last_error, updated_at)
    VALUES ($1, now(), $2, null, now())
    ON CONFLICT (source) DO UPDATE SET
      last_success_at = EXCLUDED.last_success_at,
      last_cursor = EXCLUDED.last_cursor,
      last_error = null,
      updated_at = now()
  `, [source, String(imported)]);

  return imported;
}

async function runArecoSync() {
  if (!enabled()) return { skipped: true, reason: "ARECO_SYNC_ENABLED=false" };
  if (!configReady()) {
    const reason = `Configuracao Areco incompleta: ${missingConfig().join(", ")}`;
    await recordSyncError(reason);
    return { skipped: true, reason };
  }

  const source = "areco_recebimentos";
  let pool;
  try {
    pool = await sql.connect(getConfig());
    const request = pool.request();
    const result = await request.query(process.env.ARECO_RECEBIMENTOS_QUERY || defaultRecebimentosQuery());
    let imported = 0;
    let importedMateriais = 0;
    let importedFornecedores = 0;

    for (const row of result.recordset || []) {
      const dataEntrada = arecoLocalDateTime(row.data_entrada);
      const scope = classifyQualityScope(row);
      const payload = { ...row, data_entrada: dataEntrada, tipo_material: scope.tipo, escopo_qualidade: scope.escopo, motivo_filtro: scope.motivo };
      const externalKey = [
        "areco",
        row.areco_id,
        row.nf_numero,
        row.produto_id_areco || row.produto_codigo,
        row.lote || "",
      ].join("|");

      await query(`
        INSERT INTO areco_recebimentos (
          external_key, nf_numero, nf_serie, fornecedor_codigo, fornecedor_nome, fornecedor_documento,
          produto_id_areco, produto_referencia, produto_codigo, produto_nome, produto_descricao,
          produto_subgrupo, produto_categoria, tipo_material, escopo_qualidade, motivo_filtro,
          lote, quantidade, unidade, data_emissao, data_entrada, status, payload, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,now())
        ON CONFLICT (external_key) DO UPDATE SET
          nf_numero = EXCLUDED.nf_numero,
          nf_serie = EXCLUDED.nf_serie,
          fornecedor_codigo = EXCLUDED.fornecedor_codigo,
          fornecedor_nome = EXCLUDED.fornecedor_nome,
          fornecedor_documento = EXCLUDED.fornecedor_documento,
          produto_id_areco = EXCLUDED.produto_id_areco,
          produto_referencia = EXCLUDED.produto_referencia,
          produto_codigo = EXCLUDED.produto_codigo,
          produto_nome = EXCLUDED.produto_nome,
          produto_descricao = EXCLUDED.produto_descricao,
          produto_subgrupo = EXCLUDED.produto_subgrupo,
          produto_categoria = EXCLUDED.produto_categoria,
          tipo_material = EXCLUDED.tipo_material,
          escopo_qualidade = EXCLUDED.escopo_qualidade,
          motivo_filtro = EXCLUDED.motivo_filtro,
          lote = EXCLUDED.lote,
          quantidade = EXCLUDED.quantidade,
          unidade = EXCLUDED.unidade,
          data_emissao = EXCLUDED.data_emissao,
          data_entrada = EXCLUDED.data_entrada,
          status = CASE
            WHEN areco_recebimentos.status IN ('em_analise', 'concluido') THEN areco_recebimentos.status
            ELSE EXCLUDED.status
          END,
          payload = EXCLUDED.payload,
          updated_at = now()
      `, [
        externalKey,
        row.nf_numero,
        row.nf_serie,
        row.fornecedor_codigo,
        row.fornecedor_nome,
        row.fornecedor_documento,
        row.produto_id_areco,
        row.produto_referencia,
        row.produto_codigo,
        row.produto_nome,
        row.produto_descricao,
        row.produto_subgrupo,
        row.produto_categoria,
        scope.tipo,
        scope.escopo,
        scope.motivo,
        row.lote,
        row.quantidade,
        row.unidade,
        row.data_emissao,
        dataEntrada,
        scope.escopo ? "pendente_analise" : "fora_escopo",
        JSON.stringify(payload),
      ]);
      if (await upsertMaterial({
        codigo: row.produto_id_areco || row.produto_codigo,
        referencia: row.produto_referencia || row.produto_codigo,
        nome: row.produto_nome,
        descricao: row.produto_descricao,
        grupo: row.produto_subgrupo,
        categoria: row.produto_categoria,
        unidade: row.unidade,
      })) importedMateriais += 1;
      if (await upsertFornecedor(row)) importedFornecedores += 1;
      imported += 1;
    }

    importedMateriais += await syncMateriais(pool);
    importedFornecedores += await syncFornecedores(pool);
    const prunedRecebimentos = await pruneOldRecebimentos();

    await query(`
      INSERT INTO areco_sync_state (source, last_success_at, last_cursor, last_error, updated_at)
      VALUES ($1, now(), $2, null, now())
      ON CONFLICT (source) DO UPDATE SET
        last_success_at = EXCLUDED.last_success_at,
        last_cursor = EXCLUDED.last_cursor,
        last_error = null,
        updated_at = now()
    `, [source, String(imported)]);

    return { imported, importedMateriais, importedFornecedores, prunedRecebimentos };
  } catch (error) {
    await query(`
      INSERT INTO areco_sync_state (source, last_error, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (source) DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = now()
    `, [source, error.message]);
    throw error;
  } finally {
    if (pool) await pool.close();
  }
}

function startArecoScheduler() {
  const interval = Number(process.env.ARECO_SYNC_INTERVAL_MS || 180000);
  if (!enabled()) {
    console.log("Sincronizacao Areco desativada.");
    return;
  }

  const tick = async () => {
    try {
      const result = await runArecoSync();
      if (result.skipped) console.warn("Sync Areco nao executado:", result.reason);
      else console.log("Sync Areco concluido:", result);
    } catch (error) {
      console.warn("Sync Areco falhou:", error.message);
    }
  };

  tick();
  setInterval(tick, interval);
}

module.exports = { runArecoSync, startArecoScheduler, pruneOldRecebimentos };
