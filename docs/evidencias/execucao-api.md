# Evidência de execução da API - Serviço de Ingressos

Execução: 2026-11-05T09:28:26.298Z contra `http://localhost:3000` (servidor Next.js em execução).
Antes do roteiro: `POST /dev/reset` (massa de dados inicial).

| # | Cenário | Requisição | Esperado | Obtido | Resultado |
|---|---|---|---|---|---|
| 01 | confirmarPresenca - sucesso | `POST /convites/10/confirmacao` (ana) | 201 | 201 | OK |
| 02 | confirmarPresenca - convite já respondido | `POST /convites/10/confirmacao` (ana) | 409 CONVITE_JA_RESPONDIDO | 409 CONVITE_JA_RESPONDIDO | OK |
| 03 | confirmarPresenca - sem token | `POST /convites/11/confirmacao` (sem token) | 401 NAO_AUTENTICADO | 401 NAO_AUTENTICADO | OK |
| 04 | confirmarPresenca - convite inexistente | `POST /convites/999/confirmacao` (ana) | 404 CONVITE_NAO_ENCONTRADO | 404 CONVITE_NAO_ENCONTRADO | OK |
| 05 | confirmarPresenca - usuário não é o titular | `POST /convites/11/confirmacao` (intruso) | 403 NAO_TITULAR | 403 NAO_TITULAR | OK |
| 06 | confirmarPresenca - convite expirado | `POST /convites/14/confirmacao` (elisa) | 422 CONVITE_EXPIRADO | 422 CONVITE_EXPIRADO | OK |
| 07 | confirmarPresenca - evento sem vagas | `POST /convites/21/confirmacao` (gustavo) | 409 SEM_VAGAS | 409 SEM_VAGAS | OK |
| 08 | confirmarPresenca - falha na trilha (desfeita) | `POST /convites/50/confirmacao` (julia) | 503 FALHA_DEPENDENCIA | 503 FALHA_DEPENDENCIA | OK |
| 09 | recusarConvite - sucesso | `POST /convites/11/recusa` (bruno) | 200 | 200 | OK |
| 10 | registrarDesistencia - sucesso | `POST /convites/12/desistencia` (carla) | 200 | 200 | OK |
| 11 | registrarDesistencia - evento já iniciado | `POST /convites/30/desistencia` (helena) | 422 EVENTO_INICIADO | 422 EVENTO_INICIADO | OK |
| 12 | registrarDesistencia - sem ingresso confirmado | `POST /convites/11/desistencia` (bruno) | 409 SEM_INGRESSO_CONFIRMADO | 409 SEM_INGRESSO_CONFIRMADO | OK |
| 13 | transferirConvite - dados do substituto inválidos | `POST /convites/13/transferencia` (diego) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS | OK |
| 14 | transferirConvite - substituto já convidado | `POST /convites/13/transferencia` (diego) | 409 SUBSTITUTO_JA_CONVIDADO | 409 SUBSTITUTO_JA_CONVIDADO | OK |
| 15 | transferirConvite - sucesso | `POST /convites/13/transferencia` (diego) | 200 | 200 | OK |
| 16 | transferirConvite - não permitida pelo evento | `POST /convites/40/transferencia` (igor) | 422 TRANSFERENCIA_NAO_PERMITIDA | 422 TRANSFERENCIA_NAO_PERMITIDA | OK |
| 17 | confirmarPresenca - substituto usa a vaga reservada | `POST /convites/1000/confirmacao` (maria) | 201 | 201 | OK |
| 18 | consultarIngresso - portaria por qrCode (desistente, QR inválido) | `GET /ingressos?qrCode=EVT-C12A0001` (portaria) | 200 | 200 | OK |
| 19 | consultarIngresso - organizador por conviteId | `GET /ingressos?conviteId=10` (organizador) | 200 | 200 | OK |
| 20 | consultarIngresso - titular por ingressoId | `GET /ingressos/101` (bruno) | 200 | 200 | OK |
| 21 | consultarIngresso - nenhum identificador | `GET /ingressos` (portaria) | 400 DADOS_INVALIDOS | 400 DADOS_INVALIDOS | OK |
| 22 | consultarIngresso - QR Code inexistente | `GET /ingressos?qrCode=EVT-NAOEXISTE` (portaria) | 404 INGRESSO_NAO_ENCONTRADO | 404 INGRESSO_NAO_ENCONTRADO | OK |
| 23 | consultarIngresso - usuário sem permissão | `GET /ingressos?conviteId=10` (intruso) | 403 ACESSO_NEGADO | 403 ACESSO_NEGADO | OK |
| 24 | saldo de vagas do evento 1 (organizador) | `GET /eventos/1/vagas` (organizador) | 200 | 200 | OK |
| 25 | eventos de domínio publicados (assíncrono) | `GET /dev/eventos-publicados` (sem token) | 200 | 200 | OK |

**Resumo:** 25 de 25 cenários conforme o contrato.

## Requisições e respostas

### 01 confirmarPresenca - sucesso

```http
POST /convites/10/confirmacao
Authorization: Bearer <token de ana>
```

Resposta: **HTTP 201**

```json
{
  "ingressoId": 100,
  "conviteId": 10,
  "situacao": "CONFIRMADO",
  "qrCode": "EVT-EF84BAE7",
  "confirmadoEm": "2026-11-05T09:28:26.343Z"
}
```

### 02 confirmarPresenca - convite já respondido

```http
POST /convites/10/confirmacao
Authorization: Bearer <token de ana>
```

Resposta: **HTTP 409**

```json
{
  "codigo": "CONVITE_JA_RESPONDIDO",
  "mensagem": "O convite já foi respondido."
}
```

### 03 confirmarPresenca - sem token

```http
POST /convites/11/confirmacao
(sem Authorization)
```

Resposta: **HTTP 401**

```json
{
  "codigo": "NAO_AUTENTICADO",
  "mensagem": "Token ausente ou inválido."
}
```

### 04 confirmarPresenca - convite inexistente

```http
POST /convites/999/confirmacao
Authorization: Bearer <token de ana>
```

Resposta: **HTTP 404**

```json
{
  "codigo": "CONVITE_NAO_ENCONTRADO",
  "mensagem": "Convite não encontrado."
}
```

### 05 confirmarPresenca - usuário não é o titular

```http
POST /convites/11/confirmacao
Authorization: Bearer <token de intruso>
```

Resposta: **HTTP 403**

```json
{
  "codigo": "NAO_TITULAR",
  "mensagem": "O usuário não é o titular do convite."
}
```

### 06 confirmarPresenca - convite expirado

```http
POST /convites/14/confirmacao
Authorization: Bearer <token de elisa>
```

Resposta: **HTTP 422**

```json
{
  "codigo": "CONVITE_EXPIRADO",
  "mensagem": "O convite está fora da vigência."
}
```

### 07 confirmarPresenca - evento sem vagas

```http
POST /convites/21/confirmacao
Authorization: Bearer <token de gustavo>
```

Resposta: **HTTP 409**

```json
{
  "codigo": "SEM_VAGAS",
  "mensagem": "O evento não tem vagas disponíveis."
}
```

### 08 confirmarPresenca - falha na trilha (desfeita)

```http
POST /convites/50/confirmacao
Authorization: Bearer <token de julia>
```

Resposta: **HTTP 503**

```json
{
  "codigo": "FALHA_DEPENDENCIA",
  "mensagem": "A liberação da trilha de preparo falhou. A confirmação foi desfeita."
}
```

### 09 recusarConvite - sucesso

```http
POST /convites/11/recusa
Authorization: Bearer <token de bruno>
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 101,
  "conviteId": 11,
  "situacao": "RECUSADO"
}
```

### 10 registrarDesistencia - sucesso

```http
POST /convites/12/desistencia
Authorization: Bearer <token de carla>
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 102,
  "situacao": "DESISTENTE"
}
```

### 11 registrarDesistencia - evento já iniciado

```http
POST /convites/30/desistencia
Authorization: Bearer <token de helena>
```

Resposta: **HTTP 422**

```json
{
  "codigo": "EVENTO_INICIADO",
  "mensagem": "O evento já começou."
}
```

### 12 registrarDesistencia - sem ingresso confirmado

```http
POST /convites/11/desistencia
Authorization: Bearer <token de bruno>
```

Resposta: **HTTP 409**

```json
{
  "codigo": "SEM_INGRESSO_CONFIRMADO",
  "mensagem": "Não há ingresso confirmado para este convite."
}
```

### 13 transferirConvite - dados do substituto inválidos

```http
POST /convites/13/transferencia
Authorization: Bearer <token de diego>

{
  "dadosSubstituto": {
    "nome": "",
    "email": "email-invalido"
  }
}
```

Resposta: **HTTP 400**

```json
{
  "codigo": "DADOS_INVALIDOS",
  "mensagem": "Nome ou e-mail do substituto ausente ou inválido."
}
```

### 14 transferirConvite - substituto já convidado

```http
POST /convites/13/transferencia
Authorization: Bearer <token de diego>

{
  "dadosSubstituto": {
    "nome": "Ana Lima",
    "email": "ana@evently.test"
  }
}
```

Resposta: **HTTP 409**

```json
{
  "codigo": "SUBSTITUTO_JA_CONVIDADO",
  "mensagem": "O substituto já tem convite neste evento."
}
```

### 15 transferirConvite - sucesso

```http
POST /convites/13/transferencia
Authorization: Bearer <token de diego>

{
  "dadosSubstituto": {
    "nome": "Maria Souza",
    "email": "maria.souza@empresa.com"
  }
}
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 103,
  "situacao": "TRANSFERIDO",
  "novoConviteId": 1000
}
```

### 16 transferirConvite - não permitida pelo evento

```http
POST /convites/40/transferencia
Authorization: Bearer <token de igor>

{
  "dadosSubstituto": {
    "nome": "Maria Souza",
    "email": "maria.souza@empresa.com"
  }
}
```

Resposta: **HTTP 422**

```json
{
  "codigo": "TRANSFERENCIA_NAO_PERMITIDA",
  "mensagem": "A regra do evento não permite transferência."
}
```

### 17 confirmarPresenca - substituto usa a vaga reservada

```http
POST /convites/1000/confirmacao
Authorization: Bearer <token de maria>
```

Resposta: **HTTP 201**

```json
{
  "ingressoId": 110,
  "conviteId": 1000,
  "situacao": "CONFIRMADO",
  "qrCode": "EVT-D329A879",
  "confirmadoEm": "2026-11-05T09:28:26.926Z"
}
```

### 18 consultarIngresso - portaria por qrCode (desistente, QR inválido)

```http
GET /ingressos?qrCode=EVT-C12A0001
Authorization: Bearer <token de portaria>
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 102,
  "conviteId": 12,
  "eventoId": 1,
  "participante": {
    "nome": "Carla Dias",
    "email": "carla@evently.test"
  },
  "situacao": "DESISTENTE",
  "qrCode": "EVT-C12A0001",
  "qrValido": false
}
```

### 19 consultarIngresso - organizador por conviteId

```http
GET /ingressos?conviteId=10
Authorization: Bearer <token de organizador>
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 100,
  "conviteId": 10,
  "eventoId": 1,
  "participante": {
    "nome": "Ana Lima",
    "email": "ana@evently.test"
  },
  "situacao": "CONFIRMADO",
  "qrCode": "EVT-EF84BAE7",
  "qrValido": true
}
```

### 20 consultarIngresso - titular por ingressoId

```http
GET /ingressos/101
Authorization: Bearer <token de bruno>
```

Resposta: **HTTP 200**

```json
{
  "ingressoId": 101,
  "conviteId": 11,
  "eventoId": 1,
  "participante": {
    "nome": "Bruno Alves",
    "email": "bruno@evently.test"
  },
  "situacao": "RECUSADO",
  "qrValido": false
}
```

### 21 consultarIngresso - nenhum identificador

```http
GET /ingressos
Authorization: Bearer <token de portaria>
```

Resposta: **HTTP 400**

```json
{
  "codigo": "DADOS_INVALIDOS",
  "mensagem": "Informe exatamente um identificador: ingressoId, conviteId ou qrCode."
}
```

### 22 consultarIngresso - QR Code inexistente

```http
GET /ingressos?qrCode=EVT-NAOEXISTE
Authorization: Bearer <token de portaria>
```

Resposta: **HTTP 404**

```json
{
  "codigo": "INGRESSO_NAO_ENCONTRADO",
  "mensagem": "Nenhum ingresso encontrado para o identificador informado."
}
```

### 23 consultarIngresso - usuário sem permissão

```http
GET /ingressos?conviteId=10
Authorization: Bearer <token de intruso>
```

Resposta: **HTTP 403**

```json
{
  "codigo": "ACESSO_NEGADO",
  "mensagem": "O usuário não tem permissão para consultar este recurso."
}
```

### 24 saldo de vagas do evento 1 (organizador)

```http
GET /eventos/1/vagas
Authorization: Bearer <token de organizador>
```

Resposta: **HTTP 200**

```json
{
  "eventoId": 1,
  "capacidade": 3,
  "ocupadas": 2,
  "reservadas": 0,
  "disponiveis": 1
}
```

### 25 eventos de domínio publicados (assíncrono)

```http
GET /dev/eventos-publicados
(sem Authorization)
```

Resposta: **HTTP 200**

```json
[
  {
    "tipo": "PresencaConfirmada",
    "ocorridoEm": "2026-11-05T09:28:26.344Z",
    "dados": {
      "ingressoId": 100,
      "conviteId": 10,
      "eventoId": 1
    }
  },
  {
    "tipo": "ConviteRecusado",
    "ocorridoEm": "2026-11-05T09:28:26.577Z",
    "dados": {
      "ingressoId": 101,
      "conviteId": 11,
      "eventoId": 1
    }
  },
  {
    "tipo": "DesistenciaRegistrada",
    "ocorridoEm": "2026-11-05T09:28:26.623Z",
    "dados": {
      "ingressoId": 102,
      "conviteId": 12,
      "eventoId": 1
    }
  },
  {
    "tipo": "ConviteTransferido",
    "ocorridoEm": "2026-11-05T09:28:26.864Z",
    "dados": {
      "ingressoId": 103,
      "conviteId": 13,
      "novoConviteId": 1000,
      "eventoId": 1
    }
  },
  {
    "tipo": "PresencaConfirmada",
    "ocorridoEm": "2026-11-05T09:28:26.926Z",
    "dados": {
      "ingressoId": 110,
      "conviteId": 1000,
      "eventoId": 1
    }
  }
]
```
