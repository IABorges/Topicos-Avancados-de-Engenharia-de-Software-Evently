// Roteiro de testes da API, executado em sequência após POST /dev/reset.
// Usado por scripts/testar-api.ts (execução contra o servidor) e scripts/gerar-postman.ts (coleção Postman).

export interface Cenario {
  nome: string;
  metodo: "GET" | "POST";
  caminho: string;
  usuario?: string; // chave em USUARIOS_TESTE; ausente = sem token
  corpo?: unknown;
  esperado: { status: number; codigo?: string; campos?: Record<string, unknown> };
}

const SUBSTITUTA = { dadosSubstituto: { nome: "Maria Souza", email: "maria.souza@empresa.com" } };

export const CENARIOS: Cenario[] = [
  // confirmarPresenca
  { nome: "01 confirmarPresenca - sucesso", metodo: "POST", caminho: "/convites/10/confirmacao", usuario: "ana",
    esperado: { status: 201, campos: { conviteId: 10, situacao: "CONFIRMADO" } } },
  { nome: "02 confirmarPresenca - convite já respondido", metodo: "POST", caminho: "/convites/10/confirmacao", usuario: "ana",
    esperado: { status: 409, codigo: "CONVITE_JA_RESPONDIDO" } },
  { nome: "03 confirmarPresenca - sem token", metodo: "POST", caminho: "/convites/11/confirmacao",
    esperado: { status: 401, codigo: "NAO_AUTENTICADO" } },
  { nome: "04 confirmarPresenca - convite inexistente", metodo: "POST", caminho: "/convites/999/confirmacao", usuario: "ana",
    esperado: { status: 404, codigo: "CONVITE_NAO_ENCONTRADO" } },
  { nome: "05 confirmarPresenca - usuário não é o titular", metodo: "POST", caminho: "/convites/11/confirmacao", usuario: "intruso",
    esperado: { status: 403, codigo: "NAO_TITULAR" } },
  { nome: "06 confirmarPresenca - convite expirado", metodo: "POST", caminho: "/convites/14/confirmacao", usuario: "elisa",
    esperado: { status: 422, codigo: "CONVITE_EXPIRADO" } },
  { nome: "07 confirmarPresenca - evento sem vagas", metodo: "POST", caminho: "/convites/21/confirmacao", usuario: "gustavo",
    esperado: { status: 409, codigo: "SEM_VAGAS" } },
  { nome: "08 confirmarPresenca - falha na trilha (desfeita)", metodo: "POST", caminho: "/convites/50/confirmacao", usuario: "julia",
    esperado: { status: 503, codigo: "FALHA_DEPENDENCIA" } },
  // recusarConvite
  { nome: "09 recusarConvite - sucesso", metodo: "POST", caminho: "/convites/11/recusa", usuario: "bruno",
    esperado: { status: 200, campos: { conviteId: 11, situacao: "RECUSADO" } } },
  // registrarDesistencia
  { nome: "10 registrarDesistencia - sucesso", metodo: "POST", caminho: "/convites/12/desistencia", usuario: "carla",
    esperado: { status: 200, campos: { situacao: "DESISTENTE" } } },
  { nome: "11 registrarDesistencia - evento já iniciado", metodo: "POST", caminho: "/convites/30/desistencia", usuario: "helena",
    esperado: { status: 422, codigo: "EVENTO_INICIADO" } },
  { nome: "12 registrarDesistencia - sem ingresso confirmado", metodo: "POST", caminho: "/convites/11/desistencia", usuario: "bruno",
    esperado: { status: 409, codigo: "SEM_INGRESSO_CONFIRMADO" } },
  // transferirConvite
  { nome: "13 transferirConvite - dados do substituto inválidos", metodo: "POST", caminho: "/convites/13/transferencia", usuario: "diego",
    corpo: { dadosSubstituto: { nome: "", email: "email-invalido" } }, esperado: { status: 400, codigo: "DADOS_INVALIDOS" } },
  { nome: "14 transferirConvite - substituto já convidado", metodo: "POST", caminho: "/convites/13/transferencia", usuario: "diego",
    corpo: { dadosSubstituto: { nome: "Ana Lima", email: "ana@evently.test" } }, esperado: { status: 409, codigo: "SUBSTITUTO_JA_CONVIDADO" } },
  { nome: "15 transferirConvite - sucesso", metodo: "POST", caminho: "/convites/13/transferencia", usuario: "diego",
    corpo: SUBSTITUTA, esperado: { status: 200, campos: { situacao: "TRANSFERIDO", novoConviteId: 1000 } } },
  { nome: "16 transferirConvite - não permitida pelo evento", metodo: "POST", caminho: "/convites/40/transferencia", usuario: "igor",
    corpo: SUBSTITUTA, esperado: { status: 422, codigo: "TRANSFERENCIA_NAO_PERMITIDA" } },
  { nome: "17 confirmarPresenca - substituto usa a vaga reservada", metodo: "POST", caminho: "/convites/1000/confirmacao", usuario: "maria",
    esperado: { status: 201, campos: { conviteId: 1000, situacao: "CONFIRMADO" } } },
  { nome: "18 transferirConvite - ingresso recebido por transferência", metodo: "POST", caminho: "/convites/1000/transferencia", usuario: "maria",
    corpo: { dadosSubstituto: { nome: "Paulo Lima", email: "paulo.lima@empresa.com" } },
    esperado: { status: 422, codigo: "TRANSFERENCIA_NAO_PERMITIDA" } },
  // consultarIngresso
  { nome: "19 consultarIngresso - portaria por qrCode (desistente, QR inválido)", metodo: "GET", caminho: "/ingressos?qrCode=EVT-C12A0001", usuario: "portaria",
    esperado: { status: 200, campos: { situacao: "DESISTENTE", qrValido: false } } },
  { nome: "20 consultarIngresso - organizador por conviteId", metodo: "GET", caminho: "/ingressos?conviteId=10", usuario: "organizador",
    esperado: { status: 200, campos: { situacao: "CONFIRMADO", qrValido: true } } },
  { nome: "21 consultarIngresso - titular por ingressoId", metodo: "GET", caminho: "/ingressos/101", usuario: "bruno",
    esperado: { status: 200, campos: { situacao: "RECUSADO", qrValido: false } } },
  { nome: "22 consultarIngresso - nenhum identificador", metodo: "GET", caminho: "/ingressos", usuario: "portaria",
    esperado: { status: 400, codigo: "DADOS_INVALIDOS" } },
  { nome: "23 consultarIngresso - QR Code inexistente", metodo: "GET", caminho: "/ingressos?qrCode=EVT-NAOEXISTE", usuario: "portaria",
    esperado: { status: 404, codigo: "INGRESSO_NAO_ENCONTRADO" } },
  { nome: "24 consultarIngresso - usuário sem permissão", metodo: "GET", caminho: "/ingressos?conviteId=10", usuario: "intruso",
    esperado: { status: 403, codigo: "ACESSO_NEGADO" } },
  // Serviço de Vagas e eventos publicados
  { nome: "25 saldo de vagas do evento 1 (organizador)", metodo: "GET", caminho: "/eventos/1/vagas", usuario: "organizador",
    esperado: { status: 200, campos: { capacidade: 3, ocupadas: 2, reservadas: 0, disponiveis: 1 } } },
  { nome: "26 eventos de domínio publicados (assíncrono)", metodo: "GET", caminho: "/dev/eventos-publicados",
    esperado: { status: 200 } },
];
