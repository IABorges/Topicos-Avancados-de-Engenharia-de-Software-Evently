// Identidade e Acesso (IAutenticacao): validação do token JWT emitido pelo Supabase Auth.
// O Supabase assina os tokens de acesso com HS256 usando o "JWT Secret" do projeto;
// os perfis do Evently ficam em app_metadata.perfis.

import { jwtVerify, SignJWT } from "jose";
import { ErroNegocio } from "../../dominio/erros";
import type { Perfil, Usuario } from "../../dominio/tipos";

const SEGREDO_DESENVOLVIMENTO = "evently-segredo-de-desenvolvimento-nao-usar-em-producao";
const PERFIS_VALIDOS: Perfil[] = ["CONVIDADO", "ORGANIZADOR", "OPERADOR_PORTARIA"];

function segredo(): Uint8Array {
  const valor = process.env.SUPABASE_JWT_SECRET;
  if (!valor && process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_JWT_SECRET não configurado.");
  }
  return new TextEncoder().encode(valor || SEGREDO_DESENVOLVIMENTO);
}

/** Lê o cabeçalho Authorization: Bearer <token> e devolve o usuário autenticado (ou 401). */
export async function autenticar(cabecalho: string | null): Promise<Usuario> {
  const token = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new ErroNegocio("NAO_AUTENTICADO");

  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    const email = typeof payload.email === "string" ? payload.email : "";
    const brutos = (payload.app_metadata as { perfis?: unknown } | undefined)?.perfis;
    const perfis = (Array.isArray(brutos) ? brutos : []).filter((x): x is Perfil =>
      PERFIS_VALIDOS.includes(x as Perfil),
    );
    if (!payload.sub || !email) throw new Error("token sem sub ou email");
    return { id: payload.sub, email, perfis };
  } catch {
    throw new ErroNegocio("NAO_AUTENTICADO");
  }
}

/** Gera um token no mesmo formato do Supabase Auth (usado nos testes e no script de tokens). */
export async function gerarToken(
  usuario: { id: string; email: string; perfis: string[] },
  validade = "30d",
): Promise<string> {
  return new SignJWT({ email: usuario.email, role: "authenticated", app_metadata: { perfis: usuario.perfis } })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usuario.id)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(validade)
    .sign(segredo());
}
