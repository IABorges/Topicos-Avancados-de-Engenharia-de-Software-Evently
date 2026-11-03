// Adaptadores em memória para os contextos vizinhos (Convites, Gestão do Evento,
// Preparação, Comunicação) e para a persistência dos ingressos.
// Substituem os serviços reais neste laboratório e permitem simular indisponibilidade
// para demonstrar o tratamento de FALHA_DEPENDENCIA (503).

import type { Convite, Evento, EventoDominio, Ingresso, Participante } from "../../dominio/tipos";
import type {
  IConvites,
  IEventos,
  IIngressoRepositorio,
  INotificacao,
  IPreparacao,
  IPublicadorEventos,
  IVagas,
  OrigemReserva,
} from "../../portas";

export type ServicoSimulavel = "convites" | "eventos" | "vagas" | "preparacao" | "notificacao";

/** Liga/desliga a indisponibilidade simulada de cada serviço consumido. */
export class SimuladorFalhas {
  private readonly indisponiveis = new Set<ServicoSimulavel>();
  /** Eventos em que a Preparação do Convidado falha ao liberar a trilha. */
  readonly eventosComFalhaNaTrilha = new Set<number>();

  definir(servico: ServicoSimulavel, indisponivel: boolean): void {
    if (indisponivel) this.indisponiveis.add(servico);
    else this.indisponiveis.delete(servico);
  }

  verificar(servico: ServicoSimulavel): void {
    if (this.indisponiveis.has(servico)) throw new Error(`Serviço ${servico} indisponível (simulado).`);
  }

  limpar(): void {
    this.indisponiveis.clear();
  }
}

export class ConvitesEmMemoria implements IConvites {
  private readonly convites = new Map<number, Convite>();
  private proximoId = 1000;

  constructor(
    private readonly falhas: SimuladorFalhas,
    private readonly eventos: EventosEmMemoria,
  ) {}

  adicionar(convite: Convite): void {
    this.convites.set(convite.id, convite);
  }

  async consultarConvite(conviteId: number): Promise<Convite | null> {
    this.falhas.verificar("convites");
    const convite = this.convites.get(conviteId);
    return convite ? { ...convite, participante: { ...convite.participante } } : null;
  }

  async possuiConvite(eventoId: number, email: string): Promise<boolean> {
    this.falhas.verificar("convites");
    const alvo = email.toLowerCase();
    return [...this.convites.values()].some(
      (c) => c.eventoId === eventoId && c.participante.email.toLowerCase() === alvo,
    );
  }

  async registrarConviteTransferido(origem: Convite, substituto: Participante): Promise<Convite> {
    this.falhas.verificar("convites");
    const evento = await this.eventos.consultarEvento(origem.eventoId);
    const novo: Convite = {
      id: this.proximoId++,
      eventoId: origem.eventoId,
      participante: { ...substituto },
      // Contrato de Convites (Lab 4): o convite do substituto vale até o início do evento.
      vigenteAte: evento ? evento.inicio : origem.vigenteAte,
      conviteOrigemId: origem.id,
    };
    this.convites.set(novo.id, novo);
    return { ...novo };
  }

  async cancelarConviteTransferido(conviteId: number): Promise<void> {
    this.convites.delete(conviteId);
  }
}

export class EventosEmMemoria implements IEventos {
  private readonly eventos = new Map<number, Evento>();

  constructor(private readonly falhas: SimuladorFalhas) {}

  adicionar(evento: Evento): void {
    this.eventos.set(evento.id, evento);
  }

  async consultarEvento(eventoId: number): Promise<Evento | null> {
    this.falhas.verificar("eventos");
    const evento = this.eventos.get(eventoId);
    return evento ? { ...evento } : null;
  }
}

/** Envolve o Serviço de Vagas para permitir simular sua indisponibilidade. */
export class VagasComFalhaSimulada implements IVagas {
  constructor(
    private readonly real: IVagas,
    private readonly falhas: SimuladorFalhas,
  ) {}

  async reservarVaga(eventoId: number, conviteId: number) {
    this.falhas.verificar("vagas");
    return this.real.reservarVaga(eventoId, conviteId);
  }
  async desfazerReserva(eventoId: number, conviteId: number, origem: OrigemReserva) {
    return this.real.desfazerReserva(eventoId, conviteId, origem);
  }
  async liberarVaga(eventoId: number, conviteId: number) {
    this.falhas.verificar("vagas");
    return this.real.liberarVaga(eventoId, conviteId);
  }
  async transferirVaga(eventoId: number, deConviteId: number, paraConviteId: number) {
    this.falhas.verificar("vagas");
    return this.real.transferirVaga(eventoId, deConviteId, paraConviteId);
  }
  async consultarSaldo(eventoId: number) {
    this.falhas.verificar("vagas");
    return this.real.consultarSaldo(eventoId);
  }
}

export class PreparacaoEmMemoria implements IPreparacao {
  readonly trilhasLiberadas: { eventoId: number; conviteId: number }[] = [];

  constructor(private readonly falhas: SimuladorFalhas) {}

  async liberarTrilhaPreparo(eventoId: number, conviteId: number): Promise<void> {
    this.falhas.verificar("preparacao");
    if (this.falhas.eventosComFalhaNaTrilha.has(eventoId)) {
      throw new Error(`Trilha de preparo do evento ${eventoId} não pôde ser liberada (simulado).`);
    }
    this.trilhasLiberadas.push({ eventoId, conviteId });
  }
}

/** Comunicação: registra o e-mail no console (em produção, Resend + React Email). */
export class NotificacaoConsole implements INotificacao {
  readonly enviados: { para: string; assunto: string }[] = [];

  constructor(
    private readonly falhas: SimuladorFalhas,
    private readonly log: (m: string) => void = (m) => console.log(m),
  ) {}

  async enviarEmail(para: Participante, assunto: string): Promise<void> {
    this.falhas.verificar("notificacao");
    this.enviados.push({ para: para.email, assunto });
    this.log(`[comunicacao] e-mail para ${para.email}: ${assunto}`);
  }
}

/** Publicador de eventos de domínio: guarda os eventos para o Acompanhamento e Indicadores. */
export class PublicadorEmMemoria implements IPublicadorEventos {
  readonly publicados: EventoDominio[] = [];

  async publicar(evento: EventoDominio): Promise<void> {
    this.publicados.push(evento);
  }
}

export class IngressoRepositorioEmMemoria implements IIngressoRepositorio {
  private readonly ingressos = new Map<number, Ingresso>();
  private proximoId = 100;

  /** Carga inicial síncrona: ingresso PENDENTE, ou CONFIRMADO quando há QR Code. */
  semear(convite: Convite, qrCodeConfirmado: string | undefined, quando: Date): void {
    const id = this.proximoId++;
    this.ingressos.set(id, {
      id,
      conviteId: convite.id,
      eventoId: convite.eventoId,
      participante: { ...convite.participante },
      situacao: qrCodeConfirmado ? "CONFIRMADO" : "PENDENTE",
      ...(qrCodeConfirmado ? { qrCode: qrCodeConfirmado, confirmadoEm: quando, respondidoEm: quando } : {}),
    });
  }

  async obterPorId(id: number): Promise<Ingresso | null> {
    return copiar(this.ingressos.get(id));
  }

  async obterPorConvite(conviteId: number): Promise<Ingresso | null> {
    return copiar([...this.ingressos.values()].find((i) => i.conviteId === conviteId));
  }

  async obterPorQrCode(qrCode: string): Promise<Ingresso | null> {
    return copiar([...this.ingressos.values()].find((i) => i.qrCode === qrCode));
  }

  async criarPendente(convite: Convite): Promise<Ingresso> {
    const existente = await this.obterPorConvite(convite.id);
    if (existente) return existente;
    const ingresso: Ingresso = {
      id: this.proximoId++,
      conviteId: convite.id,
      eventoId: convite.eventoId,
      participante: { ...convite.participante },
      situacao: "PENDENTE",
    };
    this.ingressos.set(ingresso.id, ingresso);
    return { ...ingresso, participante: { ...ingresso.participante } };
  }

  async salvar(ingresso: Ingresso): Promise<void> {
    this.ingressos.set(ingresso.id, { ...ingresso, participante: { ...ingresso.participante } });
  }

  async qrCodeEmUso(qrCode: string): Promise<boolean> {
    return [...this.ingressos.values()].some((i) => i.qrCode === qrCode);
  }
}

function copiar(ingresso: Ingresso | undefined): Ingresso | null {
  return ingresso ? { ...ingresso, participante: { ...ingresso.participante } } : null;
}
