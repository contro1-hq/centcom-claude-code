interface CentcomClientConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

interface CreateRequestParams {
  type: "approval" | "yes_no" | "free_text";
  context: string;
  question: string;
  callback_url: string;
  priority: "normal" | "urgent";
  required_role?: string;
  metadata?: Record<string, unknown>;
  sla_minutes?: number;
  idempotency_key?: string;
}

export interface CentcomRequest {
  id: string;
  state: string;
  response?: Record<string, unknown> | null;
}

export class CentcomClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: CentcomClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(extraHeaders ?? {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error((json.message as string) || `HTTP ${res.status}`);
      }
      return json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createRequest(params: CreateRequestParams): Promise<CentcomRequest> {
    const { idempotency_key, ...body } = params;
    const headers: Record<string, string> = {};
    if (idempotency_key) headers["Idempotency-Key"] = idempotency_key;
    return this.request<CentcomRequest>("POST", "/requests", body, headers);
  }

  async getRequest(requestId: string): Promise<CentcomRequest> {
    return this.request<CentcomRequest>("GET", `/requests/${requestId}`);
  }

  async cancelRequest(requestId: string): Promise<void> {
    await this.request<Record<string, unknown>>("DELETE", `/requests/${requestId}`);
  }

  async waitForResponse(requestId: string, intervalMs: number, timeoutMs: number): Promise<CentcomRequest> {
    const deadline = Date.now() + timeoutMs;
    const terminal = new Set([
      "answered",
      "callback_pending",
      "callback_delivered",
      "callback_failed",
      "closed",
      "expired",
      "cancelled",
    ]);

    while (Date.now() < deadline) {
      const req = await this.getRequest(requestId);
      if (terminal.has(req.state)) return req;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Timeout waiting for response on request ${requestId}`);
  }
}
