// Shared config types for external API providers (Anthropic, YouTube Data API,
// Keywords Everywhere). Introduced in Phase 9.A.1 to support two operating
// modes per provider:
//
//   - `direct` (BYOK / Plano Pro): the user's own API key is used and requests
//     hit the upstream provider directly.
//   - `proxy` (Plano Iniciante): the isipanel license key is used as bearer
//     auth and requests hit the panel proxy, which swaps in the master key
//     server-side and enforces per-license quota.
//
// The selector services (ai/index.ts, channels/index.ts, videos/index.ts)
// decide which mode to use based on the active license plan and the user's
// configured credentials. Providers themselves stay agnostic — they accept
// either config and route accordingly.

export type DirectConfig = {
  mode: 'direct';
  /** The user's own API key for the upstream provider. */
  apiKey: string;
};

export type ProxyConfig = {
  mode: 'proxy';
  /** isipanel license key, sent as bearer to the proxy. */
  licenseKey: string;
  /**
   * Base URL of the proxy endpoint (without trailing slash).
   * Example for Anthropic:
   *   'https://api.isitools.com.br/v1/proxy/anthropic'
   * Example for YouTube Data API:
   *   'https://api.isitools.com.br/v1/proxy/youtube/youtube/v3'
   */
  baseUrl: string;
};

export type ExternalApiConfig = DirectConfig | ProxyConfig;
