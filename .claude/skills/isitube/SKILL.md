---
name: isitube
description: Ler a Biblioteca e gerenciar o Kanban do isiTube (criar, preencher e mover cards de conteúdo) via o bridge local do app. Use quando o usuário quiser planejar conteúdo pro YouTube, criar/editar/mover cards, ou consultar os vídeos salvos na biblioteca.
---

# isiTube

Ferramentas pra ler a **Biblioteca** e gerenciar o **Kanban** do isiTube (app desktop de inteligência competitiva e planejamento de conteúdo pra YouTube). As tools vêm do MCP `isitube`, que fala com um bridge local do próprio app.

## Pré-requisito (importante)

O isiTube precisa estar **aberto** e o bridge **ativado** em *Configurações → Integração MCP*. Se uma tool falhar com algo como "não consegui falar com o isiTube", peça pro usuário abrir o app e ativar o bridge — não insista repetindo a chamada.

## Tools

| Tool | Uso |
|---|---|
| `isitube_library_search(query?, sort?)` | Vídeos salvos na biblioteca (referência de pauta/estilo). `sort`: recent \| oldest \| mostViews \| title |
| `isitube_kanban_board()` | Colunas (id, nome, posição) + todos os cards de cada coluna |
| `isitube_get_card(cardId)` | Todos os campos de um card |
| `isitube_create_card(title, columnId?, ...campos)` | Cria (1ª coluna por padrão) e já preenche campos |
| `isitube_update_card(cardId, ...campos)` | Preenche/edita campos de um card |
| `isitube_move_card(cardId, toColumnId, toPosition?)` | Move pra outra coluna / reordena |

**Campos de card:** `title`, `mainKeyword`, `format` (`longo`|`short`|`live`|`estreia`), `description`, `script`, `hook`, `thumbnailPrompt`, `tags[]`, `hashtags[]`, `secondaryKeywords[]`, `chapters[{timestamp,label}]`.

## Fluxos

- **Planejar conteúdo:** `isitube_library_search` (ver o que já performou no canal) → `isitube_kanban_board` (estado atual) → `isitube_create_card` (nova pauta) → `isitube_update_card` (título, descrição, roteiro, tags…).
- **Avançar a produção:** `isitube_kanban_board` (pegar os ids das colunas) → `isitube_move_card` pra próxima etapa (ex.: *Ideia → Roteirizando → Pronto pra gravar*).
- **Editar um card:** `isitube_get_card` pra ver o que já tem → `isitube_update_card` só com os campos que mudam.

## Regras

- **Nunca invente ids.** Pegue os ids reais de coluna/card via `isitube_kanban_board` (ou `isitube_get_card`) antes de `update`/`move`.
- Ao criar **títulos**, modele o estilo pelos vídeos da biblioteca (`isitube_library_search sort=mostViews`).
- Antes de **mover vários cards** ou **sobrescrever** campos já preenchidos, confirme com o usuário.
- `update_card` só altera os campos enviados — os demais ficam como estão.
