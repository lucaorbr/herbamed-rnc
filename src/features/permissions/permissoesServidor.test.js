import { PERMS_PADRAO } from "./permissions";

// O servidor confere as permissões com uma CÓPIA desta tabela (server/permissoes.js),
// porque a imagem do backend só leva a pasta server/. Se este teste falhar, alguém
// mudou uma das duas: copie a tabela daqui para lá.
const { PERMS_PADRAO: PERMS_SERVIDOR } = require("../../../server/permissoes");

test("tabela de permissões do servidor é igual à da tela", () => {
  expect(PERMS_SERVIDOR).toEqual(PERMS_PADRAO);
});
