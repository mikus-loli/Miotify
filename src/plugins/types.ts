export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license?: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PluginDefinition {
  meta: Omit<PluginMeta, 'enabled' | 'priority' | 'config' | 'created_at' | 'updated_at'>;
  defaultConfig?: Record<string, unknown>;
  hooks?: Partial<PluginHooks>;
  routes?: PluginRoute[];
  init?: (context: PluginContext) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
}

export interface PluginHooks {
  'message:beforeSend': (ctx: MessageContext, message: MessageInput) => MessageInput | null;
  'message:afterSend': (ctx: MessageContext, message: MessageOutput) => void;
  'message:onReceive': (ctx: MessageContext, message: MessageOutput) => void;
  'user:onCreate': (ctx: UserContext, user: UserInfo) => void;
  'user:onDelete': (ctx: UserContext, userId: number) => void;
  'app:onCreate': (ctx: AppContext, app: AppInfo) => void;
  'app:onDelete': (ctx: AppContext, appId: number) => void;
  'plugin:onEnable': (ctx: PluginContext) => void;
  'plugin:onDisable': (ctx: PluginContext) => void;
}

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: unknown, res: unknown) => void | Promise<void>;
}

export interface MessageInput {
  title?: string;
  message: string;
  priority?: number;
  appid: number;
}

export interface MessageOutput {
  id: number;
  appid: number;
  message: string;
  title: string;
  priority: number;
  created_at: string;
}

export interface UserInfo {
  id: number;
  name: string;
  admin: boolean;
}

export interface AppInfo {
  id: number;
  token: string;
  name: string;
  description: string;
  user_id: number;
}

export interface MessageContext {
  appId: number;
  appToken: string;
  userId: number;
}

export interface UserContext {
  adminId: number;
}

export interface AppContext {
  userId: number;
}

export interface PluginContext {
  pluginId: string;
  config: Record<string, unknown>;
  db: PluginDatabase;
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface PluginDatabase {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  delete: (key: string) => void;
}

export type HookName = keyof PluginHooks;
