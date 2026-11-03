// POST /convites/{conviteId}/transferencia -> transferirConvite
import { idDoCaminho, lerJson, tratar, type Contexto } from "../../../../src/http/respostas";

export async function POST(request: Request, { params }: Contexto<{ conviteId: string }>) {
  const { conviteId } = await params;
  return tratar(request, async (usuario, c) =>
    c.servico.transferirConvite(usuario, idDoCaminho(conviteId), await lerJson(request)),
  );
}
