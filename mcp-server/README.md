# isiTube MCP

Servidor MCP que dá ao **Claude Code** acesso à Biblioteca e ao Kanban do isiTube — ler, criar, preencher e mover cards de conteúdo.

Arquitetura: `Claude Code → (este MCP) → bridge HTTP local do isiTube (127.0.0.1) → serviços do app → SQLite`. Roda **dentro** do processo do app, então reusa a mesma lógica das telas (posição de card, JSON dos campos, etc.).

## Pré-requisitos

1. **isiTube aberto.** O bridge só responde com o app rodando.
2. **Bridge ativado.** No app: *Configurações → Integração MCP (Claude Code)* → **Ativar bridge**. Copie o **Endereço** (ex.: `http://127.0.0.1:8760`) e o **Token**.
3. Dependências instaladas aqui: `cd mcp-server && npm install`.

## Registrar no Claude Code

```bash
claude mcp add isitube \
  --env ISITUBE_BASE_URL=http://127.0.0.1:8760 \
  --env ISITUBE_TOKEN=<cole-o-token-das-configurações> \
  -- node "C:/Users/Usuario/Desktop/projetos/isitube/mcp-server/index.mjs"
```

Ou, num `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "isitube": {
      "command": "node",
      "args": ["C:/Users/Usuario/Desktop/projetos/isitube/mcp-server/index.mjs"],
      "env": {
        "ISITUBE_BASE_URL": "http://127.0.0.1:8760",
        "ISITUBE_TOKEN": "<cole-o-token-das-configurações>"
      }
    }
  }
}
```

> Não commite o token. Ele mora nas configurações do app; se vazar, gere um novo em *Configurações → Integração MCP → ↻*.

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `ISITUBE_BASE_URL` | `http://127.0.0.1:8760` | Endereço do bridge |
| `ISITUBE_TOKEN` | — (obrigatório) | Token bearer mostrado nas configurações |

## Tools expostas

`isitube_library_search`, `isitube_kanban_board`, `isitube_get_card`, `isitube_create_card`, `isitube_update_card`, `isitube_move_card`.

Veja `.claude/skills/isitube/SKILL.md` pro roteamento (quando usar cada uma).

## Teste rápido (sem Claude Code)

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | ISITUBE_TOKEN=<token> node index.mjs
```
