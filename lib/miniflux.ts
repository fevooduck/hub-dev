import { config } from './config.ts';

/** Cliente mínimo da API do Miniflux (https://miniflux.app/docs/api.html). */

export interface MinifluxEntry {
  id: number;
  feed_id: number;
  status: 'read' | 'unread' | 'removed';
  title: string;
  url: string;
  author: string;
  content: string;
  published_at: string;
  created_at: string;
  feed: {
    id: number;
    title: string;
    site_url: string;
    feed_url: string;
    category: { id: number; title: string };
  };
}

export interface MinifluxCategory {
  id: number;
  title: string;
  feed_count?: number;
  total_unread?: number;
}

export class MinifluxError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class MinifluxClient {
  constructor(
    private baseUrl = config.miniflux.url,
    private auth = config.miniflux,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json', ...extra };
    if (this.auth.token) {
      headers['X-Auth-Token'] = this.auth.token;
    } else if (this.auth.user && this.auth.password) {
      headers.Authorization = `Basic ${Buffer.from(`${this.auth.user}:${this.auth.password}`).toString('base64')}`;
    } else {
      throw new Error('Configure MINIFLUX_TOKEN ou MINIFLUX_ADMIN_USER/MINIFLUX_ADMIN_PASSWORD no .env');
    }
    return headers;
  }

  private async request<T>(method: string, path: string, body?: string, contentType?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(contentType ? { 'Content-Type': contentType } : {}),
        body,
      });
    } catch (error) {
      throw new MinifluxError(0, `Não consegui conectar ao Miniflux em ${this.baseUrl} (o container está de pé?) — ${(error as Error).message}`);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const hint = response.status === 401 ? ' (credenciais erradas: confira o .env)' : '';
      throw new MinifluxError(response.status, `Miniflux ${method} ${path} → ${response.status}${hint} ${text}`.trim());
    }
    if (response.status === 204) return undefined as T;
    const raw = await response.text();
    return (raw ? JSON.parse(raw) : undefined) as T;
  }

  me() {
    return this.request<{ id: number; username: string }>('GET', '/v1/me');
  }

  importOpml(opml: string) {
    return this.request<{ message: string }>('POST', '/v1/import', opml, 'application/xml');
  }

  refreshAllFeeds() {
    return this.request<void>('PUT', '/v1/feeds/refresh');
  }

  categories() {
    return this.request<MinifluxCategory[]>('GET', '/v1/categories?counts=true');
  }

  /** Entradas com id maior que `afterId`, em ordem crescente (cursor de sincronização). */
  entriesAfter(afterId: number, limit = 100) {
    const qs = new URLSearchParams({
      after_entry_id: String(afterId),
      order: 'id',
      direction: 'asc',
      limit: String(limit),
    });
    qs.append('status', 'unread');
    qs.append('status', 'read');
    return this.request<{ total: number; entries: MinifluxEntry[] }>('GET', `/v1/entries?${qs}`);
  }
}
