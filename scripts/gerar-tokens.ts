// Gera tokens JWT (formato Supabase Auth) para os usuários de teste e grava o
// ambiente do Postman em postman/Evently-local.postman_environment.json.
import { writeFileSync } from "node:fs";
import { gerarToken } from "../src/infra/auth/jwt";
import { USUARIOS_TESTE } from "../src/infra/memoria/dadosIniciais";

const valores: { key: string; value: string; enabled: boolean }[] = [
  { key: "baseUrl", value: "http://localhost:3000", enabled: true },
];
for (const u of USUARIOS_TESTE) {
  const token = await gerarToken(u, "365d");
  valores.push({ key: `token_${u.chave}`, value: token, enabled: true });
  console.log(`${u.chave.padEnd(18)} ${u.email.padEnd(28)} ${u.perfis.join(",")}`);
}
writeFileSync(
  "postman/Evently-local.postman_environment.json",
  JSON.stringify({ name: "Evently - local", values: valores }, null, 2),
);
console.log("\nAmbiente salvo em postman/Evently-local.postman_environment.json");
