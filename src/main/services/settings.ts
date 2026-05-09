import { getPrisma } from '../db';

export async function getSetting(key: string): Promise<string | null> {
  const row = await getPrisma().setting.findUnique({ where: { key } });
  return row?.deletedAt ? null : (row?.value ?? null);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getPrisma().setting.upsert({
    where: { key },
    update: { value, deletedAt: null },
    create: { key, value },
  });
}
