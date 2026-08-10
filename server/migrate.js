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
    CREATE TABLE IF NOT EXISTS stored_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      original_name text NOT NULL,
      mime_type text NOT NULL DEFAULT 'application/octet-stream',
      size_bytes integer NOT NULL,
      sha256 text NOT NULL,
      data bytea NOT NULL,
      uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_stored_files_created_at
    ON stored_files (created_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS document_summaries (
      doc_id text NOT NULL,
      document_version text NOT NULL DEFAULT '',
      source_hash text NOT NULL,
      summary jsonb NOT NULL,
      generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
      generated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (doc_id, document_version, source_hash)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_document_summaries_doc
    ON document_summaries (doc_id, generated_at DESC)
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

  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS fornecedor_documento text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS produto_id_areco text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS produto_referencia text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS produto_descricao text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS produto_subgrupo text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS produto_categoria text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS tipo_material text`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS escopo_qualidade boolean`);
  await query(`ALTER TABLE areco_recebimentos ADD COLUMN IF NOT EXISTS motivo_filtro text`);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_areco_recebimentos_escopo_status
    ON areco_recebimentos (escopo_qualidade, status, data_entrada DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS areco_materiais (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      codigo text NOT NULL UNIQUE,
      nome text NOT NULL,
      tipo text NOT NULL DEFAULT 'Outros',
      unidade text,
      ativo boolean NOT NULL DEFAULT true,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      imported_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_areco_materiais_tipo_nome
    ON areco_materiais (tipo, nome)
  `);

  await query(`ALTER TABLE areco_materiais ADD COLUMN IF NOT EXISTS referencia text`);
  await query(`ALTER TABLE areco_materiais ADD COLUMN IF NOT EXISTS descricao text`);
  await query(`ALTER TABLE areco_materiais ADD COLUMN IF NOT EXISTS grupo text`);
  await query(`ALTER TABLE areco_materiais ADD COLUMN IF NOT EXISTS categoria text`);

  await query(`
    CREATE TABLE IF NOT EXISTS areco_sync_state (
      source text PRIMARY KEY,
      last_success_at timestamptz,
      last_cursor text,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS document_signatures (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      contexto text NOT NULL,
      papel text NOT NULL,
      user_id text NOT NULL,
      nome text NOT NULL,
      cargo text,
      registro_profissional text,
      codigo_verificacao text,
      hash text,
      metodo_autenticacao text,
      assinado_em timestamptz NOT NULL DEFAULT now(),
      ip_address text
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_doc_signatures_contexto
    ON document_signatures (contexto)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS distribution_log (
      id bigserial PRIMARY KEY,
      doc_id text NOT NULL,
      doc_codigo text,
      usuario_id text,
      usuario_nome text,
      data_download timestamptz NOT NULL DEFAULT now(),
      modo text NOT NULL DEFAULT 'nao_controlada'
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_distribution_log_doc_id
    ON distribution_log (doc_id, data_download DESC)
  `);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS senha_temporaria boolean NOT NULL DEFAULT false`);

  await query(`
    CREATE TABLE IF NOT EXISTS rnc_supplier_tokens (
      id bigserial PRIMARY KEY,
      rnc_id text NOT NULL,
      rnc_num text,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      criado_por text,
      criado_em timestamptz NOT NULL DEFAULT now(),
      respondido_em timestamptz,
      resposta jsonb
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_rnc_supplier_tokens_token
    ON rnc_supplier_tokens (token)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id text NOT NULL,
      tipo text NOT NULL,
      titulo text NOT NULL,
      mensagem text,
      doc_id text,
      doc_codigo text,
      link text,
      lida boolean NOT NULL DEFAULT false,
      criada_em timestamptz NOT NULL DEFAULT now(),
      lida_em timestamptz
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id, criada_em DESC)
  `);

  await seedAdmin();
  await seedTrustedThirdPartyClients();
}

async function seedAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL || "admin";
  const password = process.env.INITIAL_ADMIN_PASSWORD || "Herba@123";
  const name = process.env.INITIAL_ADMIN_NAME || "Administrador SGQ";

  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  // `data` é MESCLADO, nunca substituído: ele guarda campos do cadastro que não têm
  // coluna própria (cargo, cargoId, ...). Com `data = EXCLUDED.data` o admin perdia
  // o cargo a cada restart do backend — e cargo vai para o snapshot imutável da
  // assinatura eletrônica, além de definir a herança de treinamento por cargo.
  // As chaves do seed continuam vencendo; o resto do cadastro sobrevive ao deploy.
  await query(`
    INSERT INTO users (name, email, password_hash, role, setor, data)
    VALUES ($1, lower($2), $3, 'admin', 'Qualidade', $4::jsonb)
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      role = 'admin',
      setor = EXCLUDED.setor,
      data = COALESCE(users.data, '{}'::jsonb) || EXCLUDED.data,
      updated_at = now()
  `, [name, email, passwordHash, JSON.stringify({ name, email, role: "admin", setor: "Qualidade" })]);

  console.log(`Usuario admin padrao garantido: ${email}`);
}

async function seedTrustedThirdPartyClients() {
  const clients = [
    {
      id: "areco-cliente-19583",
      nome: "FITOPRIME PRODUTOS NUTRACEUTICOS LTDA",
      cnpj: "43.090.339/0001-39",
      arecoId: "19583",
    },
    {
      id: "areco-cliente-20381",
      nome: "NUTRIAGE SUPLEMENTOS LTDA",
      cnpj: "44.034.777/0001-42",
      arecoId: "20381",
    },
    {
      id: "areco-cliente-2326",
      nome: "QUALLYNATUS PRODUTOS NATURAIS LTDA",
      cnpj: "23.259.284/0001-30",
      arecoId: "2326",
    },
    {
      id: "areco-cliente-11956",
      nome: "CICLO INDUSTRIA E COMERCIO SUPPLY CHAIN LTDA",
      cnpj: "42.587.384/0002-11",
      arecoId: "11956",
    },
  ];

  for (const client of clients) {
    const existing = await query(`
      SELECT id
      FROM generic_documents
      WHERE collection = 'clientes_terceiros'
        AND regexp_replace(COALESCE(data->>'cnpj', ''), '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')
      LIMIT 1
    `, [client.cnpj]);

    const id = existing.rows[0]?.id || client.id;
    const data = {
      id,
      nome: client.nome,
      cnpj: client.cnpj,
      obs: "Cadastro inicial validado por correspondencia forte no Areco.",
      origem: "areco",
      arecoId: client.arecoId,
      atualizadoEm: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    };

    await query(`
      INSERT INTO generic_documents (collection, id, data, updated_at)
      VALUES ('clientes_terceiros', $1, $2::jsonb, now())
      ON CONFLICT (collection, id) DO UPDATE SET
        data = EXCLUDED.data || generic_documents.data,
        updated_at = now()
    `, [id, JSON.stringify(data)]);
  }

  console.log("Clientes terceiros confiaveis garantidos.");
}

module.exports = { migrate };
