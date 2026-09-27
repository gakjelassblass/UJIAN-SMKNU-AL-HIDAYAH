import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { User } from '../types';
import { BookOpen } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminAndSettings = async () => {
      const [admin, foundSettings] = await Promise.all([
        db.users.getById('admin-1'),
        db.settings.get()
      ]);
      if (admin) setAdminUser(admin);
      if (foundSettings) {
        setSettings(foundSettings);
        document.title = `${foundSettings.appName} : ${foundSettings.institutionName}`;
      }
    };
    fetchAdminAndSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      toast.success('Login berhasil');
      navigate('/dashboard');
    } else {
      setError('Username atau password salah');
      toast.error('Username atau password salah');
    }
  };

  const displayTitle = adminUser?.name && adminUser.name !== 'Administrator' ? adminUser.name : 'Sistem Ujian Online';

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {adminUser?.logoUrl ? (
            <img src={adminUser.logoUrl} alt="Logo" className="h-20 w-20 object-contain" />
          ) : (
            <BookOpen className="h-16 w-16 text-white" />
          )}
        </div>
        <h2 className="mt-6 text-center text-[20px] font-extrabold text-white">
          {displayTitle}
        </h2>
        {settings?.institutionName && (
          <p className="mt-0 sm:mt-1 text-center text-[12px] sm:text-[15px] font-extrabold text-white uppercase tracking-wider leading-tight">
            {settings.institutionName}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
              >
                Masuk
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-800 mb-1">
                Akun Default Administrator:
              </p>
              <div className="text-xs text-gray-700 flex flex-col gap-0.5 font-mono">
                <div>Username: <span className="font-bold text-emerald-900">admin</span></div>
                <div>Password: <span className="font-bold text-emerald-900">password</span></div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('password');
                }}
                className="mt-2 text-xs font-medium text-emerald-700 bg-white hover:bg-emerald-100 border border-emerald-300 rounded px-2.5 py-1 w-full text-center transition-colors"
              >
                Isi Otomatis Akun Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
