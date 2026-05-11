import React, { useState } from 'react';
import { api, User } from '../lib/auth';

export function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user;
      if (isLogin) {
        user = await api.login(username, password);
      } else {
        user = await api.signup(username, password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-obsidian-800 p-6 rounded-xl shadow-2xl border border-white/10 max-w-md mx-auto mt-10 backdrop-blur-md">
      <h2 className="text-2xl font-bold text-white mb-4 font-sans">{isLogin ? 'Log In' : 'Sign Up'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-obsidian-900 border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-biocyan-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-obsidian-900 border border-white/10 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-biocyan-500"
            required
          />
        </div>
        {error && <div className="text-biocrimson-400 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm text-slate-400">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-biocyan-400 hover:text-biocyan-300 underline font-medium"
        >
          {isLogin ? 'Sign Up' : 'Log In'}
        </button>
      </div>
    </div>
  );
}
