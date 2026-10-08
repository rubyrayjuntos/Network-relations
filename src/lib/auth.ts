import type { Preferences } from "./settingsRegistry";

export type { Preferences };

export type User = {
  id: number;
  username: string;
};

export const api = {
  async signup(username: string, password: string):Promise<User> {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Signup failed');
    }
    return res.json();
  },

  async login(username: string, password: string):Promise<User> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async logout() {
    await fetch('/api/logout', { method: 'POST' });
  },

  async getMe():Promise<User | null> {
    const res = await fetch('/api/me');
    if (!res.ok) return null;
    return res.json();
  },

  async getPreferences():Promise<Preferences | null> {
    const res = await fetch('/api/preferences');
    if (!res.ok) return null;
    return res.json();
  },

  async savePreferences(prefs: Preferences) {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not save preferences');
    }
  },

  async getOperator(): Promise<Record<string, unknown>> {
    const res = await fetch('/api/operator');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Operator readout failed');
    }
    return res.json();
  }
};
