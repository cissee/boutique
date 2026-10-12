/**
 * Client HTTP minimal pour l'API Supabase (Auth + PostgREST), utilisé par les tests
 * d'intégration. Passe par fetch : aucune dépendance au WebSocket de supabase-js.
 */

export type ApiResult<T> = { ok: boolean; status: number; data: T; error?: { message?: string; code?: string } };

export class SupabaseApi {
  private token = "";

  constructor(
    private readonly url: string,
    private readonly key: string,
  ) {}

  async signIn(email: string, password: string): Promise<string> {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Connexion impossible (${res.status}) : ${body.error_code ?? body.msg}`);
    this.token = body.access_token;
    return body.user.id as string;
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async result<T>(res: Response): Promise<ApiResult<T>> {
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    return res.ok ? { ok: true, status: res.status, data: json as T } : { ok: false, status: res.status, data: null as T, error: json };
  }

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<ApiResult<T>> {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(args),
    });
    return this.result<T>(res);
  }

  async select<T = unknown>(table: string, query: string): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, { headers: this.headers() });
    const r = await this.result<T[]>(res);
    if (!r.ok) throw new Error(`select ${table} : ${JSON.stringify(r.error)}`);
    return r.data;
  }

  async insert<T = unknown>(table: string, row: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: this.headers({ Prefer: "return=representation" }),
      body: JSON.stringify(row),
    });
    const r = await this.result<T[]>(res);
    if (!r.ok) throw new Error(`insert ${table} : ${JSON.stringify(r.error)}`);
    return r.data[0];
  }

  async update(table: string, query: string, patch: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(patch),
    });
    const r = await this.result(res);
    if (!r.ok) throw new Error(`update ${table} : ${JSON.stringify(r.error)}`);
  }
}
