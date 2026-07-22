const assert = require("node:assert/strict");
const test = require("node:test");
const {
  decodeCursor,
  encodeCursor,
  getRncIntegrationPage,
  parsePageSize,
  requireIntegrationKey,
} = require("./rncIntegration");

test("cursor preserva timestamp e id", () => {
  const cursor = encodeCursor({ id: "rnc-1", updated_at: "2026-07-22T12:00:00.000Z" });
  assert.deepEqual(decodeCursor(cursor), {
    id: "rnc-1",
    updatedAt: "2026-07-22T12:00:00.000Z",
  });
  assert.throws(() => decodeCursor("invalido"), error => error.status === 400);
});

test("limit aplica padrao e limites", () => {
  assert.equal(parsePageSize(null), 100);
  assert.equal(parsePageSize("500"), 500);
  assert.throws(() => parsePageSize("0"), error => error.status === 400);
  assert.throws(() => parsePageSize("501"), error => error.status === 400);
});

test("chave de integracao e validada", () => {
  const previous = process.env.RNC_INTEGRATION_API_KEY;
  process.env.RNC_INTEGRATION_API_KEY = "segredo-de-teste";
  try {
    assert.doesNotThrow(() => requireIntegrationKey({ headers: { "x-api-key": "segredo-de-teste" } }));
    assert.throws(
      () => requireIntegrationKey({ headers: { "x-api-key": "incorreta" } }),
      error => error.status === 401
    );
  } finally {
    if (previous === undefined) delete process.env.RNC_INTEGRATION_API_KEY;
    else process.env.RNC_INTEGRATION_API_KEY = previous;
  }
});

test("pagina busca um item adicional e devolve cursor do ultimo item entregue", async () => {
  const rows = [
    { id: "1", data: { num: "RNC-1" }, created_at: "2026-07-22T10:00:00Z", updated_at: "2026-07-22T10:00:00Z" },
    { id: "2", data: { num: "RNC-2" }, created_at: "2026-07-22T10:01:00Z", updated_at: "2026-07-22T10:01:00Z" },
    { id: "3", data: { num: "RNC-3" }, created_at: "2026-07-22T10:02:00Z", updated_at: "2026-07-22T10:02:00Z" },
  ];
  let queryParams;
  const page = await getRncIntegrationPage(async (_sql, params) => {
    queryParams = params;
    return { rows };
  }, null, "2");

  assert.equal(queryParams[2], 3);
  assert.equal(page.items.length, 2);
  assert.equal(page.items[0].id, "1");
  assert.equal(page.page.hasMore, true);
  assert.equal(decodeCursor(page.page.nextCursor).id, "2");
});

test("anexos locais recebem URL exclusiva da integracao", async () => {
  const fileId = "123e4567-e89b-12d3-a456-426614174000";
  const page = await getRncIntegrationPage(async () => ({ rows: [{
    id: "1",
    data: { anexos: [{ id: fileId, url: `/api/files/${fileId}` }] },
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
  }] }), null, "10");

  assert.equal(page.items[0].anexos[0].integrationUrl, `/api/integrations/rnc-files/${fileId}`);
});
