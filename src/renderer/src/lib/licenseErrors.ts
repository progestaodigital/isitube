// pt-BR mensagens pra cada estado/erro relacionado à licença ou ao proxy
// isipanel. Centralizado pra reuso entre modal, LicenseSection e (futuro)
// toast de proxy 429.

import type { LicenseStatus } from '@shared/types';

export type LicenseErrorPresentation = {
  title: string;
  description: string;
  /** Atalhos visíveis no UI: 'support' aponta pra support_url, 'subscription' pra subscription_url. */
  actions: Array<'support' | 'subscription' | 'retry' | 'change_key'>;
};

export function presentLicenseStatus(status: LicenseStatus): LicenseErrorPresentation {
  switch (status) {
    case 'valid':
      return {
        title: 'Licença ativa',
        description: '',
        actions: [],
      };

    case 'no_key':
      return {
        title: 'Cadastre sua licença pra começar',
        description:
          'Cole a chave que você recebeu por email após comprar o isiTube. Sem licença válida o app não funciona.',
        actions: [],
      };

    case 'invalid':
      return {
        title: 'Chave inválida',
        description:
          'Essa chave não é reconhecida pelo isipanel ou não é vinculada ao isiTube. Confira se digitou certo, ou contate o suporte.',
        actions: ['support', 'change_key'],
      };

    case 'hwid_mismatch':
      return {
        title: 'Licença em uso em outra máquina',
        description:
          'Esta chave já está ativa em outro computador. Se você trocou de máquina ou reinstalou o Windows, contate o suporte pra liberar.',
        actions: ['support', 'change_key'],
      };

    case 'expired':
      return {
        title: 'Licença expirada',
        description: 'Sua licença passou da data de validade. Renove pra continuar usando o app.',
        actions: ['subscription', 'change_key', 'support'],
      };

    case 'blocked':
      return {
        title: 'Licença bloqueada',
        description: 'Sua licença foi bloqueada pelo administrador. Entre em contato com o suporte.',
        actions: ['support', 'change_key'],
      };

    case 'expired_offline':
      return {
        title: 'Sem internet há tempo demais',
        description:
          'Você está sem conexão e o cache de validação expirou (mais de 48h). Reconecte pra revalidar.',
        actions: ['retry'],
      };

    case 'network_error':
      return {
        title: 'Sem conexão com o painel',
        description:
          'Não conseguimos validar a licença agora. Verifique sua internet e tente de novo.',
        actions: ['retry'],
      };

    case 'rate_limited':
      return {
        title: 'Muitas tentativas',
        description: 'Aguarde alguns minutos e tente novamente.',
        actions: ['retry'],
      };
  }
}

/**
 * Mapeamento dos `error` codes que o proxy isipanel retorna em respostas
 * 4xx/5xx (ver PROXY-CONTRACT.md). Usado quando uma chamada via proxy falha
 * pra mostrar mensagem clara no UI ao invés de string técnica.
 */
export function proxyErrorMessage(code: string): string {
  switch (code) {
    // Anthropic proxy
    case 'malformed_body':
      return 'Erro interno: requisição malformada.';
    case 'missing_model':
      return 'Erro interno: modelo não especificado.';
    case 'model_not_allowed':
      return 'O modelo escolhido não está disponível no seu plano. O plano Iniciante usa Claude Haiku 4.5.';
    case 'endpoint_not_allowed':
      return 'Esta operação não está disponível.';

    // Comum
    case 'missing_credentials':
    case 'missing_bearer_token':
      return 'Sem credenciais de licença. Cole sua chave nas configurações.';
    case 'invalid_license':
      return 'Licença inválida. Cole sua chave novamente nas configurações.';
    case 'license_blocked':
      return 'Sua licença foi bloqueada. Entre em contato com o suporte.';
    case 'license_expired':
      return 'Sua licença expirou. Renove pra continuar.';
    case 'license_inactive':
      return 'Sua licença não está ativa.';
    case 'proxy_not_for_this_product':
      return 'Esse recurso não está disponível para o produto contratado.';

    // YouTube proxy
    case 'endpoint_blocked':
      return 'Esta consulta usa muita cota do YouTube e foi bloqueada no plano Iniciante. Use uma busca por handle ou @username.';

    // Quota
    case 'quota_exceeded':
      return 'Você atingiu o limite mensal/diário do seu plano. Renove ou faça upgrade pra continuar.';

    // Server-side
    case 'proxy_not_configured':
      return 'O painel está temporariamente indisponível pra esta API. Tente em alguns minutos.';
    case 'internal':
      return 'Erro interno do servidor. Tente novamente em alguns minutos.';

    default:
      return `Erro do painel: ${code}`;
  }
}
