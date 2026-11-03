// GET /dev/eventos-publicados -> eventos de domínio publicados (evidência da comunicação assíncrona)
import { obterContainer } from "../../../src/container";
import { devHabilitado } from "../../../src/http/respostas";

export async function GET() {
  if (!devHabilitado()) return new Response(null, { status: 404 });
  return Response.json(obterContainer().publicador.publicados);
}
