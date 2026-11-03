// Interfaces requeridas pelo Serviço de Ingressos (seção 3.4 do relatório).
// O domínio depende apenas destas interfaces; os adaptadores ficam em src/infra.

import type { Convite, Evento, EventoDominio, Ingresso, Participante } from "../dominio/tipos";

/** Convites (IEvento): consultarConvite, registrarConviteTransferido. */
export interface IConvites {
  consultarConvite(conviteId: number): Promise<Convite | null>;
  possuiConvite(eventoId: number, email: string): Promise<boolean>;
  registrarConviteTransferido(origem: Convite, substituto: Participante): Promise<Convite>;
  /** Compensação usada quando a transferência precisa ser desfeita. */
  cancelarConviteTransferido(conviteId: number): Promise<void>;
}

/** Gestão do Evento (IEvento): consultarEvento. */
export interface IEventos {
  consultarEvento(eventoId: number): Promise<Evento | null>;
}

export type OrigemReserva = "NOVA" | "RESERVA_TRANSFERENCIA";

export type ResultadoReserva =
  | { ok: true; origem: OrigemReserva }
  | { ok: false; motivo: "SEM_VAGAS" };

export interface SaldoVagas {
  eventoId: number;
  capacidade: number;
  ocupadas: number;
  reservadas: number;
  disponiveis: number;
}

/** Serviço de Vagas (IVagas): reservarVaga, liberarVaga, transferirVaga. */
export interface IVagas {
  reservarVaga(eventoId: number, conviteId: number): Promise<ResultadoReserva>;
  desfazerReserva(eventoId: number, conviteId: number, origem: OrigemReserva): Promise<void>;
  liberarVaga(eventoId: number, conviteId: number): Promise<void>;
  transferirVaga(eventoId: number, deConviteId: number, paraConviteId: number): Promise<void>;
  consultarSaldo(eventoId: number): Promise<SaldoVagas | null>;
}

/** Preparação do Convidado (IInformacaoEvento): liberarTrilhaPreparo. */
export interface IPreparacao {
  liberarTrilhaPreparo(eventoId: number, conviteId: number, participante: Participante): Promise<void>;
}

/** Comunicação (INotificacao): enviarEmailConvite. */
export interface INotificacao {
  enviarEmail(para: Participante, assunto: string, corpo: string): Promise<void>;
}

/** Publicação assíncrona de eventos de domínio para o Acompanhamento e Indicadores. */
export interface IPublicadorEventos {
  publicar(evento: EventoDominio): Promise<void>;
}

/** Persistência dos ingressos (dados próprios do contexto). */
export interface IIngressoRepositorio {
  obterPorId(id: number): Promise<Ingresso | null>;
  obterPorConvite(conviteId: number): Promise<Ingresso | null>;
  obterPorQrCode(qrCode: string): Promise<Ingresso | null>;
  criarPendente(convite: Convite): Promise<Ingresso>;
  salvar(ingresso: Ingresso): Promise<void>;
  qrCodeEmUso(qrCode: string): Promise<boolean>;
}
