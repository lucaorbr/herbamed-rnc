import React from "react";
import { useTheme } from "../core/theme";
import { useS } from "./styles";
import { blocosDoCampo, campoVazio } from "./campoHistoricoLogic";

// Campo de texto append-only — a peça visual da onda 11. A regra e o formato moram
// em `campoHistorico.js`; aqui é só a tela. Ver a decisão de arquitetura lá em cima
// (o campo continua sendo uma string; a edição só acrescenta).
//
// Dois componentes, um para cada modo:
//   <CampoHistoricoLeitura>  — exibe os blocos, carimbo em destaque
//   <CampoHistoricoEdicao>   — texto salvo TRAVADO em cima + textarea de acréscimo
//
// Na edição o texto salvo não vai para dentro de um <textarea> desabilitado de
// propósito: textarea desabilitado convida a tentar clicar e digitar. Ele é um
// painel de leitura, visivelmente diferente do que se pode escrever.

export function CampoHistoricoLeitura({ valor, vazioLabel = "—", compacto = false }) {
  const T = useTheme();
  const blocos = blocosDoCampo(valor);
  if (!blocos.length) return <div style={{ fontSize: 13, color: T.text3 }}>{vazioLabel}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compacto ? 8 : 10 }}>
      {blocos.map((b, i) => (
        <div key={i} style={i === 0 ? undefined : { borderLeft: `2px solid ${T.border2}`, paddingLeft: 10 }}>
          {b.login && (
            <div style={{ fontSize: 10, color: T.text3, fontWeight: 600, marginBottom: 3 }}>
              ↳ acrescentado por {b.login} · {b.quando}
            </div>
          )}
          <div style={{ fontSize: compacto ? 13 : 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{b.texto}</div>
        </div>
      ))}
    </div>
  );
}

export function CampoHistoricoEdicao({
  valorSalvo, adicao, setAdicao, rows = 3,
  placeholder = "Escreva o que quer acrescentar…",
}) {
  const T = useTheme();
  const s = useS();
  const temSalvo = !campoVazio(valorSalvo);
  return (
    <div>
      {temSalvo && (
        <div style={{ background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            🔒 Já registrado — não pode ser alterado
          </div>
          <CampoHistoricoLeitura valor={valorSalvo} compacto />
        </div>
      )}
      <textarea
        rows={rows}
        value={adicao}
        onChange={e => setAdicao(e.target.value)}
        placeholder={temSalvo ? placeholder : "Descreva aqui…"}
        style={{ ...s.inp, minHeight: 72, resize: "vertical" }}
      />
      <div style={{ fontSize: 10, color: T.text3, marginTop: 4 }}>
        {temSalvo
          ? "O texto acima fica preservado como evidência. O que você escrever entra no fim, com seu login, data e hora."
          : "Ao salvar, o texto fica registrado com seu login, data e hora."}
      </div>
    </div>
  );
}
