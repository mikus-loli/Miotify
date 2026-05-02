export interface User {
  id: number;
  name: string;
  admin: number;
  created_at: string;
}

export interface LoginRequest {
  name: string;
  pass: string;
}

export interface LoginResponse {
  token: string;
  id: number;
  name: string;
  admin: boolean;
}

export interface CreateUserRequest {
  name: string;
  pass: string;
  admin?: boolean;
}

export interface Application {
  id: number;
  token: string;
  name: string;
  description: string;
  image: string;
  user_id: number;
  created_at: string;
}

export interface CreateAppRequest {
  name: string;
  description?: string;
}

export interface UpdateAppRequest {
  name?: string;
  description?: string;
}

export interface Message {
  id: number;
  appid: number;
  message: string;
  title: string;
  priority: number;
  created_at: string;
}

export interface SendMessageRequest {
  title?: string;
  message: string;
  priority?: number;
}

export interface MessageListResponse {
  messages: Message[];
  paging: {
    next: number | null;
    limit: number;
    since: number;
  };
}

export interface WsMessage {
  type: 'connected' | 'message';
  data: Record<string, unknown>;
}

export interface ApiError {
  error: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  license: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpdatePluginEnabledRequest {
  enabled: boolean;
}

export interface UpdatePluginConfigRequest {
  [key: string]: unknown;
}

export interface UpdatePluginPriorityRequest {
  priority: number;
}

export interface StatsResponse {
  totalApps: number;
  totalMessages: number;
  totalUsers: number;
  todayMessages: number;
  priorityStats: {
    low: number;
    normal: number;
    high: number;
  };
  messagesByDay: {
    date: string;
    count: number;
  }[];
  messagesByApp: {
    id: number;
    name: string;
    count: number;
  }[];
  messagesByHour: {
    hour: number;
    count: number;
  }[];
}

export interface Log {
  id: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  action: string;
  message: string;
  details: Record<string, unknown>;
  user_id: number | null;
  user_name: string | null;
  app_id: number | null;
  app_name: string | null;
  ip: string | null;
  created_at: string;
}

export interface LogsResponse {
  logs: Log[];
  total: number;
  limit: number;
  offset: number;
}

export interface LogStatsResponse {
  levelStats: Record<string, number>;
  categoryStats: { category: string; cnt: number }[];
  recentCount: number;
}
