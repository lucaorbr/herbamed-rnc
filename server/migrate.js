const bcrypt = require("bcryptjs");
const { query } = require("./db");

async function migrate() {
  await query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      setor text,
      crf text,
      assinatura jsonb,
      permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
      online boolean NOT NULL DEFAULT false,
      ultimo_acesso timestamptz,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS generic_documents (
      collection text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_generic_documents_collection_updated
    ON generic_documents (collection, updated_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rncs (
      id text PRIMARY KEY,
      num text,
      status text,
      sev text,
      resp text,
      prazo_ac date,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS counters (
      key text PRIMARY KEY,
      value integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id bigserial PRIMARY KEY,
      ts bigint,
      data timestamptz NOT NULL DEFAULT now(),
      usuario text,
      email text,
      user_id text,
      acao text NOT NULL,
      colecao text,
      doc_id text,
      doc_nome text,
      dados_antes jsonb,
      dados_depois jsonb
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS areco_recebimentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      external_key text NOT NULL UNIQUE,
      origem text NOT NULL DEFAULT 'areco',
      nf_numero text,
      nf_serie text,
      fornecedor_codigo text,
      fornecedor_nome text,
      produto_codigo text,
      produto_nome text,
      lote text,
      quantidade numeric,
      unidade text,
      data_emissao date,
      data_entrada timestamptz,
      status text NOT NULL DEFAULT 'pendente_analise',
      cq_analise_id text,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      imported_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_areco_recebimentos_status
    ON areco_recebimentos (status, data_entrada DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS areco_sync_state (
      source text PRIMARY KEY,
      last_success_at timestamptz,
      last_cursor text,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await seedAdmin();
}

async function seedAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL || "admin";
  const password = process.env.INITIAL_ADMIN_PASSWORD || "Herba@123";
  const name = process.env.INITIAL_ADMIN_NAME || "Administrador SGQ";

  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await query(`
    INSERT INTO users (name, email, password_hash, role, setor, data)
    VALUES ($1, lower($2), $3, 'admin', 'Qualidade', $4::jsonb)
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      setor = EXCLUDED.setor,
      data = EXCLUDED.data,
      updated_at = now()
  `, [name, email, passwordHash, JSON.stringify({ name, email, role: "admin", setor: "Qualidade" })]);

  console.log(`Usuario admin padrao garantido: ${email}`);
}

module.exports = { migrate };
