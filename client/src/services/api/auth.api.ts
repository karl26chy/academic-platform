import { http } from '../http';
import type { LoginResponse, User } from '../../types';

export interface LoginPayload {
  email?: string;
  identificacion?: string;
  password: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    http.post<LoginResponse>('/auth/login', payload, { isAuthAttempt: true }),
  getMe: () => http.get<User>('/auth/me'),
};
