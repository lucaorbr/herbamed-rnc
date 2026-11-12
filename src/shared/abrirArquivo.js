// Abre um arquivo (PDF ou imagem) numa aba nova com um nome legível.
//
// Sem isto a aba mostrava o endereço interno do arquivo — "blob:…/3f9a1c2e-…" no
// documento controlado, "/api/files/<uuid>" nos anexos — porque o visualizador do
// navegador usa o fim do endereço como nome. Aqui a aba nova é uma página com
// <title> próprio e o arquivo dentro, ocupando a tela inteira.

const escapar = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const PDF_OU_IMAGEM = /\.(pdf|png|jpe?g|gif|webp|bmp|svg)$/i;

// O anexo abre na própria página? PDF e imagem sim; Word/Excel o navegador baixa,
// e a página-moldura ficaria em branco — esses seguem o link normal.
export function abreNoNavegador(anexo = {}) {
  const tipo = String(anexo.type || "");
  if (/^application\/pdf$|^image\//i.test(tipo)) return true;
  return PDF_OU_IMAGEM.test(String(anexo.name || anexo.nome || ""));
}

export function htmlDaMoldura(titulo, src = "") {
  const corpo = src
    ? `<iframe src="${escapar(src)}" title="${escapar(titulo)}"></iframe>`
    : `<p>Carregando ${escapar(titulo)}…</p>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapar(titulo)}</title>`
    + `<style>html,body{margin:0;height:100%;background:#525659;font-family:system-ui,sans-serif;color:#fff}`
    + `iframe{border:0;width:100%;height:100%;display:block;background:#fff}p{padding:24px}</style></head>`
    + `<body>${corpo}</body></html>`;
}

// Abre a aba já (dentro do clique, para o navegador não bloquear) e devolve como
// preenchê-la depois — o documento controlado só chega após o download autenticado.
export function abrirAbaComTitulo(titulo) {
  const win = window.open("", "_blank");
  if (!win) return null;
  const escrever = (src) => { win.document.open(); win.document.write(htmlDaMoldura(titulo, src)); win.document.close(); };
  escrever("");
  return {
    mostrar: (src, aoFechar) => {
      escrever(src);
      if (aoFechar) win.addEventListener("pagehide", aoFechar);
    },
    fechar: () => win.close(),
  };
}

// onClick dos links de anexo: PDF/imagem abrem na moldura com o nome do arquivo;
// o resto (e Ctrl/botão do meio) segue o link como antes.
export function abrirAnexo(e, anexo) {
  if (!anexo?.url || !abreNoNavegador(anexo)) return;
  if (e && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return;
  const aba = abrirAbaComTitulo(anexo.name || anexo.nome || "Anexo");
  if (!aba) return; // bloqueador de pop-up: deixa o link seguir
  e?.preventDefault?.();
  aba.mostrar(anexo.url);
}
