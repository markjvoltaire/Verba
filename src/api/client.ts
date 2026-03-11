import Constants from 'expo-constants';

// Baked in at build time via app.config.js extra.apiUrl (so EAS builds work without .env)
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000';

export const apiClient = {
  baseUrl: API_URL,

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};
