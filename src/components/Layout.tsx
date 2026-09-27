import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { User, AppSettings } from '../types';
import { Power, LayoutDashboard, Users, FileText, Settings, BookOpen, GraduationCap, Calendar, Clock, CheckCircle, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import ConfirmModal from './ConfirmModal';

export default function Layout() {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const settings = await db.settings.get();
      if (settings) {
        setAppSettings(settings);
        document.title = `${settings.appName} : ${settings.institutionName}`;
      }
    };
    fetchSettings();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Memuat...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student'] },
    { name: 'Hasil Ujian', href: '/results', icon: CheckCircle, roles: ['student'] },
    { name: 'Pengguna', href: '/users', icon: Users, roles: ['admin'] },
    { name: 'Bank Soal', href: '/exams', icon: FileText, roles: ['admin', 'teacher'] },
    { name: 'Jadwal Ujian', href: '/schedule', icon: Calendar, roles: ['admin'] },
    { name: 'Koreksi', href: '/grading', icon: CheckCircle, roles: ['teacher'] },
    { name: 'Setting', href: '/settings', icon: Settings, roles: ['admin'] },
    { name: 'Profil', href: '/profile', icon: UserIcon, roles: ['admin', 'teacher', 'student'] },
  ];

  const filteredNav = navigation.filter(item => item.roles.includes(user.role));
  
  const displayLogo = appSettings?.logoUrl;
  const displayTitle = appSettings?.appName || 'Ujian Online';
  const displayInstitution = appSettings?.institutionName || '';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Global Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-emerald-800 shadow-md z-30 text-white border-b-0 md:border-b border-emerald-700">
        <div className="flex items-center justify-between h-full w-full">
          {/* Left Area (Sidebar width on Desktop) */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 pl-4 sm:pl-6 h-full overflow-hidden md:w-64 md:border-r md:border-emerald-700">
            <div className="flex items-center gap-2 flex-shrink-0">
              {displayLogo && <img src={displayLogo} alt="Logo" className="h-10 w-auto max-w-[120px] object-contain" />}
              <div className="flex flex-col leading-tight">
                <h1 className="text-sm sm:text-xl font-bold text-white truncate max-w-[150px] sm:max-w-none" title={displayTitle}>{displayTitle}</h1>
                {/* Institution name on Mobile (hidden on Desktop) */}
                {displayInstitution && (
                  <h2 className="md:hidden text-[12px] font-bold text-emerald-200 truncate uppercase tracking-wider leading-none">
                    {displayInstitution}
                  </h2>
                )}
              </div>
            </div>
          </div>

          {/* Middle Area (Institution name on Desktop) */}
          <div className="hidden md:flex flex-1 items-center px-6 h-full overflow-hidden">
            {displayInstitution && (
              <h2 className="text-xl font-bold text-emerald-200 truncate uppercase tracking-wider leading-normal">
                {displayInstitution}
              </h2>
            )}
          </div>

          <div className="flex-1 md:hidden"></div>

          {/* Right Area (Logout on Mobile) */}
          <div className="flex items-center gap-4 flex-shrink-0 pr-4 sm:pr-6 md:hidden">
            <button onClick={() => setIsLogoutModalOpen(true)} className="flex items-center justify-center text-emerald-100 hover:text-white transition-colors bg-emerald-900 hover:bg-emerald-700 h-10 w-10 rounded-md">
              <Power className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onCancel={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          logout();
        }}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari aplikasi?"
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex pt-16">
        {/* Sidebar (Desktop) */}
        <div className="w-64 bg-emerald-800 shadow-md hidden md:flex flex-col text-white fixed bottom-0 top-16 left-0 z-20 border-r border-emerald-700">
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-2">
              {filteredNav.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      isActive
                        ? 'bg-emerald-900 text-white'
                        : 'text-emerald-100 hover:bg-emerald-700 hover:text-white',
                      'group flex items-center px-2 py-2 text-[12px] font-bold rounded-md transition-colors'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-white' : 'text-emerald-300 group-hover:text-emerald-200',
                        'mr-3 flex-shrink-0 h-5 w-5'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="p-4 border-t border-emerald-700 bg-emerald-900/50 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-700 border border-emerald-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user.logoUrl ? (
                  <img src={user.logoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-6 w-6 text-emerald-300" />
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-white truncate">{user.name}</span>
                <span className="text-xs font-medium text-emerald-200 capitalize truncate">
                  {user.role === 'admin' ? 'Admin' : user.role === 'teacher' || user.role === 'guru' ? 'Guru' : 'Siswa'}
                </span>
              </div>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="flex items-center justify-center gap-2 text-emerald-100 hover:text-white transition-colors bg-emerald-800 hover:bg-emerald-600 px-3 py-2 rounded-md w-full border border-emerald-700">
              <Power className="h-4 w-4" />
              <span className="text-sm font-bold">Keluar</span>
            </button>
          </div>
        </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0 md:ml-64">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>

    {/* Bottom Navigation (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-emerald-800 border-t border-emerald-700 z-20">
        <nav className="flex justify-around">
          {filteredNav.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive ? 'text-white bg-emerald-900' : 'text-emerald-200 hover:text-white hover:bg-emerald-700',
                  'flex flex-col items-center py-3 px-2 text-[12px] font-bold flex-1 transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-white' : 'text-emerald-300',
                    'h-6 w-6'
                  )}
                  aria-hidden="true"
                />
                <span className="hidden">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
