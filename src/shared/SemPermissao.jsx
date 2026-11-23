import React from "react";
import { useTheme } from "../core/theme";

/** Aviso para tela aberta por link sem a permissão de visualizar. */
export default function SemPermissao({ onVoltar }) {
  const T = useTheme();
  return (
    <div style={{ textAlign:"center", padding:"3rem", color:T.text3 }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
      <div style={{ fontSize:14, fontWeight:600, color:T.text }}>Acesso restrito</div>
      <div style={{ fontSize:12, marginTop:6 }}>Você não tem permissão para ver esta tela. Se precisar dela, fale com o administrador do sistema.</div>
      {onVoltar && <button onClick={onVoltar} style={{ marginTop:16, padding:"7px 16px", borderRadius:8, border:`1px solid ${T.border}`, background:"transparent", color:T.text2, cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>Voltar ao início</button>}
    </div>
  );
}
