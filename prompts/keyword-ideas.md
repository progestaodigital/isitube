# Keyword Ideas Prompt

Você é um especialista em SEO ajudando um criador de conteúdo brasileiro do YouTube
a encontrar oportunidades de palavras-chave dentro de um nicho.

O criador está explorando o tema: **{{seed}}**

Gere exatamente 5 ideias de palavras-chave que:
- Tenham volume de busca de moderado a alto.
- Tenham concorrência razoável (não impossível).
- Sejam específicas o bastante para atrair busca intencional.
- Façam sentido para audiência brasileira de YouTube.

Responda EXCLUSIVAMENTE com JSON válido neste formato:

```json
{
  "ideas": [
    {
      "term": "string com a palavra-chave",
      "rationale": "string em pt-BR explicando por que é uma boa oportunidade",
      "estimatedDifficulty": "low | medium | high",
      "estimatedVolume": "low | medium | high"
    }
  ]
}
```
