// Composição: monta o Serviço de Ingressos com seus adaptadores.
// Guardado em globalThis para sobreviver ao recarregamento de módulos do `next dev`.

import { ServicoIngressos } from "./dominio/ServicoIngressos";
import { ServicoVagas } from "./dominio/ServicoVagas";
import {
  ConvitesEmMemoria,
  EventosEmMemoria,
  IngressoRepositorioEmMemoria,
  NotificacaoConsole,
  PreparacaoEmMemoria,
  PublicadorEmMemoria,
  SimuladorFalhas,
  VagasComFalhaSimulada,
} from "./infra/memoria/adaptadores";
import { gerarDadosIniciais } from "./infra/memoria/dadosIniciais";

export interface Container {
  servico: ServicoIngressos;
  vagas: VagasComFalhaSimulada;
  eventos: EventosEmMemoria;
  convites: ConvitesEmMemoria;
  ingressos: IngressoRepositorioEmMemoria;
  preparacao: PreparacaoEmMemoria;
  notificacao: NotificacaoConsole;
  publicador: PublicadorEmMemoria;
  falhas: SimuladorFalhas;
}

export interface OpcoesContainer {
  agora?: () => Date;
  log?: (mensagem: string) => void;
}

export function criarContainer(opcoes: OpcoesContainer = {}): Container {
  const agora = opcoes.agora ?? (() => new Date());
  const log = opcoes.log ?? ((m: string) => console.log(m));

  const falhas = new SimuladorFalhas();
  const eventos = new EventosEmMemoria(falhas);
  const convites = new ConvitesEmMemoria(falhas, eventos);
  const servicoVagas = new ServicoVagas(eventos);
  const vagas = new VagasComFalhaSimulada(servicoVagas, falhas);
  const ingressos = new IngressoRepositorioEmMemoria();
  const preparacao = new PreparacaoEmMemoria(falhas);
  const notificacao = new NotificacaoConsole(falhas, log);
  const publicador = new PublicadorEmMemoria();

  // Carga inicial
  const dados = gerarDadosIniciais(agora());
  dados.eventos.forEach((e) => eventos.adicionar(e));
  dados.eventosComFalhaNaTrilha.forEach((id) => falhas.eventosComFalhaNaTrilha.add(id));
  for (const { qrCodeConfirmado, ...convite } of dados.convites) {
    convites.adicionar(convite);
    // Cada convite emitido tem um ingresso PENDENTE (criação síncrona aqui; no sistema real,
    // a partir da emissão do convite no contexto Convites).
    ingressos.semear(convite, qrCodeConfirmado, agora());
    if (qrCodeConfirmado) servicoVagas.ocuparDiretamente(convite.eventoId, convite.id);
  }

  const servico = new ServicoIngressos({
    ingressos,
    convites,
    eventos,
    vagas,
    preparacao,
    notificacao,
    publicador,
    agora,
    log,
  });

  return { servico, vagas, eventos, convites, ingressos, preparacao, notificacao, publicador, falhas };
}

const global = globalThis as unknown as { __eventlyContainer?: Container };

export function obterContainer(): Container {
  global.__eventlyContainer ??= criarContainer();
  return global.__eventlyContainer;
}

/** Recria o container com os dados iniciais (usado pelos testes e por POST /dev/reset). */
export function reiniciarContainer(opcoes: OpcoesContainer = {}): Container {
  global.__eventlyContainer = criarContainer(opcoes);
  return global.__eventlyContainer;
}
