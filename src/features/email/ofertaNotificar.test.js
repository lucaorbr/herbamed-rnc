import { ofertaNotificar } from "./ofertaNotificar";

describe("ofertaNotificar", () => {
  it("não abre o e-mail sozinho — só oferece o botão", () => {
    const openEmail = jest.fn();
    const o = ofertaNotificar({ num: "NC-2026-01" }, "5w2h", openEmail, new Date(2026, 9, 5, 14, 32));
    expect(openEmail).not.toHaveBeenCalled();
    expect(o.detalhe).toBe("NC-2026-01 · gravado às 14:32");
    o.acao.onClick();
    expect(openEmail).toHaveBeenCalledWith({ num: "NC-2026-01" }, "5w2h");
  });
  it("sem número da RNC mostra só a hora", () => {
    expect(ofertaNotificar({}, "status", () => {}, new Date(2026, 9, 5, 9, 5)).detalhe).toBe("gravado às 09:05");
  });
});
