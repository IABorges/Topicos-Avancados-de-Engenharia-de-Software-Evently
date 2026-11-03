// GET /ingressos?conviteId={id} | /ingressos?qrCode={codigo} -> consultarIngresso
import { tratar } from "../../src/http/respostas";

export async function GET(request: Request) {
  const busca = new URL(request.url).searchParams;
  return tratar(request, (usuario, c) =>
    c.servico.consultarIngresso(usuario, {
      ingressoId: busca.get("ingressoId"),
      conviteId: busca.get("conviteId"),
      qrCode: busca.get("qrCode"),
    }),
  );
}
