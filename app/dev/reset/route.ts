// POST /dev/reset -> recria a massa de dados (somente fora de produção)
import { reiniciarContainer } from "../../../src/container";
import { devHabilitado } from "../../../src/http/respostas";

export async function POST() {
  if (!devHabilitado()) return new Response(null, { status: 404 });
  reiniciarContainer();
  return Response.json({ mensagem: "Dados de demonstração recriados." });
}
