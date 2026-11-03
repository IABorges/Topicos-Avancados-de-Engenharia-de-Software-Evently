// GET /ingressos/{ingressoId} -> consultarIngresso
import { tratar, type Contexto } from "../../../src/http/respostas";

export async function GET(request: Request, { params }: Contexto<{ ingressoId: string }>) {
  const { ingressoId } = await params;
  const busca = new URL(request.url).searchParams;
  return tratar(request, (usuario, c) =>
    // Um identificador no caminho somado a outro na query também é DADOS_INVALIDOS (400).
    c.servico.consultarIngresso(usuario, {
      ingressoId,
      conviteId: busca.get("conviteId"),
      qrCode: busca.get("qrCode"),
    }),
  );
}
