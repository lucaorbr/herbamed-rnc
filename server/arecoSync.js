const sql = require("mssql");
const { query } = require("./db");

function enabled() {
  return String(process.env.ARECO_SYNC_ENABLED || "false").toLowerCase() === "true";
}

function configReady() {
  return Boolean(
    process.env.ARECO_SQLSERVER_HOST &&
    process.env.ARECO_SQLSERVER_PORT &&
    process.env.ARECO_SQLSERVER_DATABASE &&
    process.env.ARECO_SQLSERVER_USER &&
    process.env.ARECO_SQLSERVER_PASSWORD
  );
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

const defaultQuery = `
SELECT TOP (200)
  CAST(det.id_ItemNotaFiscalEntrada AS varchar(80)) AS areco_id,
  CAST(en.cd_NotaFiscal AS varchar(80)) AS nf_numero,
  CAST(en.SerieNF AS varchar(30)) AS nf_serie,
  CAST(en.dt_EntregaMerc AS datetime2) AS data_entrada,
  CAST(en.dt_notaFiscal AS date) AS data_emissao,
  CAST(f.id_Forn AS varchar(80)) AS fornecedor_codigo,
  CAST(ent.Nome AS varchar(255)) AS fornecedor_nome,
  CAST(det.id_Produto AS varchar(80)) AS produto_codigo,
  CAST(prod.produto_nome AS varchar(255)) AS produto_nome,
  CAST(det.qtdItem AS decimal(18,6)) AS quantidade,
  CAST(det.id_unidMed AS varchar(30)) AS unidade,
  CAST(lote.Nro_lote AS varchar(80)) AS lote
FROM Entradas_Notas en
JOIN Det_Entr_Notas_Fiscais det ON det.id_NotaFiscalEntrada = en.id_NotaFiscalEntrada
LEFT JOIN Fornecedores f ON f.id_Forn = en.id_Forn
LEFT JOIN Entidade ent ON ent.Id_Ent = f.Id_Ent
OUTER APPLY (
  SELECT TOP 1 v.ds_Prod AS produto_nome
  FROM ViewConsultaProdutos v
  WHERE v.id_Produto = det.id_Produto
) prod
OUTER APPLY (
  SELECT TOP 1 cl.Nro_lote
  FROM ControleLotes cl
  WHERE cl.id_Produto = det.id_Produto
    AND (cl.id_Forn = en.id_Forn OR cl.id_Forn IS NULL)
  ORDER BY cl.id_LoteMercEntradaSaida DESC
) lote
WHERE en.dt_EntregaMerc >= DATEADD(day, -7, GETDATE())
ORDER BY en.dt_EntregaMerc DESC
`;

function materiaisLimitClause() {
  const limit = Number(process.env.ARECO_MATERIAIS_LIMIT || 0);
  return limit > 0 ? `TOP (${limit})` : "";
}

function defaultMateriaisQuery() {
  return `
SELECT ${materiaisLimitClause()}
  CAST(v.id_Produto AS varchar(80)) AS codigo,
  CAST(MAX(v.ds_Prod) AS varchar(255)) AS nome,
  CAST(NULL AS varchar(30)) AS unidade,
  CAST(NULL AS varchar(120)) AS grupo
FROM ViewConsultaProdutos v
WHERE v.id_Produto IS NOT NULL
GROUP BY v.id_Produto
ORDER BY MAX(v.ds_Prod)
`;
}

function inferMaterialType(row) {
  const text = `${row.tipo || ""} ${row.grupo || ""} ${row.nome || ""}`.toLowerCase();
  if (text.includes("embal") || text.includes("frasco") || text.includes("tampa") || text.includes("caixa")) return "Embalagem";
  if (text.includes("rotulo") || text.includes("etiqueta") || text.includes("label")) return "Rotulo";
  if (text.includes("materia") || text.includes("extrato") || text.includes("ativo") || text.includes("insumo")) return "Materia-prima";
  return row.tipo || row.grupo || "Outros";
}

function materialDoc(row) {
  const codigo = String(row.codigo || row.produto_codigo || "").trim();
  const nome = String(row.nome || row.produto_nome || codigo || "Material Areco").trim();
  const tipo = inferMaterialType({ ...row, nome });
  return {
    id: `areco-${codigo}`,
    origem: "Areco",
    codigoAreco: codigo,
    nome,
    nomeBase: nome,
    apresentacao: "",
    linha: "",
    clienteId: "",
    tipo,
    fornecedorPadrao: "",
    unidadePadrao: row.unidade || "",
    ref: "Importado automaticamente do Areco",
    obs: "Material sincronizado do Areco. Complete os ensaios e especificacoes no SGQ quando necessario.",
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
  const nome = String(row.nome || row.produto_nome || codigo).trim();
  const tipo = inferMaterialType({ ...row, nome });
  const doc = materialDoc({ ...row, codigo, nome, tipo });

  await query(`
    INSERT INTO areco_materiais (codigo, nome, tipo, unidade, payload, updated_at)
    VALUES ($1,$2,$3,$4,$5::jsonb,now())
    ON CONFLICT (codigo) DO UPDATE SET
      nome = EXCLUDED.nome,
      tipo = EXCLUDED.tipo,
      unidade = EXCLUDED.unidade,
      payload = EXCLUDED.payload,
      updated_at = now()
  `, [codigo, nome, tipo, row.unidade || null, JSON.stringify(row)]);

  await query(`
    INSERT INTO generic_documents (collection, id, data, updated_at)
    VALUES ('cq_materiais', $1, $2::jsonb, now())
    ON CONFLICT (collection, id) DO UPDATE SET
      data = generic_documents.data || EXCLUDED.data || jsonb_build_object('ensaios', COALESCE(generic_documents.data->'ensaios', '[]'::jsonb)),
      updated_at = now()
  `, [doc.id, JSON.stringify(doc)]);

  return true;
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
  if (!configReady()) return { skipped: true, reason: "credenciais Areco ausentes" };

  const source = "areco_recebimentos";
  let pool;
  try {
    pool = await sql.connect(getConfig());
    const request = pool.request();
    const result = await request.query(process.env.ARECO_RECEBIMENTOS_QUERY || defaultQuery);
    let imported = 0;
    let importedMateriais = 0;

    for (const row of result.recordset || []) {
      const externalKey = [
        "areco",
        row.areco_id,
        row.nf_numero,
        row.produto_codigo,
        row.lote || "",
      ].join("|");

      await query(`
        INSERT INTO areco_recebimentos (
          external_key, nf_numero, nf_serie, fornecedor_codigo, fornecedor_nome,
          produto_codigo, produto_nome, lote, quantidade, unidade, data_emissao,
          data_entrada, payload, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,now())
        ON CONFLICT (external_key) DO UPDATE SET
          nf_numero = EXCLUDED.nf_numero,
          nf_serie = EXCLUDED.nf_serie,
          fornecedor_codigo = EXCLUDED.fornecedor_codigo,
          fornecedor_nome = EXCLUDED.fornecedor_nome,
          produto_codigo = EXCLUDED.produto_codigo,
          produto_nome = EXCLUDED.produto_nome,
          lote = EXCLUDED.lote,
          quantidade = EXCLUDED.quantidade,
          unidade = EXCLUDED.unidade,
          data_emissao = EXCLUDED.data_emissao,
          data_entrada = EXCLUDED.data_entrada,
          payload = EXCLUDED.payload,
          updated_at = now()
      `, [
        externalKey,
        row.nf_numero,
        row.nf_serie,
        row.fornecedor_codigo,
        row.fornecedor_nome,
        row.produto_codigo,
        row.produto_nome,
        row.lote,
        row.quantidade,
        row.unidade,
        row.data_emissao,
        row.data_entrada,
        JSON.stringify(row),
      ]);
      if (await upsertMaterial({
        codigo: row.produto_codigo,
        nome: row.produto_nome,
        unidade: row.unidade,
      })) importedMateriais += 1;
      imported += 1;
    }

    importedMateriais += await syncMateriais(pool);

    await query(`
      INSERT INTO areco_sync_state (source, last_success_at, last_cursor, last_error, updated_at)
      VALUES ($1, now(), $2, null, now())
      ON CONFLICT (source) DO UPDATE SET
        last_success_at = EXCLUDED.last_success_at,
        last_cursor = EXCLUDED.last_cursor,
        last_error = null,
        updated_at = now()
    `, [source, String(imported)]);

    return { imported, importedMateriais };
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
      console.log("Sync Areco concluido:", result);
    } catch (error) {
      console.warn("Sync Areco falhou:", error.message);
    }
  };

  tick();
  setInterval(tick, interval);
}

module.exports = { runArecoSync, startArecoScheduler };
