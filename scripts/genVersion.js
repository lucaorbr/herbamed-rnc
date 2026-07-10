// Gera public/version.json a partir da versão do package.json.
// Roda automaticamente antes do build (script "prebuild"), tanto local quanto no
// Docker. O arquivo publicado é consultado pelo app em runtime para detectar quando
// a TI já subiu uma versão nova e o usuário ainda está numa aba antiga.
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const destino = path.join(__dirname, "..", "public", "version.json");
const conteudo = JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString() }) + "\n";

fs.writeFileSync(destino, conteudo);
console.log(`version.json gerado → v${pkg.version}`);
