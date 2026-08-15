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
      const url = error.config?.url || '';
      if (!url.includes('/token/') && !url.includes('/telegram/')) {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        // Reload page to redirect back to login state
        window.location.reload();
      }
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

  async getSkills(): Promise<any[]> {
    const res = await api.get('/skills/');
    return res.data;
  },

  async getTemplates(): Promise<any[]> {
    const res = await api.get('/templates/');
    return res.data;
  },

  async saveTemplate(id: number | null, data: any): Promise<boolean> {
    try {
      if (id) {
        await api.put(`/templates/${id}/`, data);
      } else {
        await api.post('/templates/', data);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  async deleteTemplate(id: number): Promise<boolean> {
    try {
      await api.delete(`/templates/${id}/`);
      return true;
    } catch (e) {
      return false;
    }
  },

  async saveSkill(id: number | null, data: any): Promise<boolean> {
    try {
      if (id) {
        await api.put(`/skills/${id}/`, data);
      } else {
        await api.post('/skills/', data);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  async deleteSkill(id: number): Promise<boolean> {
    try {
      await api.delete(`/skills/${id}/`);
      return true;
    } catch (e) {
      return false;
    }
  },

  async getEquipment(): Promise<any> {
    const res = await api.get('/equipment/');
    return res.data;
  },

  async saveEvent(id: number | null, data: any): Promise<boolean> {
    try {
      if (id) {
        await api.put(`/events/${id}/`, data);
      } else {
        await api.post('/events/', data);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  async deleteEvent(id: number): Promise<boolean> {
    try {
      await api.delete(`/events/${id}/`);
      return true;
    } catch (e) {
      return false;
    }
  },

  async approveEvent(id: number): Promise<boolean> {
    try {
      await api.post(`/events/${id}/approve/`);
      return true;
    } catch (e) {
      return false;
    }
  },

  async rejectEvent(id: number): Promise<boolean> {
    try {
      await api.post(`/events/${id}/reject/`);
      return true;
    } catch (e) {
      return false;
    }
  },

  async getEventRoles(): Promise<any[]> {
    const res = await api.get('/event-roles/');
    return res.data.results || res.data;
  },

  async createEventRole(name: string): Promise<EventRole> {
    const res = await api.post('/event-roles/', { name });
    return res.data;
  },

  async getLocations(): Promise<any[]> {
    const res = await api.get('/locations/');
    return res.data.results || res.data;
  },
  async createLocation(name: string): Promise<any> {
    const res = await api.post('/locations/', { name });
    return res.data;
  },

  async getMediaUsers(): Promise<any[]> {
    const res = await api.get('/users/', { params: { role: 'MEDIA' } });
    return res.data.results || res.data;
  },
  async assignParticipant(eventId: number, data: { user_id: number; role_id?: number; location_id?: number }): Promise<any> {
    const res = await api.post(`/events/${eventId}/assign_participant/`, data);
    return res.data;
  },
  async removeParticipant(eventId: number, userId: number): Promise<any> {
    const res = await api.post(`/events/${eventId}/remove_participant/`, { user_id: userId });
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

  async takeTask(eventId: number, equipmentIds: number[], locationId?: number): Promise<{ success: boolean; error?: string }> {
    try {
      const payload: any = { equipment_ids: equipmentIds };
      if (locationId) payload.location_id = locationId;
      const res = await api.post(`/events/${eventId}/take_task/`, payload);
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
