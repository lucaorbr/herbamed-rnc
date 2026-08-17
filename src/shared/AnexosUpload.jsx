import React, { useState } from "react";
import { useTheme } from "../core/theme";
import { useS } from "./styles";
import { uploadStoredFile } from "../services/localFileStorage";

// Upload de anexos (drop zone + câmera no celular + lista). Nasceu na RNC e virou
// compartilhado quando o terceiro módulo passou a precisar dele (Desvios e, agora,
// a lista de presença digitalizada dos treinamentos). `RncTabs` reexporta para não
// quebrar quem já importava de lá.
//
// `podeRemover=false` serve ao registro imutável: em sessão de treinamento já
// assinada o anexo é acréscimo, não alteração — entra e não sai.

export async function uploadAttachment(file) {
  return uploadStoredFile(file);
}

export function AnexosUpload({
  anexos, setAnexos, inputId = "anexo-input",
  podeRemover = true, bloqueado = false,
  accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx",
  dica = "Fotos, PDFs, documentos — até 10MB por arquivo",
}) {
  const T = useTheme(); const s = useS();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const handleFiles = async (files) => {
    if (!files.length || bloqueado) return;
    setUploading(true);
    const novos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name} é maior que 10MB.`); continue; }
      setProgress(`Enviando ${i + 1}/${files.length}: ${file.name}...`);
      try {
        const result = await uploadAttachment(file);
        novos.push(result);
      } catch (e) { alert(`Erro ao enviar ${file.name}: ${e.message}`); }
    }
    setAnexos(p => [...p, ...novos]);
    setUploading(false);
    setProgress("");
  };

  const removeAnexo = (i) => setAnexos(p => p.filter((_, j) => j !== i));

  const getIcon = (type) => {
    if (type?.includes("image")) return "🖼️";
    if (type?.includes("pdf")) return "📄";
    if (type?.includes("word") || type?.includes("doc")) return "📝";
    if (type?.includes("excel") || type?.includes("sheet")) return "📊";
    return "📎";
  };

  const fmtSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div>
      {/* Drop zone */}
      {!bloqueado && (
        <div
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.accent; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = T.border2; }}
          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = T.border2; handleFiles(Array.from(e.dataTransfer.files)); }}
          style={{ border: `2px dashed ${T.border2}`, borderRadius: 10, padding: "1.5rem", textAlign: "center", cursor: "pointer", transition: "border-color .2s", marginBottom: 12 }}
          onClick={() => document.getElementById(inputId).click()}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
          <div style={{ fontSize: 13, color: T.text2, fontWeight: 500 }}>
            {uploading ? <span style={{ color: T.accent }}>{progress}</span> : "Clique ou arraste arquivos aqui"}
          </div>
          <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{dica}</div>
          <input id={inputId} type="file" multiple accept={accept} style={{ display: "none" }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }} />
          <input id={`${inputId}-cam`} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { handleFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        </div>
      )}

      {/* Botão de câmera — só no celular (no desktop a classe mobile-only esconde) */}
      {!bloqueado && (
        <button
          type="button"
          className="mobile-only"
          onClick={e => { e.stopPropagation(); document.getElementById(`${inputId}-cam`).click(); }}
          style={{ width: "100%", padding: "12px", marginBottom: 12, background: T.accent, color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700 }}
        >
          📷 Tirar foto agora
        </button>
      )}

      {/* Lista de anexos */}
      {anexos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {anexos.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 20 }}>{getIcon(a.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 10, color: T.text3 }}>
                  {fmtSize(a.size)}
                  {a.anexadoPor ? ` · ${a.anexadoPor}` : ""}
                  {a.anexadoEm ? ` · ${new Date(a.anexadoEm).toLocaleDateString("pt-BR")}` : ""}
                </div>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: "none", fontWeight: 600, padding: "4px 10px", background: T.accentDim, borderRadius: 6 }}>Ver</a>
              {podeRemover && (
                <button onClick={() => removeAnexo(i)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 16, padding: "0 4px", fontFamily: "inherit" }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
