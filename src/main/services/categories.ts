import { getPrisma } from '../db';
import type { CategoryActionResult, CategoryInfo } from '@shared/types';

const NAME_MAX = 40;

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function validateColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  return c.toLowerCase();
}

export async function listCategories(): Promise<CategoryInfo[]> {
  const prisma = getPrisma();
  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          channels: { where: { channel: { deletedAt: null, monitored: true } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    channelCount: r._count.channels,
  }));
}

export async function createCategory(
  name: string,
  color?: string | null
): Promise<CategoryActionResult> {
  const cleaned = normalizeName(name);
  if (!cleaned) return { success: false, message: 'Nome obrigatório.' };
  if (cleaned.length > NAME_MAX) {
    return { success: false, message: `Nome muito longo (máx ${NAME_MAX}).` };
  }

  const prisma = getPrisma();

  // Reactivate if soft-deleted with the same name.
  const existing = await prisma.category.findUnique({ where: { name: cleaned } });
  if (existing) {
    if (existing.deletedAt) {
      const reactivated = await prisma.category.update({
        where: { id: existing.id },
        data: { deletedAt: null, color: validateColor(color) },
      });
      return {
        success: true,
        message: 'Categoria reativada.',
        category: { id: reactivated.id, name: reactivated.name, color: reactivated.color, channelCount: 0 },
      };
    }
    return { success: false, message: 'Já existe uma categoria com esse nome.' };
  }

  const created = await prisma.category.create({
    data: { name: cleaned, color: validateColor(color) },
  });
  return {
    success: true,
    message: 'Categoria criada.',
    category: { id: created.id, name: created.name, color: created.color, channelCount: 0 },
  };
}

export async function updateCategory(
  id: string,
  name: string,
  color?: string | null
): Promise<CategoryActionResult> {
  const cleaned = normalizeName(name);
  if (!cleaned) return { success: false, message: 'Nome obrigatório.' };

  const prisma = getPrisma();
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return { success: false, message: 'Categoria não encontrada.' };
  }

  if (cleaned !== existing.name) {
    const conflict = await prisma.category.findUnique({ where: { name: cleaned } });
    if (conflict && conflict.id !== id && !conflict.deletedAt) {
      return { success: false, message: 'Já existe uma categoria com esse nome.' };
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { name: cleaned, color: validateColor(color) },
  });
  return {
    success: true,
    message: 'Categoria atualizada.',
    category: { id: updated.id, name: updated.name, color: updated.color, channelCount: 0 },
  };
}

export async function deleteCategory(id: string): Promise<void> {
  const prisma = getPrisma();
  // Soft delete + cascade-remove the join rows so channels no longer reference it.
  await prisma.$transaction([
    prisma.channelCategory.deleteMany({ where: { categoryId: id } }),
    prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);
}

/**
 * Replace a channel's categories with exactly the ones in `categoryIds`.
 * Pass an empty array to remove all.
 */
export async function setChannelCategories(
  channelId: string,
  categoryIds: string[]
): Promise<void> {
  const prisma = getPrisma();
  const unique = Array.from(new Set(categoryIds));

  // Filter out any categories that don't exist or are soft-deleted.
  const valid =
    unique.length === 0
      ? []
      : await prisma.category.findMany({
          where: { id: { in: unique }, deletedAt: null },
          select: { id: true },
        });
  const validIds = valid.map((c) => c.id);

  await prisma.$transaction([
    prisma.channelCategory.deleteMany({ where: { channelId } }),
    ...(validIds.length > 0
      ? [
          prisma.channelCategory.createMany({
            data: validIds.map((categoryId) => ({ channelId, categoryId })),
          }),
        ]
      : []),
  ]);
}

/**
 * Resolve a list of mixed category names + ids into an array of existing
 * category ids, creating any names that don't exist yet. Used by AddChannel
 * so the user can type new categories inline.
 *
 * Items starting with `id:` are treated as ids; everything else is a name.
 */
export async function resolveOrCreateCategories(
  items: Array<{ id?: string; name?: string }>
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of items) {
    if (item.id) {
      ids.push(item.id);
      continue;
    }
    if (item.name) {
      const result = await createCategory(item.name);
      if (result.category) {
        ids.push(result.category.id);
      } else {
        // Already exists — look it up.
        const existing = await getPrisma().category.findUnique({
          where: { name: normalizeName(item.name) },
        });
        if (existing && !existing.deletedAt) ids.push(existing.id);
      }
    }
  }
  return Array.from(new Set(ids));
}
