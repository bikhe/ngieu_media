import axios from 'axios';

interface EventRole {
  id: number;
  name: string;
}

export interface EventParticipant {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface Event {
  id: number;
  title: string;
  status: string;
  date: string;
  time?: string;
  end_time?: string;
  deadline?: string | null;
  short_comment?: string;
  description?: string;
  content_type?: string;
  document_link?: string;
  result_link?: string;
  max_participants?: number;
  location_ids?: number[];
  equipment_ids?: number[];
  responsible_person?: { id: number; username?: string; first_name?: string; last_name?: string; phone_number?: string } | null;
  media_participants?: EventParticipant[];
  locations?: { id: number; name: string }[];
  booked_equipment?: { id: number; name?: string }[];
  event_title?: string;
}

export interface AppUser {
  id: number;
  username: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  telegram_id?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  features?: Record<string, boolean>;
  can_approve_events?: boolean;
  can_manage_warehouse?: boolean;
  can_view_all_events?: boolean;
}

export interface Location {
  id: number;
  name: string;
}

export interface Comment {
  id: number;
  text: string;
  author?: { id?: number; username?: string; first_name?: string; last_name?: string };
  created_at?: string;
}

export interface Loan {
  id: number;
  status: string;
  quantity: number;
  equipment?: { name?: string; serial_number?: string };
  loan_start?: string | null;
  loan_end?: string | null;
  requested_at?: string | null;
  event_title?: string | null;
  event?: number | null;
  comment?: string;
}


export interface EventTemplate {
  id: number;
  name: string;
  content_type: string;
  max_participants: number;
  equipment?: number[];
}

export interface Equipment {
  id: number;
  name: string;
  total_quantity: number;
  available_quantity?: number;
  description?: string;
  serial_number?: string;
  status: string;
  category: string;
}

// Base API URL configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send/receive the httpOnly auth cookies
});

// Read the CSRF cookie (set by the backend at login) for unsafe methods.
const getCsrfToken = (): string => {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
};

// Attach the CSRF token to every unsafe request; required by the backend for
// cookie-authenticated POST/PUT/PATCH/DELETE.
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method) && config.headers) {
    config.headers['X-CSRFToken'] = getCsrfToken();
  }
  return config;
});

// Single-flight session refresh: on a 401, exchange the refresh cookie for a
// fresh access cookie once, then retry the original request.
let refreshPromise: Promise<boolean> | null = null;
const refreshSession = (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/token/refresh/`, {}, { withCredentials: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

interface RetriableConfig {
  __retried?: boolean;
}

// Response interceptor: transparently refresh an expired session.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (RetriableConfig & { url?: string }) | undefined;
    const url = original?.url || '';
    const isAuthCall = url.includes('/token/') || url.includes('/telegram/');
    // No csrftoken cookie means the user never logged in — skip the refresh.
    const hasSession = document.cookie.includes('csrftoken=');

    if (error.response?.status === 401 && !isAuthCall && hasSession && original && !original.__retried) {
      original.__retried = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  async login(username: string, password: string): Promise<boolean> {
    try {
      // The backend sets httpOnly auth cookies; nothing to store client-side.
      const res = await api.post('/token/', { username, password });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async register(username: string, password: string, inviteCode: string): Promise<boolean> {
    try {
      const res = await api.post('/register/', {
        username,
        password,
        invite_code: inviteCode,
      });
      return res.status === 200 || res.status === 201;
    } catch {
      return false;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/token/logout/');
    } catch {
      // Clearing cookies server-side failed — proceed with the local reload.
    }
    window.location.reload();
  },

  async getUserMe(): Promise<AppUser> {
    const res = await api.get('/users/me/');
    return res.data;
  },

  async updateProfile(fName: string, lName: string, tgId: string): Promise<boolean> {
    try {
      const res = await api.post('/users/me/', {
        first_name: fName,
        last_name: lName,
        telegram_id: tgId,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async changePassword(oldPassword: string | null, newPassword: string, initData?: string): Promise<boolean> {
    try {
      const res = await api.post('/users/change_password/', {
        old_password: oldPassword,
        new_password: newPassword,
        init_data: initData,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async getEvents(): Promise<{ results?: Event[] } | Event[]> {
    const res = await api.get('/events/');
    return res.data;
  },


  async getEquipment(): Promise<{ results?: Equipment[] } | Equipment[]> {
    const res = await api.get('/equipment/');
    return res.data;
  },

  async getTemplates(): Promise<EventTemplate[]> {
    const res = await api.get('/templates/');
    return res.data;
  },

  async saveTemplate(id: number | null, data: Partial<EventTemplate>): Promise<boolean> {
    try {
      if (id) {
        await api.put(`/templates/${id}/`, data);
      } else {
        await api.post('/templates/', data);
      }
      return true;
    } catch {
      return false;
    }
  },

  async deleteTemplate(id: number): Promise<boolean> {
    try {
      await api.delete(`/templates/${id}/`);
      return true;
    } catch {
      return false;
    }
  },

  async saveEvent(id: number | null, data: Record<string, unknown>): Promise<boolean> {
    try {
      if (id) {
        await api.put(`/events/${id}/`, data);
      } else {
        await api.post('/events/', data);
      }
      return true;
    } catch {
      return false;
    }
  },

  async deleteEvent(id: number): Promise<boolean> {
    try {
      await api.delete(`/events/${id}/`);
      return true;
    } catch {
      return false;
    }
  },

  async approveEvent(id: number): Promise<boolean> {
    try {
      await api.post(`/events/${id}/approve/`);
      return true;
    } catch {
      return false;
    }
  },

  async rejectEvent(id: number): Promise<boolean> {
    try {
      await api.post(`/events/${id}/reject/`);
      return true;
    } catch {
      return false;
    }
  },

  async getEventRoles(): Promise<EventRole[]> {
    const res = await api.get('/event-roles/');
    return res.data.results || res.data;
  },

  async createEventRole(name: string): Promise<EventRole> {
    const res = await api.post('/event-roles/', { name });
    return res.data as EventRole;
  },

  async getLocations(): Promise<Location[]> {
    const res = await api.get('/locations/');
    return res.data.results || res.data;
  },
  async createLocation(name: string): Promise<Location> {
    const res = await api.post('/locations/', { name });
    return res.data;
  },

  async getMediaUsers(): Promise<AppUser[]> {
    const res = await api.get('/users/', { params: { role: 'MEDIA' } });
    return res.data.results || res.data;
  },
  async assignParticipant(eventId: number, data: { user_id: number; role_id?: number; location_id?: number }): Promise<unknown> {
    const res = await api.post(`/events/${eventId}/assign_participant/`, data);
    return res.data;
  },
  async removeParticipant(eventId: number, userId: number): Promise<unknown> {
    const res = await api.post(`/events/${eventId}/remove_participant/`, { user_id: userId });
    return res.data;
  },

  async getLoans(): Promise<{ results?: Loan[] } | Loan[]> {
    const res = await api.get('/loans/');
    return res.data;
  },

  async createLoan(equipmentId: number, quantity: number, eventId?: number | null, comment?: string, loanStart?: string, loanEnd?: string): Promise<boolean> {
    try {
      const res = await api.post('/loans/', {
        equipment_id: equipmentId,
        quantity,
        event: eventId || null,
        comment: comment || '',
        loan_start: loanStart || null,
        loan_end: loanEnd || null,
      });
      return res.status === 200 || res.status === 201;
    } catch {
      return false;
    }
  },


  async requestLoanReturn(loanId: number): Promise<boolean> {
    try {
      const res = await api.post(`/loans/${loanId}/request_return/`);
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async takeTask(eventId: number, equipmentIds: number[], locationId?: number): Promise<{ success: boolean; error?: string }> {
    try {
      const payload: Record<string, unknown> = { equipment_ids: equipmentIds };
      if (locationId) payload.location_id = locationId;
      const res = await api.post(`/events/${eventId}/take_task/`, payload);
      return { success: res.status === 200 };
    } catch (e) {
      const errorMsg = axios.isAxiosError(e) ? (e.response?.data as { error?: string } | undefined)?.error : undefined;
      const msg = errorMsg || 'Не удалось записаться на задачу.';
      return { success: false, error: msg };
    }
  },

  async submitWork(eventId: number, resultLink: string): Promise<boolean> {
    try {
      const res = await api.post(`/events/${eventId}/submit_work/`, {
        result_link: resultLink,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async getComments(eventId: number): Promise<Comment[]> {
    try {
      const res = await api.get(`/events/${eventId}/comments/`);
      if (res.status === 200) {
        return res.data;
      }
      return [];
    } catch {
      return [];
    }
  },

  async postComment(eventId: number, text: string): Promise<boolean> {
    try {
      const res = await api.post(`/events/${eventId}/comments/`, { text });
      return res.status === 201;
    } catch {
      return false;
    }
  },

  async telegramLogin(initData: string): Promise<AppUser | null> {
    try {
      // The backend sets httpOnly auth cookies and returns the user payload.
      const res = await api.post<{ status: string; user: AppUser }>('/telegram/auth/', { init_data: initData });
      return res.status === 200 ? res.data.user : null;
    } catch {
      return null;
    }
  },

  async telegramRegister(username: string, inviteCode: string, initData: string): Promise<boolean> {
    try {
      const res = await api.post('/telegram/register/', {
        username,
        invite_code: inviteCode,
        init_data: initData,
      });
      return res.status === 200;
    } catch {
      return false;
    }
  },

  async telegramLink(initData: string): Promise<boolean> {
    try {
      const res = await api.post('/telegram/link/', { init_data: initData });
      return res.status === 200;
    } catch {
      return false;
    }
  },
};

export default api;
