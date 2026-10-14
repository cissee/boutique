/**
 * PostgREST (Supabase) renvoie au plus `max_rows` lignes par requête (1 000 par défaut),
 * sans erreur au-delà. Pour les listes complètes (clients, exports), on lit page par page.
 */
export const PAGE_ROWS = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAll<T>(
  page: (from: number, to: number) => PageResult<T>,
  maxRows = 100_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_ROWS) break;
  }
  return rows;
}
