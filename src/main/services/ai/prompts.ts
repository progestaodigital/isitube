import { app } from 'electron';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Prompts live in plain markdown files outside the bundled JS so they can be
 * tweaked without rebuilding the app. In dev they sit in `<repo>/prompts/`;
 * in production they ship via electron-builder `extraResources` (configured
 * in Phase 7 — for now we assume `process.resourcesPath/prompts/`).
 */
function resolvePromptsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'prompts');
  }
  return join(process.cwd(), 'prompts');
}

const cache = new Map<string, string>();

export async function loadPrompt(
  name: string,
  variables: Record<string, string> = {}
): Promise<string> {
  let template = cache.get(name);
  if (!template) {
    const path = join(resolvePromptsDir(), `${name}.md`);
    template = await readFile(path, 'utf-8');
    cache.set(name, template);
  }

  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function clearPromptCache(): void {
  cache.clear();
}
