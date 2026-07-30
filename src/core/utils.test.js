import {
  capitalizeDescriptiveInput,
  isDescriptiveTextField,
  upperFirstLetter,
} from "./utils";

const input = (overrides = {}) => ({
  tagName: "INPUT",
  type: "text",
  value: "",
  dataset: {},
  name: "",
  id: "",
  placeholder: "",
  parentElement: null,
  getAttribute: () => "",
  ...overrides,
});

describe("padronizacao de campos descritivos", () => {
  test("coloca em maiuscula a primeira letra sem alterar o restante", () => {
    expect(upperFirstLetter("produto fora da especificação")).toBe("Produto fora da especificação");
    expect(upperFirstLetter("  ação imediata")).toBe("  Ação imediata");
    expect(upperFirstLetter("RNC já correta")).toBe("RNC já correta");
  });

  test("aplica a regra em campos de texto e textareas descritivos", () => {
    expect(isDescriptiveTextField(input({ placeholder: "Descreva a ocorrência" }))).toBe(true);
    expect(isDescriptiveTextField(input({ tagName: "TEXTAREA" }))).toBe(true);

    const element = input({ value: "material avariado", placeholder: "Produto" });
    capitalizeDescriptiveInput({ target: element });
    expect(element.value).toBe("Material avariado");
  });

  test("preserva campos tecnicos e permite excecoes explicitas", () => {
    expect(isDescriptiveTextField(input({ placeholder: "Lote" }))).toBe(false);
    expect(isDescriptiveTextField(input({ placeholder: "Buscar por código" }))).toBe(false);
    expect(isDescriptiveTextField(input({ type: "email" }))).toBe(false);
    expect(isDescriptiveTextField(input({ dataset: { autoCapitalize: "off" } }))).toBe(false);
    expect(isDescriptiveTextField(input({ type: "number", dataset: { autoCapitalize: "on" } }))).toBe(true);
  });

  test("considera o rotulo proximo para proteger identificadores sem placeholder", () => {
    const label = { tagName: "LABEL", textContent: "Número do lote" };
    const parent = { children: [label] };
    expect(isDescriptiveTextField(input({ parentElement: parent }))).toBe(false);
  });
});