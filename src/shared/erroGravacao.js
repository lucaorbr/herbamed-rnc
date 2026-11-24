// Mensagem de erro de gravação para o aviso vermelho.
//
// Várias telas chamavam `fbErr(e)` no `catch` sem importá-la (a função só existia
// dentro do App): o próprio `catch` estourava com ReferenceError e o aviso nunca
// aparecia — a pessoa clicava em salvar, nada acontecia e ninguém sabia por quê.
// Com o servidor recusando gravação sem permissão, a mensagem dele (ex.: "Sem
// permissao para esta operacao.") tem de chegar à tela.
export function fbErr(e) {
  return e?.message || "Erro ao salvar. Tente novamente.";
}
