// Serviço de Ingressos (interface IIngresso).
// Implementa as cinco operações do contrato e suas regras de negócio.
// Não depende do Next.js: recebe as dependências por construtor (interfaces em src/portas).

import { randomBytes } from "node:crypto";
import { ErroNegocio } from "./erros";
import type { Convite, Evento, Ingresso, Participante, TipoEventoDominio, Usuario } from "./tipos";
import type {
  IConvites,
  IEventos,
  IIngressoRepositorio,
  INotificacao,
  IPreparacao,
  IPublicadorEventos,
  IVagas,
} from "../portas";

export interface DependenciasServicoIngressos {
  ingressos: IIngressoRepositorio;
  convites: IConvites;
  eventos: IEventos;
  vagas: IVagas;
  preparacao: IPreparacao;
  notificacao: INotificacao;
  publicador: IPublicadorEventos;
  agora?: () => Date;
  log?: (mensagem: string) => void;
}

export interface IngressoConfirmadoDTO {
  ingressoId: number;
  conviteId: number;
  situacao: "CONFIRMADO";
  qrCode: string;
  confirmadoEm: string;
}

export interface IngressoRecusadoDTO {
  ingressoId: number;
  conviteId: number;
  situacao: "RECUSADO";
}

export interface DesistenciaDTO {
  ingressoId: number;
  situacao: "DESISTENTE";
}

export interface TransferenciaDTO {
  ingressoId: number;
  situacao: "TRANSFERIDO";
  novoConviteId: number;
}

export interface ConsultaIngressoDTO {
  ingressoId: number;
  conviteId: number;
  eventoId: number;
  participante: Participante;
  situacao: Ingresso["situacao"];
  qrCode?: string;
  qrValido: boolean;
}

export interface FiltroConsulta {
  ingressoId?: string | null;
  conviteId?: string | null;
  qrCode?: string | null;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ServicoIngressos {
  private readonly d: DependenciasServicoIngressos;
  private readonly agora: () => Date;
  private readonly log: (mensagem: string) => void;
  /** Uma operação por convite por vez: evita que duas requisições simultâneas respondam o mesmo convite. */
  private readonly travas = new Map<number, Promise<unknown>>();

  constructor(dependencias: DependenciasServicoIngressos) {
    this.d = dependencias;
    this.agora = dependencias.agora ?? (() => new Date());
    this.log = dependencias.log ?? ((m) => console.log(m));
  }

  // ---------------------------------------------------------------- confirmarPresenca
  confirmarPresenca(usuario: Usuario, conviteId: number): Promise<IngressoConfirmadoDTO> {
    return this.comTrava(conviteId, () => this.confirmarPresencaSem(usuario, conviteId));
  }

  private async confirmarPresencaSem(usuario: Usuario, conviteId: number): Promise<IngressoConfirmadoDTO> {
    const convite = await this.obterConviteDoTitular(usuario, conviteId);
    const ingresso = await this.obterOuCriarIngresso(convite);

    if (ingresso.situacao !== "PENDENTE") throw new ErroNegocio("CONVITE_JA_RESPONDIDO");
    if (this.agora() > convite.vigenteAte) throw new ErroNegocio("CONVITE_EXPIRADO");

    // Reserva atômica no Serviço de Vagas (verifica o saldo e ocupa numa única operação).
    // Se o convite é de um substituto, consome a vaga reservada pela transferência.
    const reserva = await this.dependencia(() => this.d.vagas.reservarVaga(convite.eventoId, convite.id));
    if (!reserva.ok) throw new ErroNegocio("SEM_VAGAS");

    // Libera a trilha de preparo; se falhar, desfaz a reserva (a vaga volta ao estado anterior).
    try {
      await this.d.preparacao.liberarTrilhaPreparo(convite.eventoId, convite.id, convite.participante);
    } catch (erro) {
      await this.compensar("desfazer reserva de vaga", () =>
        this.d.vagas.desfazerReserva(convite.eventoId, convite.id, reserva.origem),
      );
      this.log(`[ingressos] liberação da trilha falhou para o convite ${convite.id}: ${mensagemDe(erro)}`);
      throw new ErroNegocio("FALHA_DEPENDENCIA", "A liberação da trilha de preparo falhou. A confirmação foi desfeita.");
    }

    // Só agora o ingresso é gerado, com QR Code único.
    const confirmadoEm = this.agora();
    ingresso.situacao = "CONFIRMADO";
    ingresso.qrCode = await this.gerarQrCodeUnico();
    ingresso.confirmadoEm = confirmadoEm;
    ingresso.respondidoEm = confirmadoEm;
    await this.d.ingressos.salvar(ingresso);

    await this.publicar("IngressoConfirmado", {
      ingressoId: ingresso.id,
      conviteId: convite.id,
      eventoId: convite.eventoId,
    });
    // E-mail depois da operação concluída: a falha no envio não desfaz a confirmação.
    await this.enviarEmailSemDesfazer(
      convite.participante,
      "Presença confirmada",
      `Sua presença está confirmada. QR Code do ingresso: ${ingresso.qrCode}`,
    );

    return {
      ingressoId: ingresso.id,
      conviteId: convite.id,
      situacao: "CONFIRMADO",
      qrCode: ingresso.qrCode,
      confirmadoEm: confirmadoEm.toISOString(),
    };
  }

  // ---------------------------------------------------------------- recusarConvite
  recusarConvite(usuario: Usuario, conviteId: number): Promise<IngressoRecusadoDTO> {
    return this.comTrava(conviteId, () => this.recusarConviteSem(usuario, conviteId));
  }

  private async recusarConviteSem(usuario: Usuario, conviteId: number): Promise<IngressoRecusadoDTO> {
    const convite = await this.obterConviteDoTitular(usuario, conviteId);
    const ingresso = await this.obterOuCriarIngresso(convite);

    if (ingresso.situacao !== "PENDENTE") throw new ErroNegocio("CONVITE_JA_RESPONDIDO");
    if (this.agora() > convite.vigenteAte) throw new ErroNegocio("CONVITE_EXPIRADO");

    // Substituto que recusa: a vaga reservada pela transferência é liberada.
    if (convite.conviteOrigemId !== undefined) {
      await this.dependencia(() => this.d.vagas.liberarVaga(convite.eventoId, convite.id));
    }

    ingresso.situacao = "RECUSADO";
    ingresso.respondidoEm = this.agora();
    await this.d.ingressos.salvar(ingresso);

    await this.publicar("IngressoRecusado", {
      ingressoId: ingresso.id,
      conviteId: convite.id,
      eventoId: convite.eventoId,
    });

    return { ingressoId: ingresso.id, conviteId: convite.id, situacao: "RECUSADO" };
  }

  // ---------------------------------------------------------------- registrarDesistencia
  registrarDesistencia(usuario: Usuario, conviteId: number): Promise<DesistenciaDTO> {
    return this.comTrava(conviteId, () => this.registrarDesistenciaSem(usuario, conviteId));
  }

  private async registrarDesistenciaSem(usuario: Usuario, conviteId: number): Promise<DesistenciaDTO> {
    const convite = await this.obterConviteDoTitular(usuario, conviteId);
    const ingresso = await this.d.ingressos.obterPorConvite(convite.id);

    if (!ingresso || ingresso.situacao !== "CONFIRMADO") throw new ErroNegocio("SEM_INGRESSO_CONFIRMADO");

    const evento = await this.obterEvento(convite.eventoId);
    if (this.agora() >= evento.inicio) throw new ErroNegocio("EVENTO_INICIADO");

    // Se a liberação da vaga falhar, a desistência não é registrada (exceção sobe antes de salvar).
    await this.dependencia(() => this.d.vagas.liberarVaga(convite.eventoId, convite.id));

    ingresso.situacao = "DESISTENTE"; // o QR Code deixa de ser válido (qrValido = false)
    await this.d.ingressos.salvar(ingresso);

    await this.publicar("DesistenciaRegistrada", {
      ingressoId: ingresso.id,
      conviteId: convite.id,
      eventoId: convite.eventoId,
    });

    return { ingressoId: ingresso.id, situacao: "DESISTENTE" };
  }

  // ---------------------------------------------------------------- transferirConvite
  transferirConvite(usuario: Usuario, conviteId: number, corpo: unknown): Promise<TransferenciaDTO> {
    return this.comTrava(conviteId, () => this.transferirConviteSem(usuario, conviteId, corpo));
  }

  private async transferirConviteSem(usuario: Usuario, conviteId: number, corpo: unknown): Promise<TransferenciaDTO> {
    const substituto = validarSubstituto(corpo);
    const convite = await this.obterConviteDoTitular(usuario, conviteId);
    const ingresso = await this.d.ingressos.obterPorConvite(convite.id);

    if (!ingresso || ingresso.situacao !== "CONFIRMADO") throw new ErroNegocio("SEM_INGRESSO_CONFIRMADO");

    const evento = await this.obterEvento(convite.eventoId);
    if (this.agora() >= evento.inicio) throw new ErroNegocio("EVENTO_INICIADO");
    if (!evento.permiteTransferencia) throw new ErroNegocio("TRANSFERENCIA_NAO_PERMITIDA");
    // Lab 4: um ingresso recebido por transferência não pode ser transferido de novo.
    if (convite.conviteOrigemId !== undefined) {
      throw new ErroNegocio(
        "TRANSFERENCIA_NAO_PERMITIDA",
        "Um ingresso recebido por transferência não pode ser transferido novamente.",
      );
    }

    const jaConvidado =
      mesmoEmail(substituto.email, convite.participante.email) ||
      (await this.dependencia(() => this.d.convites.possuiConvite(evento.id, substituto.email)));
    if (jaConvidado) throw new ErroNegocio("SUBSTITUTO_JA_CONVIDADO");

    // Orquestração: novo convite em Convites -> vaga reservada ao substituto em Vagas.
    const novoConvite = await this.dependencia(() =>
      this.d.convites.registrarConviteTransferido(convite, substituto),
    );
    try {
      await this.d.vagas.transferirVaga(evento.id, convite.id, novoConvite.id);
    } catch (erro) {
      await this.compensar("cancelar convite do substituto", () =>
        this.d.convites.cancelarConviteTransferido(novoConvite.id),
      );
      this.log(`[ingressos] transferência da vaga falhou para o convite ${convite.id}: ${mensagemDe(erro)}`);
      throw new ErroNegocio("FALHA_DEPENDENCIA", "A transferência da vaga falhou. A transferência foi desfeita.");
    }

    ingresso.situacao = "TRANSFERIDO"; // QR Code original invalidado
    ingresso.novoConviteId = novoConvite.id;
    await this.d.ingressos.salvar(ingresso);
    // O ciclo recomeça para o substituto: ingresso PENDENTE ligado ao novo convite.
    await this.d.ingressos.criarPendente(novoConvite);

    await this.publicar("IngressoTransferido", {
      ingressoId: ingresso.id,
      conviteId: convite.id,
      novoConviteId: novoConvite.id,
      eventoId: evento.id,
    });
    await this.enviarEmailSemDesfazer(
      substituto,
      `Você recebeu um convite para ${evento.nome}`,
      `${convite.participante.nome} transferiu o ingresso para você. Convite nº ${novoConvite.id}.`,
    );

    return { ingressoId: ingresso.id, situacao: "TRANSFERIDO", novoConviteId: novoConvite.id };
  }

  // ---------------------------------------------------------------- consultarIngresso
  async consultarIngresso(usuario: Usuario, filtro: FiltroConsulta): Promise<ConsultaIngressoDTO> {
    const informados = (["ingressoId", "conviteId", "qrCode"] as const).filter(
      (chave) => filtro[chave] !== undefined && filtro[chave] !== null && String(filtro[chave]).trim() !== "",
    );
    if (informados.length !== 1) {
      throw new ErroNegocio("DADOS_INVALIDOS", "Informe exatamente um identificador: ingressoId, conviteId ou qrCode.");
    }

    let ingresso: Ingresso | null = null;
    if (filtro.ingressoId) {
      const id = paraInteiro(filtro.ingressoId);
      ingresso = id === null ? null : await this.d.ingressos.obterPorId(id);
    } else if (filtro.conviteId) {
      const id = paraInteiro(filtro.conviteId);
      ingresso = id === null ? null : await this.d.ingressos.obterPorConvite(id);
    } else if (filtro.qrCode) {
      ingresso = await this.d.ingressos.obterPorQrCode(filtro.qrCode.trim());
    }
    if (!ingresso) throw new ErroNegocio("INGRESSO_NAO_ENCONTRADO");

    if (!(await this.podeConsultar(usuario, ingresso))) throw new ErroNegocio("ACESSO_NEGADO");

    return {
      ingressoId: ingresso.id,
      conviteId: ingresso.conviteId,
      eventoId: ingresso.eventoId,
      participante: { ...ingresso.participante },
      situacao: ingresso.situacao,
      ...(ingresso.qrCode ? { qrCode: ingresso.qrCode } : {}),
      qrValido: ingresso.situacao === "CONFIRMADO",
    };
  }

  // ---------------------------------------------------------------- auxiliares

  private async comTrava<T>(conviteId: number, operacao: () => Promise<T>): Promise<T> {
    const anterior = this.travas.get(conviteId) ?? Promise.resolve();
    const atual = anterior.catch(() => undefined).then(operacao);
    this.travas.set(conviteId, atual);
    try {
      return await atual;
    } finally {
      if (this.travas.get(conviteId) === atual) this.travas.delete(conviteId);
    }
  }

  /** Busca o convite em Convites (404 se não existe) e confere se o usuário é o titular (403). */
  private async obterConviteDoTitular(usuario: Usuario, conviteId: number): Promise<Convite> {
    const convite = Number.isInteger(conviteId) && conviteId > 0
      ? await this.dependencia(() => this.d.convites.consultarConvite(conviteId))
      : null;
    if (!convite) throw new ErroNegocio("CONVITE_NAO_ENCONTRADO");
    if (!mesmoEmail(usuario.email, convite.participante.email)) throw new ErroNegocio("NAO_TITULAR");
    return convite;
  }

  private async obterOuCriarIngresso(convite: Convite): Promise<Ingresso> {
    return (await this.d.ingressos.obterPorConvite(convite.id)) ?? (await this.d.ingressos.criarPendente(convite));
  }

  private async obterEvento(eventoId: number): Promise<Evento> {
    const evento = await this.dependencia(() => this.d.eventos.consultarEvento(eventoId));
    if (!evento) throw new ErroNegocio("FALHA_DEPENDENCIA", "Gestão do Evento não retornou o evento do convite.");
    return evento;
  }

  private async podeConsultar(usuario: Usuario, ingresso: Ingresso): Promise<boolean> {
    if (mesmoEmail(usuario.email, ingresso.participante.email)) return true;
    if (usuario.perfis.includes("OPERADOR_PORTARIA")) return true;
    if (usuario.perfis.includes("ORGANIZADOR")) {
      const evento = await this.dependencia(() => this.d.eventos.consultarEvento(ingresso.eventoId));
      return evento?.organizadorId === usuario.id;
    }
    return false;
  }

  private async gerarQrCodeUnico(): Promise<string> {
    for (;;) {
      const codigo = `EVT-${randomBytes(4).toString("hex").toUpperCase()}`;
      if (!(await this.d.ingressos.qrCodeEmUso(codigo))) return codigo;
    }
  }

  /** Executa uma chamada a outro serviço; qualquer falha técnica vira FALHA_DEPENDENCIA (503). */
  private async dependencia<T>(chamada: () => Promise<T>): Promise<T> {
    try {
      return await chamada();
    } catch (erro) {
      if (ErroNegocio.eh(erro)) throw erro;
      this.log(`[ingressos] dependência indisponível: ${mensagemDe(erro)}`);
      throw new ErroNegocio("FALHA_DEPENDENCIA");
    }
  }

  private async compensar(descricao: string, acao: () => Promise<void>): Promise<void> {
    try {
      await acao();
    } catch (erro) {
      this.log(`[ingressos] ATENÇÃO: compensação "${descricao}" falhou: ${mensagemDe(erro)}`);
    }
  }

  private async publicar(tipo: TipoEventoDominio, dados: Record<string, unknown>): Promise<void> {
    try {
      await this.d.publicador.publicar({ tipo, ocorridoEm: this.agora().toISOString(), dados });
    } catch (erro) {
      // Coreografia: a publicação não bloqueia o fluxo do convidado.
      this.log(`[ingressos] falha ao publicar ${tipo}: ${mensagemDe(erro)}`);
    }
  }

  private async enviarEmailSemDesfazer(para: Participante, assunto: string, corpo: string): Promise<void> {
    try {
      await this.d.notificacao.enviarEmail(para, assunto, corpo);
    } catch (erro) {
      this.log(`[ingressos] e-mail para ${para.email} não enviado (operação mantida): ${mensagemDe(erro)}`);
    }
  }
}

function validarSubstituto(corpo: unknown): Participante {
  const dados = (corpo as { dadosSubstituto?: { nome?: unknown; email?: unknown } } | null)?.dadosSubstituto;
  const nome = typeof dados?.nome === "string" ? dados.nome.trim() : "";
  const email = typeof dados?.email === "string" ? dados.email.trim().toLowerCase() : "";
  if (!nome || !EMAIL_VALIDO.test(email)) {
    throw new ErroNegocio("DADOS_INVALIDOS", "Nome ou e-mail do substituto ausente ou inválido.");
  }
  return { nome, email };
}

function mesmoEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function paraInteiro(valor: string): number | null {
  return /^\d+$/.test(valor.trim()) ? Number(valor) : null;
}

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
