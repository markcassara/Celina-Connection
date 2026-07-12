import type { Business, ClaimRequest, ReportedBug, Review, UserProfile } from '../types';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
    ...init,
  });
  return readJson<T>(response);
}

export const api = {
  bootstrap() {
    return request<{ businesses: Business[]; reportedBugs: ReportedBug[] }>('/api/bootstrap');
  },
  createBusiness(payload: Partial<Business> & { name: string; category: string; description: string; phone: string; email: string; tier: Business['tier'] }) {
    return request<Business>('/api/businesses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateBusiness(id: string, payload: Partial<Business>) {
    return request<Business>(`/api/businesses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deleteBusiness(id: string) {
    return request<void>(`/api/businesses/${id}`, {
      method: 'DELETE',
    });
  },
  claimBusiness(id: string, email: string) {
    return request<{ business: Business; currentUser: UserProfile }>(`/api/businesses/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  createClaimRequest(payload: Pick<ClaimRequest, 'businessId' | 'requesterName' | 'requesterEmail' | 'requesterPhone' | 'role'> & Partial<Pick<ClaimRequest, 'proofUrl' | 'notes'>>) {
    return request<ClaimRequest>('/api/claims', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  adminLogin(password: string) {
    return request<{ authenticated: boolean }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
  adminSession() {
    return request<{ authenticated: boolean }>('/api/admin/session');
  },
  addReview(id: string, payload: Omit<Review, 'id' | 'createdAt'>) {
    return request<{ business: Business; review: Review }>(`/api/businesses/${id}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  createBug(payload: Omit<ReportedBug, 'id' | 'createdAt' | 'status'>) {
    return request<ReportedBug>('/api/bugs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateBug(id: string, payload: Partial<ReportedBug>) {
    return request<ReportedBug>(`/api/bugs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deleteBug(id: string) {
    return request<void>(`/api/bugs/${id}`, {
      method: 'DELETE',
    });
  },
  resetDatabase() {
    return request<{ businesses: Business[]; reportedBugs: ReportedBug[] }>('/api/admin/reset', {
      method: 'POST',
    });
  },
};
