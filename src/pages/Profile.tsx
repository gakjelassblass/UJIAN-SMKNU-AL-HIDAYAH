import React, { useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { User as UserIcon, Lock, Camera, Maximize, Monitor, ShieldCheck, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoUrl, setLogoUrl] = useState(user?.logoUrl || '');
  const [fullscreenLockExam, setFullscreenLockExam] = useState<boolean>(
    user?.fullscreenLockExam ?? true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 200;
            const MAX_HEIGHT = 200;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              setLogoUrl(canvas.toDataURL('image/png'));
            }
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (password && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Password baru dan konfirmasi password tidak cocok.' });
      toast.error('Password baru dan konfirmasi password tidak cocok.');
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const updatedUser = { ...user, username, logoUrl, fullscreenLockExam };
      if (password) {
        updatedUser.password = password;
      }
      
      await db.users.update(updatedUser);
      updateUser(updatedUser);
      setMessage({ type: 'success', text: 'Profil dan pengaturan layar berhasil disimpan.' });
      toast.success('Profil & pengaturan layar berhasil diperbarui');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menyimpan profil.' });
      toast.error('Terjadi kesalahan saat menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Profil Pengguna</h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Atur informasi akun Anda seperti username, password, dan preferensi tampilan layar ujian.
          </p>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg p-6 border border-gray-100">
        {message.text && (
          <div className={`mb-4 p-3 rounded-md text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6" autoComplete="off">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
              <Camera className="h-4 w-4" /> Foto Profil
            </label>
            <div className="mt-2 flex items-center space-x-5">
              <div className="h-20 w-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                {logoUrl ? (
                  <img src={logoUrl} alt="Foto Profil" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer"
              >
                Ganti Foto
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
            />
          </div>

          {/* Pengaturan Mode Layar Ujian (Full vs Normal) */}
          <div className="pt-5 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Maximize className="h-4 w-4 text-emerald-600" />
                Pengaturan Layar Ujian & Simulasi
              </h4>
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                fullscreenLockExam 
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                  : "bg-blue-100 text-blue-800 border border-blue-300"
              )}>
                {fullscreenLockExam ? '🔒 Mode: Layar Full (Terkunci)' : '🖥️ Mode: Layar Normal'}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Tentukan perilaku tampilan layar saat memulai pengerjaan ujian atau simulasi.
            </p>

            {/* Checkbox Utama */}
            <div 
              onClick={() => setFullscreenLockExam(!fullscreenLockExam)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 mb-3",
                fullscreenLockExam 
                  ? "bg-emerald-50/60 border-emerald-500 shadow-sm" 
                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                id="fullscreen-checkbox"
                type="checkbox"
                checked={fullscreenLockExam}
                onChange={(e) => setFullscreenLockExam(e.target.checked)}
                className="mt-1 h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <label htmlFor="fullscreen-checkbox" className="text-sm font-bold text-gray-900 cursor-pointer flex items-center gap-2">
                  <span>Centang untuk Mengaktifkan Layar Full (Kunci Semua Layar)</span>
                  {fullscreenLockExam && (
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Aktif
                    </span>
                  )}
                </label>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  <strong>Jika dicentang:</strong> Layar otomatis Fullscreen dan <strong>mengunci semua akses</strong> (anti keluar/tutup layar) sampai selesai mengumpulkan ujian.<br/>
                  <strong>Jika tidak dicentang:</strong> Ujian otomatis berjalan dalam mode <strong>Layar Normal</strong> standar tanpa paksaan fullscreen.
                </p>
              </div>
            </div>

            {/* 2 Pilihan Kartu Visual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div 
                onClick={() => setFullscreenLockExam(true)}
                className={cn(
                  "p-3.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between",
                  fullscreenLockExam
                    ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400 shadow-sm"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Maximize className="w-4 h-4 text-emerald-600" />
                      Layar Full (Terkunci)
                    </span>
                    {fullscreenLockExam && (
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 leading-snug">
                    Otomatis fullscreen & mengunci total layar ujian. Wajib fullscreen hingga siswa mengumpulkan ujian.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded inline-block">
                  🛡️ Mode Ujian Ketat & Aman
                </div>
              </div>

              <div 
                onClick={() => setFullscreenLockExam(false)}
                className={cn(
                  "p-3.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between",
                  !fullscreenLockExam
                    ? "bg-blue-50 border-blue-600 ring-2 ring-blue-400 shadow-sm"
                    : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      Layar Normal
                    </span>
                    {!fullscreenLockExam && (
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 leading-snug">
                    Ujian berjalan dalam ukuran jendela browser normal/biasa tanpa dipaksa fullscreen terkunci.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-1 rounded inline-block">
                  🖥️ Tampilan Standar Bebas
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Ubah Password (Opsional)
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                  placeholder="Biarkan kosong jika tidak ingin mengubah"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                  placeholder="Ulangi password baru"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-lg disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
