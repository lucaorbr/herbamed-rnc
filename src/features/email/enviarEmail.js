// Cliente unico do envio de e-mail — Fase 0 do plano em `docs/PLANO_EMAIL_BACKEND.md`.
//
// Antes cada um dos quatro pontos de envio montava sua propria chamada para a API
// do EmailJS, com `service_id`/`template_id`/public key repetidos no bundle. Agora
// todos passam por aqui e o transporte e escolhido no servidor.
//
// Remetente e `Reply-To` NAO sao parametros: o backend resolve pela sessao.

export async function enviarEmail({ para, assunto, corpo, evento, entidade, nomes }) {
  const res = await fetch("/api/email/send", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ para, assunto, corpo, evento, entidade, nomes }),
  });
  let dados = {};
  try { dados = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) throw new Error(dados.error || `Falha no envio (HTTP ${res.status})`);
  // Falha parcial volta 200: quem recebeu, recebeu — mas quem nao recebeu precisa
  // aparecer na tela, senao repetimos o silencio que a Fase 0 veio acabar.
  if (dados.falhas?.length) {
    const detalhe = dados.falhas.map(f => `${f.destinatario}: ${f.erro}`).join("; ");
    throw new Error(`Enviado para ${dados.enviados?.length || 0}, falhou para ${dados.falhas.length} — ${detalhe}`);
  }
  return dados;
}
