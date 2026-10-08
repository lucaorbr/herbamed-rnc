// Interruptores de funcionalidade — o código fica no sistema, só a tela some.

// Matriz de Treinamento (Fases 0 a 8): desligada em 2026-10-08, por decisão do
// usuário — ainda não está em uso e não se pode contar com ela. Esconde a matriz,
// as sessões de treinamento, a seção 📚 Treinamento do documento, o alerta por
// e-mail e as pendências de treinamento. Nenhum dado é apagado: documentos com
// exigência configurada e evidências gravadas continuam no banco, e voltar a
// ligar é trocar para `true`. A leitura de documento passou a ser feita pela
// distribuição eletrônica (`documentos/distribuicaoEletronica.js`), que grava a
// confirmação no mesmo formato de evidência da matriz.
export const MATRIZ_TREINAMENTO_ATIVA = false;
