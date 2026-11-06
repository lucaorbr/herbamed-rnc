#!/usr/bin/env node
// Preenche a vigência das versões já arquivadas no histórico de revisão dos
// documentos, a partir do log de auditoria (regra em vigenciaHistorico.js).
// Corrige as datas da tabela "Histórico de Revisão" da capa para as revisões
// abertas antes da v3.26.1.
//
// Uso (dentro do container do backend, que já tem as credenciais do banco):
//   docker exec sgqherbamed-backend node server/preencherVigenciaHistorico.js            → só relatório
//   docker exec sgqherbamed-backend node server/preencherVigenciaHistorico.js --aplicar  → grava
//   ... --id <id>   → um documento só
//
// Só acrescenta `vigenciaVersao` (+ de onde veio) nas entradas que não têm; nunca
// altera outro campo nem sobrescreve vigência já gravada. Rodar de novo não muda nada.

const { query, transaction } = require("./db");
const { vigenciasParaPreencher, aplicarVigencias } = require("./vigenciaHistorico");

const args = process.argv.slice(2);
const APLICAR = args.includes("--aplicar");
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const SO_ID = argVal("--id");

const br = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };
const hojeBR = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function main() {
  const docs = (await query("SELECT id, data FROM generic_documents WHERE collection = 'gestao_docs'")).rows
    .filter((r) => (SO_ID ? r.id === SO_ID : true))
    .map((r) => ({ ...r.data, id: r.id }))
    .filter((d) => (d.historicoRevisoes || []).some((h) => !h.vigenciaVersao));
  console.log(`Documentos com versões arquivadas sem vigência: ${docs.length}${APLICAR ? " · MODO APLICAR" : " · modo relatório (nada é gravado)"}\n`);

  let gravados = 0, linhas = 0, puladas = 0;
  for (const doc of docs) {
    const auditoria = (await query(
      "SELECT data FROM generic_documents WHERE collection = 'audit_log' AND data->>'docId' = $1",
      [doc.id]
    )).rows.map((r) => r.data);

    const { preencher, pulados } = vigenciasParaPreencher(doc, auditoria);
    console.log(`── ${doc.codigo || doc.id} — ${String(doc.titulo || "").slice(0, 70)} (atual Rev.${doc.versao || "?"}, ${doc.status || "—"})`);
    preencher.forEach((p) => {
      const h = doc.historicoRevisoes[p.idx];
      console.log(`   Rev.${p.versao}: ${br(h.data)} → ${br(p.vigencia)}  (${p.fonte})`);
    });
    pulados.forEach((p) => console.log(`   Rev.${p.versao}: mantida — ${p.motivo}`));
    linhas += preencher.length;
    puladas += pulados.length;

    if (APLICAR && preencher.length) {
      const novo = aplicarVigencias(doc, preencher, hojeBR());
      await transaction(async (client) => {
        const atual = (await client.query(
          "SELECT data FROM generic_documents WHERE collection = 'gestao_docs' AND id = $1 FOR UPDATE", [doc.id]
        )).rows[0]?.data;
        if (!atual) return;
        // Regrava a partir do registro lido agora, mexendo só no histórico.
        const recalculado = vigenciasParaPreencher({ ...atual, id: doc.id }, auditoria).preencher;
        const gravar = aplicarVigencias(atual, recalculado, hojeBR());
        await client.query(
          "UPDATE generic_documents SET data = $2::jsonb, updated_at = now() WHERE collection = 'gestao_docs' AND id = $1",
          [doc.id, JSON.stringify(gravar)]
        );
        const ts = Date.now();
        const resumo = recalculado.map((p) => `Rev.${p.versao}: ${br(p.vigencia)}`).join("; ");
        await client.query(
          "INSERT INTO generic_documents (collection, id, data, updated_at) VALUES ('audit_log', $1, $2::jsonb, now())",
          [`vigencia-hist-${doc.id}-${ts}`, JSON.stringify({
            id: `vigencia-hist-${doc.id}-${ts}`, ts, data: new Date(ts).toISOString(),
            usuario: "Sistema — correção do histórico", email: "—", userId: "—",
            acao: "Preencheu vigência das versões anteriores", colecao: "gestao_docs", docId: doc.id,
            docNome: `${novo.codigo || doc.id} — ${novo.titulo || ""}`,
            dadosAntes: null, dadosDepois: JSON.stringify({ vigencias: resumo }),
          })]
        );
      });
      gravados++;
      console.log("   ✔ gravado");
    }
    console.log("");
  }

  console.log(`Resumo: ${linhas} versão(ões) com vigência encontrada · ${puladas} mantida(s) como estão${APLICAR ? ` · ${gravados} documento(s) gravado(s)` : ""}.`);
  if (!APLICAR) console.log("Nada foi gravado. Rode de novo com --aplicar para gravar.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
