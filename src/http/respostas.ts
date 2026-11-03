// Camada HTTP: autenticação, conversão de erros no formato do contrato e respostas JSON.

import { ErroNegocio } from "../dominio/erros";
import type { Usuario } from "../dominio/tipos";
import { autenticar } from "../infra/auth/jwt";
import { obterContainer, type Container } from "../container";

export type Contexto<P> = { params: Promise<P> };

/** Executa uma operação autenticada e converte o resultado (ou erro) em resposta JSON. */
export async function tratar(
  request: Request,
  operacao: (usuario: Usuario, container: Container) => Promise<unknown>,
  statusSucesso = 200,
): Promise<Response> {
  try {
    const usuario = await autenticar(request.headers.get("authorization"));
    const resultado = await operacao(usuario, obterContainer());
    return Response.json(resultado, { status: statusSucesso });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export function respostaDeErro(erro: unknown): Response {
  if (ErroNegocio.eh(erro)) {
    return Response.json({ codigo: erro.codigo, mensagem: erro.message }, { status: erro.status });
  }
  console.error("[ingressos] erro inesperado", erro);
  return Response.json({ codigo: "ERRO_INTERNO", mensagem: "Erro inesperado no servidor." }, { status: 500 });
}

/** Lê o corpo JSON; corpo ausente ou malformado vira DADOS_INVALIDOS (400). */
export async function lerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ErroNegocio("DADOS_INVALIDOS", "O corpo da requisição deve ser um JSON válido.");
  }
}

export function idDoCaminho(valor: string): number {
  return /^\d+$/.test(valor) ? Number(valor) : NaN;
}

/** Rotas /dev/* só existem fora de produção. */
export function devHabilitado(): boolean {
  return process.env.NODE_ENV !== "production";
}
