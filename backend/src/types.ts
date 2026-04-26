export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ALLOW_REGISTRATION?: string;
}

export interface JwtPayload {
  managerId: number;
  username: string;
  tenantId: number;
}

// 通用响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}
