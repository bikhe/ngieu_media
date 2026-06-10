import { useEffect, useRef } from 'react';
import api from './api';

export const useUpdatesBroker = (entityTypes: string[], onUpdate: (log: any) => void) => {
  const lastIdRef = useRef<number>(0);
  const isConnectingRef = useRef<boolean>(false);

  useEffect(() => {
    let active = true;
    let sse: EventSource | null = null;
    let pollInterval: any = null;

    const startBroker = async () => {
      if (isConnectingRef.current) return;
      isConnectingRef.current = true;

      try {
        // 1. Fetch current maximum update log ID from backend
        const initRes = await api.get('updates/');
        lastIdRef.current = initRes.data.last_id || 0;

        // 2. Try to use Server-Sent Events (SSE) if supported
        const token = localStorage.getItem('access');
        
        // Construct the SSE URL. Vite development configuration might supply VITE_API_URL.
        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        
        // Remove trailing slash
        const apiBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
        const sseUrl = `${apiBase}/updates/?since_id=${lastIdRef.current}${token ? `&token=${token}` : ''}`;

        sse = new EventSource(sseUrl);

        sse.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              lastIdRef.current = data.last_id;
            } else if (data.type === 'updates') {
              data.logs.forEach((log: any) => {
                if (log.id > lastIdRef.current) {
                  lastIdRef.current = log.id;
                }
                if (entityTypes.includes(log.entity_type)) {
                  onUpdate(log);
                }
              });
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        };

        sse.onerror = (err) => {
          console.warn('SSE connection error, falling back to polling:', err);
          if (sse) {
            sse.close();
            sse = null;
          }
          // Start polling fallback if active
          if (active) startPolling();
        };

      } catch (err) {
        console.error('Failed to initialize updates broker:', err);
        if (active) startPolling();
      } finally {
        isConnectingRef.current = false;
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      
      const poll = async () => {
        if (!active) return;
        try {
          const res = await api.get(`updates/?since_id=${lastIdRef.current}`);
          const { last_id, logs } = res.data;
          
          if (last_id > lastIdRef.current) {
            lastIdRef.current = last_id;
          }

          logs.forEach((log: any) => {
            if (entityTypes.includes(log.entity_type)) {
              onUpdate(log);
            }
          });
        } catch (e) {
          console.error('Polling updates error:', e);
        }
      };

      // Poll every 4 seconds as a safe fallback
      pollInterval = setInterval(poll, 4000);
    };

    startBroker();

    return () => {
      active = false;
      if (sse) {
        sse.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [entityTypes, onUpdate]);
};
