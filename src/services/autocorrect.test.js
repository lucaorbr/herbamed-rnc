import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  autocorrectCompletedWord,
  getAutocorrection,
  handleAutocorrectUndo,
  handleWritingInput,
  isAutocorrectField,
} from "./autocorrect";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("autocorreção em português", () => {
  test("aplica correções seguras preservando maiúsculas", () => {
    expect(getAutocorrection("nao")).toBe("não");
    expect(getAutocorrection("Nao")).toBe("Não");
    expect(getAutocorrection("NAO")).toBe("NÃO");
    expect(getAutocorrection("acao")).toBe("ação");
  });

  test("corrige erros ortográficos comuns do contexto do SGQ", () => {
    expect(getAutocorrection("prodto")).toBe("produto");
    expect(getAutocorrection("Prodto")).toBe("Produto");
    expect(getAutocorrection("qualdiade")).toBe("qualidade");
    expect(getAutocorrection("ocorencia")).toBe("ocorrência");
  });

  test("não altera palavras fora da base de alta confiança", () => {
    expect(getAutocorrection("Herbamed")).toBeNull();
    expect(getAutocorrection("RNC")).toBeNull();
    expect(getAutocorrection("esta")).toBeNull();
  });

  test("corrige somente depois que a palavra é finalizada", () => {
    expect(autocorrectCompletedWord("prodto", 6)).toBeNull();
    expect(autocorrectCompletedWord("prodto ", 7)).toEqual({
      value: "produto ",
      cursor: 8,
      original: "prodto",
      correction: "produto",
    });
  });

  test("mantém o cursor correto quando adiciona acentos", () => {
    expect(autocorrectCompletedWord("acao,", 5)).toEqual({
      value: "ação,",
      cursor: 5,
      original: "acao",
      correction: "ação",
    });
  });

  test("integra correção, capitalização e Ctrl+Z no campo real", () => {
    const element = document.createElement("textarea");
    element.value = "prodto ";
    element.setSelectionRange(7, 7);
    const correctionEvent = jest.fn();
    window.addEventListener("sgq:autocorrect", correctionEvent);

    handleWritingInput({ target: element, isComposing: false });
    expect(element.value).toBe("Produto ");
    expect(correctionEvent.mock.calls[0][0].detail).toEqual({ original: "prodto", correction: "produto" });

    const preventDefault = jest.fn();
    handleAutocorrectUndo({
      target: element,
      key: "z",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(element.value).toBe("prodto ");
    window.removeEventListener("sgq:autocorrect", correctionEvent);
  });

  test("mantém o valor corrigido em um campo React controlado", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const ControlledField = () => {
      const [value, setValue] = useState("");
      return <><textarea value={value} onChange={event => setValue(event.target.value)} /><output>{value}</output></>;
    };

    document.addEventListener("input", handleWritingInput, true);
    act(() => root.render(<ControlledField />));
    const element = host.querySelector("textarea");
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;

    act(() => {
      nativeSetter.call(element, "n");
      element.setSelectionRange(1, 1);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(element.value).toBe("N");
    expect(host.querySelector("output").textContent).toBe("N");
    document.removeEventListener("input", handleWritingInput, true);
    act(() => root.unmount());
    host.remove();
  });

  test("protege campos técnicos e permite configuração explícita", () => {
    const field = (placeholder, dataset = {}) => ({
      tagName: "INPUT",
      type: "text",
      placeholder,
      dataset,
      getAttribute: () => "",
      parentElement: null,
    });

    expect(isAutocorrectField(field("Número do lote"))).toBe(false);
    expect(isAutocorrectField(field("Descreva a ocorrência"))).toBe(true);
    expect(isAutocorrectField(field("Número do lote", { autocorrect: "on" }))).toBe(true);
  });
});