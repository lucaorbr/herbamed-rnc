const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(connectionString ? { connectionString } : {
  host: process.env.POSTGRES_HOST || "db",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "sgqherbamed",
  user: process.env.POSTGRES_USER || "sgqherbamed",
  password: process.env.POSTGRES_PASSWORD || "sgqherbamed_change_me",
});

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
