// POST /convites/{conviteId}/confirmacao -> confirmarPresenca
import { idDoCaminho, tratar, type Contexto } from "../../../../src/http/respostas";

export async function POST(request: Request, { params }: Contexto<{ conviteId: string }>) {
  const { conviteId } = await params;
  return tratar(request, (usuario, c) => c.servico.confirmarPresenca(usuario, idDoCaminho(conviteId)), 201);
}
