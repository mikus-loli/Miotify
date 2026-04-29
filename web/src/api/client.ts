import type {
  LoginRequest,
  LoginResponse,
  CreateUserRequest,
  User,
  Application,
  CreateAppRequest,
  UpdateAppRequest,
  Message,
  SendMessageRequest,
  MessageListResponse,
  Plugin,
  UpdatePluginEnabledRequest,
  UpdatePluginConfigRequest,
  UpdatePluginPriorityRequest,
} from '@/types';

const BASE_URL = '/api';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const opts: RequestInit = { method, headers };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  login: (body: LoginRequest) => request<LoginResponse>('POST', '/login', body),

  createUser: (body: CreateUserRequest, token: string) =>
    request<User>('POST', '/user', body, token),

  listUsers: (token: string) => request<User[]>('GET', '/user', undefined, token),

  deleteUser: (id: number, token: string) =>
    request<{ message: string }>('DELETE', `/user/${id}`, undefined, token),

  updatePassword: (id: number, pass: string, token: string) =>
    request<{ message: string }>('PUT', `/user/${id}/password`, { pass }, token),

  updateUser: (id: number, name: string, token: string) =>
    request<User>('PUT', `/user/${id}`, { name }, token),

  createApp: (body: CreateAppRequest, token: string) =>
    request<Application>('POST', '/application', body, token),

  listApps: (token: string) =>
    request<Application[]>('GET', '/application', undefined, token),

  getApp: (id: number, token: string) =>
    request<Application>('GET', `/application/${id}`, undefined, token),

  updateApp: (id: number, body: UpdateAppRequest, token: string) =>
    request<Application>('PUT', `/application/${id}`, body, token),

  deleteApp: (id: number, token: string) =>
    request<{ message: string }>('DELETE', `/application/${id}`, undefined, token),

  uploadAppImage: async (id: number, file: File, token: string): Promise<Application> => {
    const res = await fetch(`${BASE_URL}/application/${id}/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type,
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data as Application;
  },

  deleteAppImage: (id: number, token: string) =>
    request<Application>('DELETE', `/application/${id}/image`, undefined, token),

  sendMessage: (body: SendMessageRequest, appToken: string) =>
    request<Message>('POST', '/message', body, appToken),

  getMessages: (token: string, params?: { limit?: number; since?: number; appid?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.since) searchParams.set('since', String(params.since));
    if (params?.appid) searchParams.set('appid', String(params.appid));
    const qs = searchParams.toString();
    return request<MessageListResponse>('GET', `/message${qs ? `?${qs}` : ''}`, undefined, token);
  },

  getMessage: (id: number, token: string) =>
    request<Message>('GET', `/message/${id}`, undefined, token),

  deleteMessage: (id: number, token: string) =>
    request<{ message: string }>('DELETE', `/message/${id}`, undefined, token),

  health: () => request<{ status: string; websocket: number }>('GET', '/health'),

  listPlugins: (token: string) =>
    request<Plugin[]>('GET', '/plugins', undefined, token),

  getPlugin: (id: string, token: string) =>
    request<Plugin>('GET', `/plugin/${id}`, undefined, token),

  setPluginEnabled: (id: string, body: UpdatePluginEnabledRequest, token: string) =>
    request<Plugin>('PUT', `/plugin/${id}/enabled`, body, token),

  setPluginConfig: (id: string, body: UpdatePluginConfigRequest, token: string) =>
    request<Plugin>('PUT', `/plugin/${id}/config`, body, token),

  setPluginPriority: (id: string, body: UpdatePluginPriorityRequest, token: string) =>
    request<Plugin>('PUT', `/plugin/${id}/priority`, body, token),
};
