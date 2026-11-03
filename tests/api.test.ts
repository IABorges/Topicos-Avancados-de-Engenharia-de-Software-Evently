// Testes da API REST do Serviço de Ingressos.
// Cada teste chama os Route Handlers do Next.js com uma Request HTTP real (método, cabeçalhos,
// corpo JSON) e confere status HTTP e corpo JSON contra o contrato (seções 3.2, 3.3 e 3.5).

import { beforeEach, describe, expect, it } from "vitest";
import { reiniciarContainer, type Container } from "../src/container";
import { gerarToken } from "../src/infra/auth/jwt";
import { USUARIOS_TESTE } from "../src/infra/memoria/dadosIniciais";
import * as confirmacao from "../app/convites/[conviteId]/confirmacao/route";
import * as recusa from "../app/convites/[conviteId]/recusa/route";
import * as desistencia from "../app/convites/[conviteId]/desistencia/route";
import * as transferencia from "../app/convites/[conviteId]/transferencia/route";
import * as ingressos from "../app/ingressos/route";
import * as ingressoPorId from "../app/ingressos/[ingressoId]/route";
import * as vagas from "../app/eventos/[eventoId]/vagas/route";

const BASE = "http://localhost:3000";
let c: Container;
const tokens: Record<string, string> = {};

async function token(chave: string): Promise<string> {
  if (!tokens[chave]) {
    const u = USUARIOS_TESTE.find((x) => x.chave === chave);
    if (!u) throw new Error(`usuário de teste ${chave} não existe`);
    tokens[chave] = await gerarToken(u);
  }
  return tokens[chave];
}

function req(metodo: string, caminho: string, quem?: string | null, corpo?: unknown, tokenBruto?: string) {
  return (async () => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (tokenBruto) headers.authorization = tokenBruto;
    else if (quem) headers.authorization = `Bearer ${await token(quem)}`;
    return new Request(BASE + caminho, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
  })();
}

const p = <T>(v: T) => ({ params: Promise.resolve(v) });

async function json(resposta: Response) {
  return { status: resposta.status, corpo: await resposta.json() };
}

const confirmar = async (conviteId: number | string, quem: string | null) =>
  json(await confirmacao.POST(await req("POST", `/convites/${conviteId}/confirmacao`, quem), p({ conviteId: String(conviteId) })));
const recusar = async (conviteId: number, quem: string) =>
  json(await recusa.POST(await req("POST", `/convites/${conviteId}/recusa`, quem), p({ conviteId: String(conviteId) })));
const desistir = async (conviteId: number, quem: string) =>
  json(await desistencia.POST(await req("POST", `/convites/${conviteId}/desistencia`, quem), p({ conviteId: String(conviteId) })));
const transferir = async (conviteId: number, quem: string, corpo: unknown) =>
  json(await transferencia.POST(await req("POST", `/convites/${conviteId}/transferencia`, quem, corpo), p({ conviteId: String(conviteId) })));
const consultar = async (query: string, quem: string) =>
  json(await ingressos.GET(await req("GET", `/ingressos${query}`, quem)));
const saldo = async (eventoId: number, quem = "organizador") =>
  json(await vagas.GET(await req("GET", `/eventos/${eventoId}/vagas`, quem), p({ eventoId: String(eventoId) })));

const SUBSTITUTA = { dadosSubstituto: { nome: "Maria Souza", email: "maria.souza@empresa.com" } };

beforeEach(() => {
  c = reiniciarContainer({ log: () => {} });
});

// ===================================================================== autenticação
describe("Autenticação (todas as operações)", () => {
  it("sem token -> 401 NAO_AUTENTICADO", async () => {
    const r = await confirmar(10, null);
    expect(r).toEqual({ status: 401, corpo: { codigo: "NAO_AUTENTICADO", mensagem: expect.any(String) } });
  });

  it("token adulterado -> 401 NAO_AUTENTICADO", async () => {
    const bom = await token("ana");
    const resposta = await confirmacao.POST(
      await req("POST", "/convites/10/confirmacao", null, undefined, `Bearer ${bom.slice(0, -3)}abc`),
      p({ conviteId: "10" }),
    );
    expect((await json(resposta)).corpo.codigo).toBe("NAO_AUTENTICADO");
  });

  it("token expirado -> 401 NAO_AUTENTICADO", async () => {
    const expirado = await gerarToken({ id: "user-ana", email: "ana@evently.test", perfis: ["CONVIDADO"] }, "-1m");
    const resposta = await ingressos.GET(await req("GET", "/ingressos?conviteId=10", null, undefined, `Bearer ${expirado}`));
    expect(resposta.status).toBe(401);
  });
});

// ===================================================================== confirmarPresenca
describe("confirmarPresenca - POST /convites/{conviteId}/confirmacao", () => {
  it("titular com convite vigente -> 201 com ingresso CONFIRMADO e QR Code", async () => {
    const r = await confirmar(10, "ana");
    expect(r.status).toBe(201);
    expect(r.corpo).toEqual({
      ingressoId: 100,
      conviteId: 10,
      situacao: "CONFIRMADO",
      qrCode: expect.stringMatching(/^EVT-[0-9A-F]{8}$/),
      confirmadoEm: expect.any(String),
    });
    expect((await saldo(1)).corpo).toMatchObject({ ocupadas: 3, disponiveis: 0 });
    expect(c.preparacao.trilhasLiberadas).toContainEqual({ eventoId: 1, conviteId: 10 });
    expect(c.publicador.publicados.map((e) => e.tipo)).toEqual(["PresencaConfirmada"]);
    expect(c.notificacao.enviados).toHaveLength(1);
  });

  it("convite inexistente -> 404 CONVITE_NAO_ENCONTRADO", async () => {
    expect(await confirmar(999, "ana")).toMatchObject({ status: 404, corpo: { codigo: "CONVITE_NAO_ENCONTRADO" } });
  });

  it("usuário que não é o titular -> 403 NAO_TITULAR", async () => {
    expect(await confirmar(10, "intruso")).toMatchObject({ status: 403, corpo: { codigo: "NAO_TITULAR" } });
  });

  it("convite já confirmado -> 409 CONVITE_JA_RESPONDIDO", async () => {
    await confirmar(10, "ana");
    expect(await confirmar(10, "ana")).toMatchObject({ status: 409, corpo: { codigo: "CONVITE_JA_RESPONDIDO" } });
  });

  it("convite fora da vigência -> 422 CONVITE_EXPIRADO", async () => {
    expect(await confirmar(14, "elisa")).toMatchObject({ status: 422, corpo: { codigo: "CONVITE_EXPIRADO" } });
  });

  it("evento lotado -> 409 SEM_VAGAS e o ingresso continua PENDENTE", async () => {
    expect(await confirmar(21, "gustavo")).toMatchObject({ status: 409, corpo: { codigo: "SEM_VAGAS" } });
    expect((await consultar("?conviteId=21", "gustavo")).corpo.situacao).toBe("PENDENTE");
  });

  it("duas confirmações simultâneas pela última vaga -> uma 201 e uma 409 SEM_VAGAS", async () => {
    // Evento 1: capacidade 3 e duas vagas ocupadas. Ana e Bruno disputam a última ao mesmo tempo.
    const [a, b] = await Promise.all([confirmar(10, "ana"), confirmar(11, "bruno")]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find((r) => r.status === 409)?.corpo.codigo).toBe("SEM_VAGAS");
    expect((await saldo(1)).corpo).toMatchObject({ capacidade: 3, ocupadas: 3 });
  });

  it("a liberação da trilha falha -> 503 FALHA_DEPENDENCIA e a vaga volta ao saldo", async () => {
    const antes = (await saldo(5)).corpo.ocupadas;
    expect(await confirmar(50, "julia")).toMatchObject({ status: 503, corpo: { codigo: "FALHA_DEPENDENCIA" } });
    expect((await saldo(5)).corpo.ocupadas).toBe(antes);
    expect((await consultar("?conviteId=50", "julia")).corpo).toMatchObject({ situacao: "PENDENTE", qrValido: false });
    expect(c.publicador.publicados).toHaveLength(0);
  });

  it("Serviço de Vagas indisponível -> 503 FALHA_DEPENDENCIA", async () => {
    c.falhas.definir("vagas", true);
    expect(await confirmar(10, "ana")).toMatchObject({ status: 503, corpo: { codigo: "FALHA_DEPENDENCIA" } });
  });

  it("Convites indisponível -> 503 FALHA_DEPENDENCIA", async () => {
    c.falhas.definir("convites", true);
    expect(await confirmar(10, "ana")).toMatchObject({ status: 503, corpo: { codigo: "FALHA_DEPENDENCIA" } });
  });

  it("falha no envio do e-mail não desfaz a confirmação", async () => {
    c.falhas.definir("notificacao", true);
    expect((await confirmar(10, "ana")).status).toBe(201);
    expect((await consultar("?conviteId=10", "ana")).corpo.situacao).toBe("CONFIRMADO");
  });
});

// ===================================================================== recusarConvite
describe("recusarConvite - POST /convites/{conviteId}/recusa", () => {
  it("titular recusa -> 200 RECUSADO, sem QR Code e sem ocupar vaga", async () => {
    const r = await recusar(11, "bruno");
    expect(r).toEqual({ status: 200, corpo: { ingressoId: 101, conviteId: 11, situacao: "RECUSADO" } });
    const consulta = await consultar("?conviteId=11", "bruno");
    expect(consulta.corpo.qrCode).toBeUndefined();
    expect(consulta.corpo.qrValido).toBe(false);
    expect((await saldo(1)).corpo.ocupadas).toBe(2);
    expect(c.publicador.publicados.map((e) => e.tipo)).toEqual(["ConviteRecusado"]);
  });

  it("recusa é definitiva: confirmar depois -> 409 CONVITE_JA_RESPONDIDO", async () => {
    await recusar(11, "bruno");
    expect(await confirmar(11, "bruno")).toMatchObject({ status: 409, corpo: { codigo: "CONVITE_JA_RESPONDIDO" } });
  });

  it("não titular -> 403; expirado -> 422; já confirmado -> 409", async () => {
    expect((await recusar(11, "intruso")).corpo.codigo).toBe("NAO_TITULAR");
    expect((await recusar(14, "elisa")).corpo.codigo).toBe("CONVITE_EXPIRADO");
    expect((await recusar(12, "carla")).corpo.codigo).toBe("CONVITE_JA_RESPONDIDO");
  });
});

// ===================================================================== registrarDesistencia
describe("registrarDesistencia - POST /convites/{conviteId}/desistencia", () => {
  it("titular confirmado desiste -> 200 DESISTENTE, QR Code invalidado e vaga liberada", async () => {
    const r = await desistir(12, "carla");
    expect(r).toEqual({ status: 200, corpo: { ingressoId: 102, situacao: "DESISTENTE" } });
    expect((await consultar("?qrCode=EVT-C12A0001", "portaria")).corpo).toMatchObject({
      situacao: "DESISTENTE",
      qrValido: false,
    });
    expect((await saldo(1)).corpo.ocupadas).toBe(1);
    expect(c.publicador.publicados.map((e) => e.tipo)).toEqual(["DesistenciaRegistrada"]);
  });

  it("vaga liberada pela desistência pode ser usada por outro convidado", async () => {
    await confirmar(10, "ana"); // ocupa a última vaga
    expect((await confirmar(11, "bruno")).corpo.codigo).toBe("SEM_VAGAS");
    await desistir(12, "carla");
    expect((await confirmar(11, "bruno")).status).toBe(201);
  });

  it("sem ingresso confirmado -> 409 SEM_INGRESSO_CONFIRMADO", async () => {
    expect(await desistir(10, "ana")).toMatchObject({ status: 409, corpo: { codigo: "SEM_INGRESSO_CONFIRMADO" } });
  });

  it("evento já iniciado -> 422 EVENTO_INICIADO", async () => {
    expect(await desistir(30, "helena")).toMatchObject({ status: 422, corpo: { codigo: "EVENTO_INICIADO" } });
  });

  it("Serviço de Vagas indisponível -> 503 e a desistência não é registrada", async () => {
    c.falhas.definir("vagas", true);
    expect((await desistir(12, "carla")).status).toBe(503);
    c.falhas.definir("vagas", false);
    expect((await consultar("?conviteId=12", "carla")).corpo.situacao).toBe("CONFIRMADO");
  });

  it("não titular -> 403 NAO_TITULAR", async () => {
    expect((await desistir(12, "intruso")).corpo.codigo).toBe("NAO_TITULAR");
  });
});

// ===================================================================== transferirConvite
describe("transferirConvite - POST /convites/{conviteId}/transferencia", () => {
  it("transfere -> 200 TRANSFERIDO, novo convite e vaga reservada ao substituto", async () => {
    const r = await transferir(13, "diego", SUBSTITUTA);
    expect(r).toEqual({ status: 200, corpo: { ingressoId: 103, situacao: "TRANSFERIDO", novoConviteId: 1000 } });
    expect((await consultar("?qrCode=EVT-D13B0002", "portaria")).corpo).toMatchObject({
      situacao: "TRANSFERIDO",
      qrValido: false,
    });
    expect((await saldo(1)).corpo).toMatchObject({ ocupadas: 1, reservadas: 1, disponiveis: 1 });
    expect((await consultar("?conviteId=1000", "maria")).corpo).toMatchObject({ situacao: "PENDENTE" });
    expect(c.publicador.publicados.map((e) => e.tipo)).toEqual(["ConviteTransferido"]);
    expect(c.notificacao.enviados[0].para).toBe("maria.souza@empresa.com");
  });

  it("substituto não encontra o evento lotado: confirma consumindo a vaga reservada", async () => {
    await transferir(13, "diego", SUBSTITUTA);
    await confirmar(10, "ana"); // ocupa a última vaga livre
    expect((await confirmar(11, "bruno")).corpo.codigo).toBe("SEM_VAGAS");
    const r = await confirmar(1000, "maria");
    expect(r.status).toBe(201);
    expect((await saldo(1)).corpo).toMatchObject({ ocupadas: 3, reservadas: 0, disponiveis: 0 });
  });

  it("substituto recusa -> a vaga reservada é liberada", async () => {
    await transferir(13, "diego", SUBSTITUTA);
    await recusar(1000, "maria");
    expect((await saldo(1)).corpo).toMatchObject({ ocupadas: 1, reservadas: 0, disponiveis: 2 });
  });

  it("dados do substituto inválidos -> 400 DADOS_INVALIDOS", async () => {
    const emailRuim = { dadosSubstituto: { nome: "Maria", email: "maria-sem-arroba" } };
    expect(await transferir(13, "diego", emailRuim)).toMatchObject({ status: 400, corpo: { codigo: "DADOS_INVALIDOS" } });
    expect((await transferir(13, "diego", {})).corpo.codigo).toBe("DADOS_INVALIDOS");
    expect((await transferir(13, "diego", "{ json quebrado")).corpo.codigo).toBe("DADOS_INVALIDOS");
  });

  it("sem ingresso confirmado -> 409; evento iniciado -> 422; regra não permite -> 422", async () => {
    expect((await transferir(10, "ana", SUBSTITUTA)).corpo.codigo).toBe("SEM_INGRESSO_CONFIRMADO");
    expect((await transferir(30, "helena", SUBSTITUTA)).corpo.codigo).toBe("EVENTO_INICIADO");
    expect(await transferir(40, "igor", SUBSTITUTA)).toMatchObject({
      status: 422,
      corpo: { codigo: "TRANSFERENCIA_NAO_PERMITIDA" },
    });
  });

  it("substituto já convidado no evento -> 409 SUBSTITUTO_JA_CONVIDADO", async () => {
    const ana = { dadosSubstituto: { nome: "Ana Lima", email: "ana@evently.test" } };
    expect(await transferir(13, "diego", ana)).toMatchObject({ status: 409, corpo: { codigo: "SUBSTITUTO_JA_CONVIDADO" } });
  });

  it("transferência da vaga falha -> 503 e tudo é desfeito (convite do substituto cancelado)", async () => {
    c.falhas.definir("vagas", true);
    expect((await transferir(13, "diego", SUBSTITUTA)).status).toBe(503);
    c.falhas.definir("vagas", false);
    expect((await consultar("?conviteId=13", "diego")).corpo.situacao).toBe("CONFIRMADO");
    expect(await c.convites.consultarConvite(1000)).toBeNull();
    expect((await saldo(1)).corpo).toMatchObject({ ocupadas: 2, reservadas: 0 });
  });

  it("não titular -> 403 NAO_TITULAR", async () => {
    expect((await transferir(13, "intruso", SUBSTITUTA)).corpo.codigo).toBe("NAO_TITULAR");
  });
});

// ===================================================================== consultarIngresso
describe("consultarIngresso - GET /ingressos", () => {
  it("portaria consulta por qrCode -> 200 com qrValido verdadeiro", async () => {
    const r = await consultar("?qrCode=EVT-C12A0001", "portaria");
    expect(r).toEqual({
      status: 200,
      corpo: {
        ingressoId: 102,
        conviteId: 12,
        eventoId: 1,
        participante: { nome: "Carla Dias", email: "carla@evently.test" },
        situacao: "CONFIRMADO",
        qrCode: "EVT-C12A0001",
        qrValido: true,
      },
    });
  });

  it("organizador do evento consulta por conviteId; titular consulta por ingressoId", async () => {
    expect((await consultar("?conviteId=10", "organizador")).corpo).toMatchObject({ situacao: "PENDENTE", qrValido: false });
    const r = await json(await ingressoPorId.GET(await req("GET", "/ingressos/102", "carla"), p({ ingressoId: "102" })));
    expect(r).toMatchObject({ status: 200, corpo: { ingressoId: 102, situacao: "CONFIRMADO" } });
  });

  it("nenhum ou mais de um identificador -> 400 DADOS_INVALIDOS", async () => {
    expect(await consultar("", "portaria")).toMatchObject({ status: 400, corpo: { codigo: "DADOS_INVALIDOS" } });
    expect((await consultar("?conviteId=10&qrCode=EVT-C12A0001", "portaria")).corpo.codigo).toBe("DADOS_INVALIDOS");
  });

  it("identificador sem ingresso -> 404 INGRESSO_NAO_ENCONTRADO", async () => {
    expect(await consultar("?qrCode=EVT-NAOEXISTE", "portaria")).toMatchObject({
      status: 404,
      corpo: { codigo: "INGRESSO_NAO_ENCONTRADO" },
    });
  });

  it("usuário sem permissão -> 403 ACESSO_NEGADO (outro convidado e organizador de outro evento)", async () => {
    expect(await consultar("?conviteId=12", "intruso")).toMatchObject({ status: 403, corpo: { codigo: "ACESSO_NEGADO" } });
    expect((await consultar("?conviteId=12", "outroOrganizador")).corpo.codigo).toBe("ACESSO_NEGADO");
  });
});
