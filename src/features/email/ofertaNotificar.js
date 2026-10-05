// Depois de salvar, a notificação por e-mail é OFERECIDA no aviso de
// confirmação (botão), nunca aberta sozinha: quem salvou precisa ver que
// salvou, e notificar é decisão dele. Uso: toast_(msg, "green", ofertaNotificar(rnc, evento, openEmail)).
export function ofertaNotificar(rnc, evento, openEmail, agora = new Date()) {
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return {
    detalhe: [rnc?.num, `gravado às ${hora}`].filter(Boolean).join(" · "),
    acao: { rotulo: "✉️ Notificar responsáveis", onClick: () => openEmail(rnc, evento) },
  };
}
