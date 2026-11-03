// GET /eventos/{eventoId}/vagas -> Serviço de Vagas: saldo de vagas (consulta do organizador)
import { ErroNegocio } from "../../../../src/dominio/erros";
import { idDoCaminho, tratar, type Contexto } from "../../../../src/http/respostas";

export async function GET(request: Request, { params }: Contexto<{ eventoId: string }>) {
  const { eventoId } = await params;
  return tratar(request, async (usuario, c) => {
    const id = idDoCaminho(eventoId);
    const evento = Number.isNaN(id) ? null : await c.eventos.consultarEvento(id);
    if (!evento) throw new ErroNegocio("EVENTO_NAO_ENCONTRADO");
    if (!usuario.perfis.includes("ORGANIZADOR") || evento.organizadorId !== usuario.id) {
      throw new ErroNegocio("ACESSO_NEGADO");
    }
    return c.vagas.consultarSaldo(id);
  });
}
