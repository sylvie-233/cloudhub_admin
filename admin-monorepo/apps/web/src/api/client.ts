import type { ApiResponse } from '@cloudhub/types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';
const TOKEN_KEY = 'cloudhub_token';

export type QueryValue = string | number | boolean | null | undefined;
/** 查询参数可传入任意普通对象，序列化时忽略空值与数组。 */
export type QueryParams = object;

/** 统一的接口错误，message 来自后端中文提示。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** 注册 401 处理逻辑（在应用初始化时调用）。 */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function buildQuery(query?: QueryParams): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function buildUrl(path: string, query?: QueryParams): string {
  const base = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return `${base}${buildQuery(query)}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** 登录接口关闭 401 全局跳转，避免重复提示 */
  skipUnauthorizedHandling?: boolean;
}

function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}

async function parseResponse<T>(response: Response, handleUnauthorized = true): Promise<T> {
  const text = await response.text();
  let payload: ApiResponse<T> | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as ApiResponse<T>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok || (payload && payload.code !== 200)) {
    // HTTP 状态码与业务 code 都可能表示失败：HTTP 2xx 时以业务 code 为准，
    // 这样后端返回 200 + code=401 时也能触发全局登录失效处理。
    const status = response.ok ? (payload?.code ?? response.status) : response.status;
    if (status === 401 && handleUnauthorized) {
      notifyUnauthorized();
    }
    throw new ApiError(
      status,
      payload?.code ?? status,
      payload?.message || `请求失败（HTTP ${status}）`,
    );
  }

  return (payload?.data ?? null) as T;
}

/** 发送请求并解包 { code, message, data }。 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 0, '网络连接失败，请检查后端服务是否已启动');
  }

  return parseResponse<T>(response, !options.skipUnauthorizedHandling);
}

/** 下载附件（用于登录日志 CSV 导出）。 */
export async function download(
  path: string,
  query: QueryParams | undefined,
  fallbackName: string,
): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { headers });
  } catch {
    throw new ApiError(0, 0, '网络连接失败，请检查后端服务是否已启动');
  }
  if (!response.ok) {
    await parseResponse<null>(response);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  let filename = fallbackName;
  if (encoded) {
    try {
      filename = decodeURIComponent(encoded);
    } catch {
      filename = plain ?? fallbackName;
    }
  } else if (plain) {
    filename = plain;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // 延迟释放，确保浏览器已开始处理下载
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
