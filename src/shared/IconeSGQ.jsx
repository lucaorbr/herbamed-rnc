import React, { useId } from "react";
import { MARCA } from "./marca";

// Ícone do SGQ: as duas folhas do símbolo Herbamed formando um visto.
// Mesmo desenho do public/favicon.svg (versão sem nervura, legível em tamanho pequeno).
// Mestre com nervura em docs/icone-sgq.svg.
const FOLHA_CURTA = "M27.4,55 C29.72,44.77 19.21,35.87 7,30 C8.89,44.29 15.39,56.47 27.4,55Z";
const FOLHA_LONGA = "M28.6,55 C48.39,53.38 56.21,31.42 55,7 C40.13,22.58 26.04,41.09 28.6,55Z";

export function IconeSGQ({ size = 32, fundo = MARCA.verde, folha = MARCA.claro, title }) {
  const id = "sgq-folhas-" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true} aria-label={title} style={{ display: "block", flexShrink: 0 }}>
      {fundo && <rect width="64" height="64" rx="14" fill={fundo} />}
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <path d={FOLHA_CURTA} fill="#fff" />
          {/* contorno em preto separa a folha longa da curta no vértice */}
          <path d={FOLHA_LONGA} fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
          <path d={FOLHA_LONGA} fill="#fff" />
        </mask>
      </defs>
      <rect width="64" height="64" fill={folha} mask={`url(#${id})`} />
    </svg>
  );
}
