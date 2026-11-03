// Serviço de Vagas (interface IVagas): controla o saldo de vagas de cada evento
// frente à capacidade definida pela Gestão do Evento.
//
// A reserva é atômica: a verificação do saldo e a ocupação acontecem no mesmo trecho
// síncrono (sem await entre elas). Como o Node.js executa JavaScript em uma única thread,
// duas confirmações simultâneas nunca ocupam a mesma última vaga.

import type { IEventos, IVagas, OrigemReserva, ResultadoReserva, SaldoVagas } from "../portas";

type TipoVaga = "OCUPADA" | "RESERVADA"; // RESERVADA = guardada para o substituto de uma transferência

export class ServicoVagas implements IVagas {
  /** eventoId -> (conviteId -> tipo da vaga) */
  private readonly vagas = new Map<number, Map<number, TipoVaga>>();

  constructor(private readonly eventos: IEventos) {}

  async reservarVaga(eventoId: number, conviteId: number): Promise<ResultadoReserva> {
    const capacidade = await this.capacidade(eventoId);
    // ---- trecho atômico ----
    const doEvento = this.doEvento(eventoId);
    const atual = doEvento.get(conviteId);
    if (atual === "RESERVADA") {
      doEvento.set(conviteId, "OCUPADA");
      return { ok: true, origem: "RESERVA_TRANSFERENCIA" };
    }
    if (atual === "OCUPADA") return { ok: true, origem: "NOVA" };
    if (doEvento.size >= capacidade) return { ok: false, motivo: "SEM_VAGAS" };
    doEvento.set(conviteId, "OCUPADA");
    return { ok: true, origem: "NOVA" };
    // ---- fim do trecho atômico ----
  }

  async desfazerReserva(eventoId: number, conviteId: number, origem: OrigemReserva): Promise<void> {
    const doEvento = this.doEvento(eventoId);
    if (origem === "RESERVA_TRANSFERENCIA") doEvento.set(conviteId, "RESERVADA");
    else doEvento.delete(conviteId);
  }

  async liberarVaga(eventoId: number, conviteId: number): Promise<void> {
    this.doEvento(eventoId).delete(conviteId);
  }

  async transferirVaga(eventoId: number, deConviteId: number, paraConviteId: number): Promise<void> {
    const doEvento = this.doEvento(eventoId);
    if (!doEvento.has(deConviteId)) {
      throw new Error(`Convite ${deConviteId} não ocupa vaga no evento ${eventoId}.`);
    }
    // A vaga não é liberada: passa direto a ficar reservada para o convite do substituto.
    doEvento.delete(deConviteId);
    doEvento.set(paraConviteId, "RESERVADA");
  }

  async consultarSaldo(eventoId: number): Promise<SaldoVagas | null> {
    const evento = await this.eventos.consultarEvento(eventoId);
    if (!evento) return null;
    const tipos = [...this.doEvento(eventoId).values()];
    const ocupadas = tipos.filter((t) => t === "OCUPADA").length;
    const reservadas = tipos.filter((t) => t === "RESERVADA").length;
    return {
      eventoId,
      capacidade: evento.capacidade,
      ocupadas,
      reservadas,
      disponiveis: Math.max(0, evento.capacidade - ocupadas - reservadas),
    };
  }

  /** Usado na carga inicial de dados (ingressos já confirmados). */
  ocuparDiretamente(eventoId: number, conviteId: number): void {
    this.doEvento(eventoId).set(conviteId, "OCUPADA");
  }

  private async capacidade(eventoId: number): Promise<number> {
    const evento = await this.eventos.consultarEvento(eventoId);
    if (!evento) throw new Error(`Evento ${eventoId} não encontrado na Gestão do Evento.`);
    return evento.capacidade;
  }

  private doEvento(eventoId: number): Map<number, TipoVaga> {
    let mapa = this.vagas.get(eventoId);
    if (!mapa) {
      mapa = new Map();
      this.vagas.set(eventoId, mapa);
    }
    return mapa;
  }
}
