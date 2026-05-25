/* ───────────────────────────────────────────────
   useApi — REST API client with JWT support
   Calls API Gateway at /api/*
   ─────────────────────────────────────────────── */

import { useState, useCallback } from 'react';
import type {
  PredictRequest,
  PredictResponse,
  BacktestResponse,
  SentimentHistoryResponse,
  AuthResponse,
} from '../types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('smptsa_token');
}

function setToken(token: string): void {
  localStorage.setItem('smptsa_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('smptsa_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Individual API functions ──

export async function fetchPrediction(
  payload: PredictRequest
): Promise<PredictResponse> {
  return apiFetch<PredictResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBacktest(
  ticker: string = 'XAUUSD',
  model?: string
): Promise<BacktestResponse> {
  const params = model ? `?model=${model}` : '';
  return apiFetch<BacktestResponse>(`/backtest/${ticker}${params}`);
}

export async function fetchSentimentHistory(
  days: number = 30
): Promise<SentimentHistoryResponse> {
  return apiFetch<SentimentHistoryResponse>(`/sentiment/history?days=${days}`);
}

export async function login(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Invalid credentials' }));
    throw new Error(body.error || 'Invalid credentials');
  }

  const data: AuthResponse = await res.json();
  setToken(data.access_token || data.token || '');
  return data;
}

export async function register(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(body.error || 'Registration failed');
  }

  const data: AuthResponse = await res.json();
  setToken(data.access_token || data.token || '');
  return data;
}

// ── Generic hook for loading state ──

export function useApiCall<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute };
}
