// Tópico ativo do wiki de Ajuda. Estado global mínimo (id atual + setter)
// pra que outros componentes (ex: CredentialField → "Como obter sua chave?")
// consigam fazer deep-link pro tópico certo navegando pra view 'help'.

import { create } from 'zustand';

export type HelpTopic =
  // Começando
  | 'getting-started'
  | 'plans'
  // Tutoriais de chaves de API
  | 'api-anthropic'
  | 'api-youtube'
  | 'api-ke'
  | 'api-github-pat'
  // Custos e cotas
  | 'youtube-quota'
  | 'other-api-costs'
  // Privacidade
  | 'data-location'
  | 'privacy'
  | 'limitations';

interface HelpStore {
  topic: HelpTopic;
  setTopic: (t: HelpTopic) => void;
}

export const useHelpStore = create<HelpStore>((set) => ({
  topic: 'getting-started',
  setTopic: (topic) => set({ topic }),
}));
