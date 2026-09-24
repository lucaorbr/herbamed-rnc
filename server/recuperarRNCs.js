#!/usr/bin/env node
// Recupera RNCs esvaziadas pelo bug do PATCH (PR #145 → corrigido na v3.6.1).
// Regras de reconstrução em rncRecuperacao.js (puras e testadas).
//
// Uso (dentro do container do backend, que já tem as credenciais do banco):
//   docker exec sgqherbamed-backend node server/recuperarRNCs.js              → só relatório
//   docker exec sgqherbamed-backend node server/recuperarRNCs.js --aplicar    → grava
//   ... --id <id>                     → uma RNC só (mesmo que não pareça danificada)
//   ... --backup-url postgres://...   → usa também um backup restaurado como base
//
// Nunca apaga nada: acrescenta ao histórico da RNC uma entrada dizendo o que foi
// restaurado e de onde, e registra no log de auditoria.

const { Client } = require("pg");
const { query, transaction } = require("./db");
const { rncDanificada, reconstruirRNC } = require("./rncRecuperacao");

const args = process.argv.slice(2);
const APLICAR = args.includes("--aplicar");
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const SO_ID = argVal("--id");
const BACKUP_URL = argVal("--backup-url");

function hojeBR() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function main() {
  const todas = (await query("SELECT id, data, extract(epoch from updated_at)*1000 AS upd FROM rncs")).rows;
  const alvo = todas.filter(r => (SO_ID ? r.id === SO_ID : rncDanificada(r.data)));
  console.log(`RNCs no banco: ${todas.length} · a examinar: ${alvo.length}${APLICAR ? " · MODO APLICAR" : " · modo relatório (nada é gravado)"}\n`);
  if (!alvo.length) return;

  let backup = null;
  if (BACKUP_URL) {
    backup = new Client({ connectionString: BACKUP_URL });
    await backup.connect();
  }

  const numsEmUso = new Map(todas.filter(r => r.data?.num).map(r => [r.data.num, r.id]));
  let ok = 0, parcial = 0, conflito = 0;

  for (const row of alvo) {
    const id = row.id;
    const auditoria = (await query(
      "SELECT data FROM generic_documents WHERE collection = 'audit_log' AND data->>'docId' = $1",
      [id]
    )).rows.map(r => r.data);

    const numsExternos = [];
    for (const sql of [
      "SELECT DISTINCT entidade_num AS n FROM email_log WHERE entidade_id = $1 AND entidade_num IS NOT NULL",
      "SELECT DISTINCT rnc_num AS n FROM rnc_supplier_tokens WHERE rnc_id = $1 AND rnc_num IS NOT NULL",
    ]) {
      try { numsExternos.push(...(await query(sql, [id])).rows.map(r => r.n)); } catch { /* tabela pode não existir */ }
    }

    let linhaBackup = null;
    if (backup) {
      const b = await backup.query("SELECT data, extract(epoch from updated_at)*1000 AS upd FROM rncs WHERE id = $1", [id]);
      if (b.rowCount) linhaBackup = { data: b.rows[0].data, updatedAt: Number(b.rows[0].upd) };
    }

    const { rnc, recuperados, fontes, aindaDanificada } = reconstruirRNC({
      atual: row.data, auditoria, backup: linhaBackup, numsExternos,
    });

    const dono = rnc.num && numsEmUso.get(rnc.num);
    const numEmConflito = dono && dono !== id;

    console.log(`── ${id}  →  ${rnc.num || "(sem número)"}`);
    console.log(`   descrição: ${String(rnc.desc || "—").slice(0, 90)}`);
    console.log(`   severidade: ${rnc.sev || "—"} · status: ${rnc.status || "—"} · resp: ${rnc.resp || "—"}`);
    console.log(`   campos recuperados (${recuperados.length}): ${recuperados.join(", ") || "nenhum"}`);
    console.log(`   fontes: ${fontes.join(" | ") || "nenhuma"}`);
    if (numEmConflito) console.log(`   ⚠ número ${rnc.num} já está em uso pela RNC ${dono} — número NÃO será gravado; decidir manualmente.`);
    if (aindaDanificada) console.log("   ⚠ ainda incompleta após a reconstrução — conferir com o backup (--backup-url) ou preencher na tela.");
    console.log("");

    if (numEmConflito) { conflito++; delete rnc.num; }
    if (aindaDanificada || numEmConflito) parcial++; else ok++;
    if (!APLICAR || !recuperados.length) continue;

    const campos = recuperados.filter(k => k !== "num" || !numEmConflito);
    rnc.historico = [...(Array.isArray(rnc.historico) ? rnc.historico : []), {
      data: hojeBR(),
      hora: new Date().toLocaleTimeString("pt-BR"),
      acao: "Dados restaurados após falha de gravação do sistema",
      detalhes: [
        "Uma falha no servidor (v3.3 a v3.6.0) apagava os campos da RNC ao registrar um ato de tratamento.",
        `Campos restaurados: ${campos.join(", ")}`,
        `Fontes: ${fontes.join(" | ")}`,
      ],
      resp: "Sistema — recuperação",
      tipo: "restauracao",
    }];

    await transaction(async client => {
      await client.query(
        "UPDATE rncs SET num=$2,status=$3,sev=$4,resp=$5,prazo_ac=$6,data=$7::jsonb,updated_at=now() WHERE id=$1",
        [id, rnc.num || null, rnc.status || null, rnc.sev || null, rnc.resp || null,
          /^\d{4}-\d{2}-\d{2}$/.test(rnc.prazoAC || "") ? rnc.prazoAC : null, JSON.stringify(rnc)]
      );
      const ts = Date.now();
      await client.query(
        "INSERT INTO generic_documents (collection, id, data, updated_at) VALUES ('audit_log', $1, $2::jsonb, now())",
        [`recupera-${id}-${ts}`, JSON.stringify({
          id: `recupera-${id}-${ts}`, ts, data: new Date(ts).toISOString(),
          usuario: "Sistema — recuperação", email: "—", userId: "—",
          acao: "Restaurou RNC", colecao: "rncs", docId: id, docNome: rnc.num || id,
          dadosAntes: JSON.stringify(row.data).slice(0, 2000), dadosDepois: JSON.stringify(rnc).slice(0, 2000),
        })]
      );
    });
    console.log(`   ✔ gravada\n`);
  }

  console.log(`Resumo: ${ok} reconstruídas por completo · ${parcial} incompletas/pendentes (${conflito} com número em conflito).`);
  if (!APLICAR) console.log("Nada foi gravado. Rode de novo com --aplicar para gravar.");
  if (backup) await backup.end();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
