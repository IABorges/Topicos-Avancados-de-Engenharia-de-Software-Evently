// GET / -> índice da API
export function GET() {
  return Response.json({
    servico: "Evently - Serviço de Ingressos (IIngresso)",
    operacoes: {
      confirmarPresenca: "POST /convites/{conviteId}/confirmacao",
      recusarConvite: "POST /convites/{conviteId}/recusa",
      registrarDesistencia: "POST /convites/{conviteId}/desistencia",
      transferirConvite: "POST /convites/{conviteId}/transferencia",
      consultarIngresso: ["GET /ingressos/{ingressoId}", "GET /ingressos?conviteId={id}", "GET /ingressos?qrCode={codigo}"],
      saldoDeVagas: "GET /eventos/{eventoId}/vagas",
    },
    autenticacao: "Authorization: Bearer <token JWT do Supabase Auth>",
  });
}
