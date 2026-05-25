/* ───────────────────────────────────────────────
   useWebSocket — Live prediction updates
   Auto-reconnects with exponential backoff
   ─────────────────────────────────────────────── */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketPayload } from '../types';

interface UseWebSocketReturn {
  data: WebSocketPayload | null;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/live-prediction`;
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;

export function useWebSocket(): UseWebSocketReturn {
  const [data, setData] = useState<WebSocketPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    // Clean up previous connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload: WebSocketPayload = JSON.parse(event.data);
          setData(payload);
        } catch {
          console.warn('Failed to parse WebSocket message:', event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnect
        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retriesRef.current);
          retriesRef.current++;
          timerRef.current = setTimeout(connect, delay);
        } else {
          setError('Connection lost. Max retries exceeded.');
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };
    } catch {
      setError('Failed to create WebSocket connection');
    }
  }, []);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { data, isConnected, error, reconnect };
}
