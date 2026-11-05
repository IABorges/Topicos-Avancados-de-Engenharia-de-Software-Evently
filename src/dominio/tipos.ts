// Tipos do Bounded Context Ingresso e dos dados que ele lê de outros contextos.

export type SituacaoIngresso =
  | "PENDENTE"
  | "CONFIRMADO"
  | "RECUSADO"
  | "DESISTENTE"
  | "TRANSFERIDO";

export type Perfil = "CONVIDADO" | "ORGANIZADOR" | "OPERADOR_PORTARIA";

export interface Participante {
  nome: string;
  email: string;
}

/** Usuário autenticado, extraído do token JWT emitido pelo Supabase Auth (Identidade e Acesso). */
export interface Usuario {
  id: string;
  email: string;
  perfis: Perfil[];
}

/** Ingresso: entidade própria deste contexto. */
export interface Ingresso {
  id: number;
  conviteId: number;
  eventoId: number;
  participante: Participante;
  situacao: SituacaoIngresso;
  qrCode?: string;
  confirmadoEm?: Date;
  respondidoEm?: Date;
  novoConviteId?: number;
}

/** Convite: pertence ao contexto Convites; o Ingresso apenas consulta. */
export interface Convite {
  id: number;
  eventoId: number;
  participante: Participante;
  vigenteAte: Date;
  conviteOrigemId?: number;
}

/** Evento: pertence ao contexto Gestão do Evento; o Ingresso apenas consulta. */
export interface Evento {
  id: number;
  nome: string;
  inicio: Date;
  capacidade: number;
  permiteTransferencia: boolean;
  organizadorId: string;
}

export type TipoEventoDominio =
  | "IngressoConfirmado"
  | "IngressoRecusado"
  | "DesistenciaRegistrada"
  | "IngressoTransferido";

export interface EventoDominio {
  tipo: TipoEventoDominio;
  ocorridoEm: string;
  dados: Record<string, unknown>;
}
