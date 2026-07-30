import React, { useEffect, useState } from "react";

const noticeStyle = {
  position: "fixed", left: 18, bottom: 18, zIndex: 10000,
  display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 36px)",
  padding: "10px 13px", border: "1px solid rgba(34,197,94,.45)", borderRadius: 10,
  background: "#ecfdf5", color: "#14532d", boxShadow: "0 8px 24px rgba(0,0,0,.16)",
  fontSize: 12, animation: "autocorrectNotice .18s ease-out",
};

export function AutocorrectNotice() {
  const [correction, setCorrection] = useState(null);

  useEffect(() => {
    let timer;
    const showCorrection = event => {
      clearTimeout(timer);
      setCorrection(event.detail);
      timer = setTimeout(() => setCorrection(null), 2600);
    };

    window.addEventListener("sgq:autocorrect", showCorrection);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("sgq:autocorrect", showCorrection);
    };
  }, []);

  if (!correction) return null;

  return (
    <>
      <style>{`
        @keyframes autocorrectField{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}55%{box-shadow:0 0 0 4px rgba(34,197,94,.2)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        @keyframes autocorrectNotice{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input[data-autocorrected="true"],textarea[data-autocorrected="true"]{animation:autocorrectField .85s ease-out}
      `}</style>
      <div style={noticeStyle} role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <span><s style={{ color: "#6b7280" }}>{correction.original}</s> → <strong>{correction.correction}</strong></span>
        <span style={{ marginLeft: 5, color: "#4b5563", fontSize: 10 }}>Ctrl+Z para desfazer</span>
      </div>
    </>
  );
}