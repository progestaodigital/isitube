// Centralized URLs for the isipanel proxy. Single source of truth so a future
// domain change only touches this file. Anthropic uses path-passthrough from
// `/v1/messages` and the AI SDK appends that suffix automatically when
// `baseURL` is set. YouTube uses path-passthrough from `/youtube/v3/...` so
// the full base includes the doubled `/youtube/v3/` segment.

export const ANTHROPIC_PROXY_BASE_URL = 'https://api.isitools.com.br/v1/proxy/anthropic';

export const YOUTUBE_PROXY_BASE_URL =
  'https://api.isitools.com.br/v1/proxy/youtube/youtube/v3';
