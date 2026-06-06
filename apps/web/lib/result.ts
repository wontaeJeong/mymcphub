import { formatApiError } from "./api";

export type LoadResult<Item> =
  | { ok: true; data: Item }
  | { ok: false; error: string };

export async function loadResult<Item>(promise: Promise<Item>): Promise<LoadResult<Item>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: formatApiError(error) };
  }
}
