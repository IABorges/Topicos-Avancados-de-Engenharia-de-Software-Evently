// Gera tokens JWT (formato Supabase Auth) para os usuários de teste e grava o
// ambiente em dois formatos:
//   postman/Evently-local.postman_environment.json  (Postman)
//   postman/Evently-local.bruno_environment.json    (Bruno)
import { writeFileSync } from "node:fs";
import { gerarToken } from "../src/infra/auth/jwt";
import { USUARIOS_TESTE } from "../src/infra/memoria/dadosIniciais";

const NOME = "Evently - local";
const variaveis: { nome: string; valor: string }[] = [{ nome: "baseUrl", valor: "http://localhost:3000" }];
for (const u of USUARIOS_TESTE) {
  const token = await gerarToken(u, "365d");
  variaveis.push({ nome: `token_${u.chave}`, valor: token });
  console.log(`${u.chave.padEnd(18)} ${u.email.padEnd(28)} ${u.perfis.join(",")}`);
}

writeFileSync(
  "postman/Evently-local.postman_environment.json",
  JSON.stringify(
    {
      name: NOME,
      values: variaveis.map((v) => ({ key: v.nome, value: v.valor, type: "default", enabled: true })),
      _postman_variable_scope: "environment",
    },
    null,
    2,
  ),
);
writeFileSync(
  "postman/Evently-local.bruno_environment.json",
  JSON.stringify(
    {
      name: NOME,
      variables: variaveis.map((v) => ({ name: v.nome, value: v.valor, type: "text", enabled: true, secret: false })),
    },
    null,
    2,
  ),
);
console.log("\nAmbientes salvos em postman/Evently-local.postman_environment.json e postman/Evently-local.bruno_environment.json");
