// Meta e situação de triagem dos desvios. Arquivo próprio para quem só precisa da regra
// (a apresentação semanal) não carregar a tela de Desvios inteira. DesviosTabs reexporta.
import { tod } from "../../core/utils";

// Meta de triagem da Qualidade (dias corridos do registro até encerrar/converter).
// Fonte única compartilhada com a aba de Indicadores e com o sinal de atraso na lista.
export const META_TRIAGEM_DIAS = 7;

// Dias entre uma data YYYY-MM-DD e hoje (0 se a data faltar/for futura).
const diasCorridos = (iso, hoje) => {
  if (!iso) return 0;
  const ms = new Date(hoje + "T12:00:00") - new Date(iso.slice(0, 10) + "T12:00:00");
  return Math.max(0, Math.round(ms / 86400000));
};

// Situação de triagem de um desvio ainda "Registrado": há quantos dias está aberto
// e se já passou da meta. Retorna null para desvios já triados (encerrados/convertidos).
export function triagemStatus(d, hoje = tod()) {
  if (d.status !== "Registrado") return null;
  const dias = diasCorridos(d.dataRegistro || d.dataOcorrencia, hoje);
  return { dias, atrasado: dias > META_TRIAGEM_DIAS };
}
