// Centralized URLs for the isipanel proxy. Single source of truth so a future
// domain change only touches this file.
//
// Anthropic: the @ai-sdk/anthropic SDK assumes `baseURL` already ends at the
// API version segment and appends only `/messages` (NOT `/v1/messages`). So
// the base URL must include the trailing `/v1` — the proxy then sees
// `/v1/proxy/anthropic/v1/messages`, which is what the panel whitelists.
// (We confirmed this empirically — without the `/v1` the request 403'd with
// `endpoint_not_allowed`.)
//
// YouTube: path-passthrough from `/youtube/v3/...`, so the base includes the
// doubled `/youtube/v3/` segment.

export const ANTHROPIC_PROXY_BASE_URL = 'https://api.isitools.com.br/v1/proxy/anthropic/v1';

export const YOUTUBE_PROXY_BASE_URL =
  'https://api.isitools.com.br/v1/proxy/youtube/youtube/v3';
