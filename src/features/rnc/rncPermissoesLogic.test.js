import { rncPropria, acoesNaRnc } from "./rncPermissoesLogic";

const ana = { id: "u1", name: "Ana" };
const rnc = { criadoPor: "Ana", criadoPorId: "u1" };
const perms = obj => k => !!obj[k];

describe("rncPermissoesLogic", () => {
  it("RNC própria pelo id, por quem registrou ou por quem detectou", () => {
    expect(rncPropria(rnc, ana)).toBe(true);
    expect(rncPropria({ detector: "Ana" }, ana)).toBe(true);
    expect(rncPropria({ criadoPor: "Bruno", criadoPorId: "u2" }, ana)).toBe(false);
    expect(rncPropria({ criadoPor: "" }, { name: "" })).toBe(false);
  });

  it("registro: própria × qualquer; tratamento: Tratar RNC", () => {
    const outra = { criadoPor: "Bruno" };
    const user = perms({ editarRNCpropria: true, analisarRNC: true });
    expect(acoesNaRnc(rnc, ana, { perm: user })).toEqual({ registro: true, tratamento: true });
    expect(acoesNaRnc(outra, ana, { perm: user })).toEqual({ registro: false, tratamento: true });
    expect(acoesNaRnc(outra, ana, { perm: perms({ editarRNCtodas: true }) })).toEqual({ registro: true, tratamento: false });
    expect(acoesNaRnc(outra, ana, { isAdmin: true })).toEqual({ registro: true, tratamento: true });
    expect(acoesNaRnc(rnc, ana, { perm: perms({ editarRNCtodas: true, analisarRNC: true }), isViewer: true })).toEqual({ registro: false, tratamento: false });
  });
});
