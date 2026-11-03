// Erros de negócio previstos no contrato (seção 3.5 do relatório).
// Cada código tem um status HTTP fixo e uma mensagem padrão.

export const CATALOGO_ERROS = {
  DADOS_INVALIDOS: { status: 400, mensagem: "Os dados informados são inválidos." },
  NAO_AUTENTICADO: { status: 401, mensagem: "Token ausente ou inválido." },
  NAO_TITULAR: { status: 403, mensagem: "O usuário não é o titular do convite." },
  ACESSO_NEGADO: { status: 403, mensagem: "O usuário não tem permissão para consultar este recurso." },
  CONVITE_NAO_ENCONTRADO: { status: 404, mensagem: "Convite não encontrado." },
  INGRESSO_NAO_ENCONTRADO: { status: 404, mensagem: "Nenhum ingresso encontrado para o identificador informado." },
  EVENTO_NAO_ENCONTRADO: { status: 404, mensagem: "Evento não encontrado." },
  CONVITE_JA_RESPONDIDO: { status: 409, mensagem: "O convite já foi respondido." },
  SEM_VAGAS: { status: 409, mensagem: "O evento não tem vagas disponíveis." },
  SUBSTITUTO_JA_CONVIDADO: { status: 409, mensagem: "O substituto já tem convite neste evento." },
  SEM_INGRESSO_CONFIRMADO: { status: 409, mensagem: "Não há ingresso confirmado para este convite." },
  CONVITE_EXPIRADO: { status: 422, mensagem: "O convite está fora da vigência." },
  EVENTO_INICIADO: { status: 422, mensagem: "O evento já começou." },
  TRANSFERENCIA_NAO_PERMITIDA: { status: 422, mensagem: "A regra do evento não permite transferência." },
  FALHA_DEPENDENCIA: { status: 503, mensagem: "Um serviço necessário não respondeu. A operação foi desfeita." },
} as const;

export type CodigoErro = keyof typeof CATALOGO_ERROS;

const MARCA = Symbol.for("evently.ErroNegocio");

export class ErroNegocio extends Error {
  /**
   * Teste por marca em vez de `instanceof`: no `next dev` cada rota é empacotada separadamente,
   * então a classe que lança o erro (no container compartilhado) pode não ser a mesma da rota.
   */
  static eh(erro: unknown): erro is ErroNegocio {
    return typeof erro === "object" && erro !== null && (erro as Record<symbol, unknown>)[MARCA] === true;
  }

  readonly [MARCA] = true;
  readonly codigo: CodigoErro;
  readonly status: number;

  constructor(codigo: CodigoErro, mensagem?: string) {
    super(mensagem ?? CATALOGO_ERROS[codigo].mensagem);
    this.name = "ErroNegocio";
    this.codigo = codigo;
    this.status = CATALOGO_ERROS[codigo].status;
  }
}
