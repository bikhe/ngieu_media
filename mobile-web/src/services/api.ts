import axios from 'axios';

// Base API URL configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
});

// Request interceptor to attach JWT token
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiry (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      // Reload page to redirect back to login state
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await api.post('/token/', { username, password });
      if (res.status === 200 && res.data.access) {
        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        return true;
      }
      return false;
    } catch (e) {
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
    } catch (e) {
      return false;
    }
  },

  logout(): void {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.reload();
  },

  async getUserMe(): Promise<any> {
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
    } catch (e) {
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
    } catch (e) {
      return false;
    }
  },

  async getEvents(): Promise<any> {
    const res = await api.get('/events/');
    return res.data;
  },

  async getEquipment(): Promise<any> {
    const res = await api.get('/equipment/');
    return res.data;
  },

  async getLoans(): Promise<any> {
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
    } catch (e) {
      return false;
    }
  },


  async requestLoanReturn(loanId: number): Promise<boolean> {
    try {
      const res = await api.post(`/loans/${loanId}/request_return/`);
      return res.status === 200;
    } catch (e) {
      return false;
    }
  },

  async takeTask(eventId: number, equipmentIds: number[]): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await api.post(`/events/${eventId}/take_task/`, {
        equipment_ids: equipmentIds,
      });
      return { success: res.status === 200 };
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Не удалось записаться на задачу.';
      return { success: false, error: errorMsg };
    }
  },

  async submitWork(eventId: number, resultLink: string): Promise<boolean> {
    try {
      const res = await api.post(`/events/${eventId}/submit_work/`, {
        result_link: resultLink,
      });
      return res.status === 200;
    } catch (e) {
      return false;
    }
  },

  async getComments(eventId: number): Promise<any[]> {
    try {
      const res = await api.get(`/events/${eventId}/comments/`);
      if (res.status === 200) {
        return res.data;
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  async postComment(eventId: number, text: string): Promise<boolean> {
    try {
      const res = await api.post(`/events/${eventId}/comments/`, { text });
      return res.status === 201;
    } catch (e) {
      return false;
    }
  },

  async telegramLogin(initData: string): Promise<any> {
    try {
      const res = await api.post('/telegram/auth/', { init_data: initData });
      if (res.status === 200 && res.data.access) {
        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        return res.data;
      }
      return null;
    } catch (e) {
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
      if (res.status === 200 && res.data.access) {
        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  async telegramLink(initData: string): Promise<boolean> {
    try {
      const res = await api.post('/telegram/link/', { init_data: initData });
      return res.status === 200;
    } catch (e) {
      return false;
    }
  },
};

export default api;
