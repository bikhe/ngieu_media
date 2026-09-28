import { useEffect, useRef } from 'react';
import api from './api';

export interface UpdateLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  created_at?: string;
  payload?: Record<string, unknown>;
  extra_data?: { event_id?: number; [key: string]: unknown };
}

/**
 * Builds the SSE stream URL for the update broker.
 * The stream endpoint lives on the broker (port 8001) in local development.
 */
const buildStreamUrl = (sinceId: number, ticket: string): string => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const query = `since_id=${sinceId}&ticket=${encodeURIComponent(ticket)}`;

  // In local development, the backend API is on 8000 but the broker is on 8001.
  if (baseURL.includes('localhost:8000')) {
    return `http://localhost:8001/stream?${query}`;
  }
  const apiBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  return `${apiBase}/updates/stream?${query}`;
};

export const useUpdatesBroker = (entityTypes: string[], onUpdate: (log: UpdateLog) => void) => {
  const lastIdRef = useRef<number>(0);
  const sseRef = useRef<EventSource | null>(null);

  // Keep latest values in refs so the connection effect never needs to re-run
  // due to prop identity changes. Refs are only written from effects/callbacks.
  const entityTypesRef = useRef(entityTypes);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    entityTypesRef.current = entityTypes;
    onUpdateRef.current = onUpdate;
  }, [entityTypes, onUpdate]);

  useEffect(() => {
    // Only one SSE connection per hook instance; skip if already open
    if (sseRef.current) return;

    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (!active || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 1000);
    };

    const connect = async () => {
      if (!active || sseRef.current) return;
      try {
        // Exchange the regular JWT (via axios auth header) for a short-lived
        // ticket, so no long-lived credential ends up in the stream URL.
        const { data: ticketData } = await api.post<{ ticket: string; expires_in?: number }>('updates/');
        if (!active || !ticketData.ticket) return;

        const sse = new EventSource(buildStreamUrl(lastIdRef.current, ticketData.ticket));
        sseRef.current = sse;
        const refreshIn = Math.max(1000, ((ticketData.expires_in ?? 30) - 5) * 1000);
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          sse.close();
          sseRef.current = null;
          void connect();
        }, refreshIn);

        sse.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              lastIdRef.current = data.last_id;
            } else if (data.type === 'updates') {
              data.logs.forEach((log: UpdateLog) => {
                if (log.id > lastIdRef.current) {
                  lastIdRef.current = log.id;
                }
                if (entityTypesRef.current.includes(log.entity_type)) {
                  onUpdateRef.current(log);
                }
              });
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        };

        sse.onerror = () => {
          sse.close();
          if (sseRef.current === sse) sseRef.current = null;
          if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
          }
          scheduleReconnect();
        };

      } catch (err) {
        if (active) {
          console.error('Failed to initialize updates broker:', err);
          scheduleReconnect();
        }
      }
    };

    const initialize = async () => {
      try {
        const initRes = await api.get('updates/');
        if (active) {
          lastIdRef.current = initRes.data.last_id || 0;
          await connect();
        }
      } catch (err) {
        if (active) {
          console.error('Failed to initialize updates broker:', err);
          scheduleReconnect();
        }
      }
    };
    void initialize();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, []); // Run only once per mount — entityTypes/onUpdate are read via refs
};
