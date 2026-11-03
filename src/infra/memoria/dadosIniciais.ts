// Massa de dados de demonstração. As datas são relativas ao momento em que o servidor sobe,
// para que os cenários (vigente, expirado, evento iniciado) continuem válidos em qualquer dia.

import type { Convite, Evento, Participante } from "../../dominio/tipos";

const DIA = 24 * 60 * 60 * 1000;

export const ORGANIZADOR_ID = "org-1";

export interface ConviteInicial extends Convite {
  /** Se informado, o ingresso já começa CONFIRMADO com este QR Code (vaga ocupada). */
  qrCodeConfirmado?: string;
}

export interface DadosIniciais {
  eventos: Evento[];
  convites: ConviteInicial[];
  eventosComFalhaNaTrilha: number[];
}

const p = (nome: string, usuario: string): Participante => ({ nome, email: `${usuario}@evently.test` });

export function gerarDadosIniciais(agora: Date): DadosIniciais {
  const em = (dias: number) => new Date(agora.getTime() + dias * DIA);
  const base = { organizadorId: ORGANIZADOR_ID };

  const eventos: Evento[] = [
    { id: 1, nome: "Workshop de Arquitetura de Software", inicio: em(30), capacidade: 3, permiteTransferencia: true, ...base },
    { id: 2, nome: "Palestra Lotada", inicio: em(30), capacidade: 1, permiteTransferencia: true, ...base },
    { id: 3, nome: "Meetup em Andamento", inicio: new Date(agora.getTime() - 60 * 60 * 1000), capacidade: 10, permiteTransferencia: true, ...base },
    { id: 4, nome: "Evento sem Transferência", inicio: em(30), capacidade: 10, permiteTransferencia: false, ...base },
    { id: 5, nome: "Evento com Trilha Indisponível", inicio: em(30), capacidade: 10, permiteTransferencia: true, ...base },
  ];

  const vigente = em(20);
  const convites: ConviteInicial[] = [
    // Evento 1 (capacidade 3; duas vagas já ocupadas por 12 e 13)
    { id: 10, eventoId: 1, participante: p("Ana Lima", "ana"), vigenteAte: vigente },
    { id: 11, eventoId: 1, participante: p("Bruno Alves", "bruno"), vigenteAte: vigente },
    { id: 12, eventoId: 1, participante: p("Carla Dias", "carla"), vigenteAte: vigente, qrCodeConfirmado: "EVT-C12A0001" },
    { id: 13, eventoId: 1, participante: p("Diego Rocha", "diego"), vigenteAte: vigente, qrCodeConfirmado: "EVT-D13B0002" },
    { id: 14, eventoId: 1, participante: p("Elisa Moura", "elisa"), vigenteAte: em(-1) },
    // Evento 2 (capacidade 1, já ocupada)
    { id: 20, eventoId: 2, participante: p("Fernanda Reis", "fernanda"), vigenteAte: vigente, qrCodeConfirmado: "EVT-F20C0003" },
    { id: 21, eventoId: 2, participante: p("Gustavo Nunes", "gustavo"), vigenteAte: vigente },
    // Evento 3 (já começou)
    { id: 30, eventoId: 3, participante: p("Helena Prado", "helena"), vigenteAte: em(-2), qrCodeConfirmado: "EVT-E30D0004" },
    // Evento 4 (não permite transferência)
    { id: 40, eventoId: 4, participante: p("Igor Campos", "igor"), vigenteAte: vigente, qrCodeConfirmado: "EVT-A40E0005" },
    // Evento 5 (Preparação do Convidado falha ao liberar a trilha)
    { id: 50, eventoId: 5, participante: p("Julia Torres", "julia"), vigenteAte: vigente },
  ];

  return { eventos, convites, eventosComFalhaNaTrilha: [5] };
}

/** Usuários de teste para gerar tokens (o e-mail identifica o titular do convite). */
export const USUARIOS_TESTE = [
  ...["ana", "bruno", "carla", "diego", "elisa", "gustavo", "helena", "igor", "julia", "intruso"].map((u) => ({
    chave: u,
    id: `user-${u}`,
    email: `${u}@evently.test`,
    perfis: ["CONVIDADO"],
  })),
  { chave: "maria", id: "user-maria", email: "maria.souza@empresa.com", perfis: ["CONVIDADO"] },
  { chave: "organizador", id: ORGANIZADOR_ID, email: "organizador@evently.test", perfis: ["ORGANIZADOR"] },
  { chave: "outroOrganizador", id: "org-2", email: "org2@evently.test", perfis: ["ORGANIZADOR"] },
  { chave: "portaria", id: "user-portaria", email: "portaria@evently.test", perfis: ["OPERADOR_PORTARIA"] },
];
