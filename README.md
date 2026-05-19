# isiTube

Software desktop de **inteligência competitiva e planejamento de conteúdo** para criadores no YouTube. Monitora canais, identifica vídeos em destaque, descobre evergreen, pesquisa palavras-chave com score 0-100 e gera ideias com IA. Tudo roda local — dados ficam no seu computador.

Parte do ecossistema **isi** (Instaisi, Masterisi, Isiflow, IsiPanel, isiTube).

---

## Pra quem é

Criadores de YouTube que querem decidir o que produzir com base em dados — quais vídeos do canal estão performando acima da média, quais continuam ganhando views meses depois, quais palavras-chave estão em ascensão.

Funciona melhor pra quem tem ao menos 1-2 canais cadastrados e roda "Atualizar agora" 1-2 vezes por dia (manual ou agendado).

## Como comprar

Plano **Pro** disponível pelo Cakto. Compre, receba a chave por email, cole no app, comece a usar.

> 🛒 **[Comprar isiTube Pro](https://pay.cakto.com.br/SEU-LINK-AQUI)** *(substituir pelo link real do Cakto)*

## Como instalar

1. Baixa a versão mais recente do `.exe` em **[Releases](https://github.com/progestaodigital/isitube/releases/latest)**
2. Roda o instalador (NSIS — pede onde instalar, atalho, etc)
3. Abre o app — vai aparecer um modal pedindo a chave de licença
4. Cola a chave que veio no email da compra (formato `ISI-XXXX-XXXX-XXXX-XXXX`)
5. Pronto — siga o checklist "Configure suas chaves" que aparece na Home

**Requisitos:** Windows 10/11. Mac e Linux ficam pra V2+.

## O que o app faz

- **Monitora canais:** cadastra qualquer canal do YouTube por URL ou handle; o app importa o histórico e atualiza periodicamente
- **Detecta outliers:** sinaliza vídeos que renderam acima da média recente do canal
- **Identifica evergreen:** vídeos antigos que continuam ganhando views ao longo do tempo
- **Pesquisa palavras-chave:** score 0-100 combinando volume mensal, tendência, concorrência e frescor dos top resultados
- **Gera ideias com IA:** Claude analisa o tema e sugere keywords com justificativa de SEO
- **Transcrições:** baixa legendas de qualquer vídeo público pra usar como base de pauta
- **Backup automático:** schedule pra subir o banco como Release num repo GitHub seu
- **Atualização automática:** auto-detecta novas versões e baixa o instalador quando você confirmar

## Plano Pro — BYOK

O Pro é **BYOK** (Bring Your Own Key): você usa suas próprias contas/chaves nas APIs externas pra ter controle total dos custos.

| API | Pra que serve | Custo típico |
|---|---|---|
| **Anthropic Claude** | IA pra ideias e análises | US$5 prepago dura semanas |
| **YouTube Data API v3** | Métricas de canais e vídeos | Gratuito (10k unidades/dia) |
| **Keywords Everywhere** *(opcional)* | Volume real de busca | US$10 = 100.000 créditos |
| **GitHub PAT** *(opcional)* | Backup automático na sua conta | Gratuito |

Tutoriais passo-a-passo pra gerar cada chave estão dentro do app, em **Configurações → Ajuda → Como gerar suas chaves**.

## Privacidade

- Tudo local. Banco SQLite em `%APPDATA%\isiTube\data.db`
- Chaves de API criptografadas com `safeStorage` do Electron (DPAPI no Windows)
- Sem telemetria escondida — o único dado que sai do app é a validação de licença
- Backup, se ativado, vai pro **seu** repo no GitHub (não pro nosso)

## Suporte

- **Instagram:** [@falaaleixo](https://instagram.com/falaaleixo)
- **Email:** progestaodigital@gmail.com
- **Issues técnicas:** abra uma issue [aqui no GitHub](https://github.com/progestaodigital/isitube/issues)

Antes de abrir um chamado, dá uma olhada em **Configurações → Status das integrações** dentro do app — mostra qual API está com erro e ajuda a diagnosticar.

## Licença de uso

Software proprietário. O código fonte fica público pra transparência e pra permitir auto-update sem fricção, mas **uso comercial e redistribuição não são autorizados**. Pra usar é preciso uma licença válida adquirida no Cakto.
