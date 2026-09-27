import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { User, Class } from '../types';
import { cn } from '../lib/utils';
import { Plus, Edit, Trash2, Users as UsersIcon, GraduationCap, ShieldCheck } from 'lucide-react';

import ConfirmModal from '../components/ConfirmModal';

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'student' as User['role'],
    kelas: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const [allUsers, allClasses] = await Promise.all([
        db.users.getAll(),
        db.classes.getAll()
      ]);
      setUsers(allUsers);
      setClasses(allClasses.filter(c => c.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
    };
    fetchData();
  }, []);

  if (user?.role !== 'admin') {
    return <div>Akses Ditolak</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      const existing = users.find(u => u.id === editingId);
      if (!existing) return;
      
      const updatedUser: User = {
        ...existing,
        ...formData
      };
      await db.users.update(updatedUser);
      toast.success('Pengguna berhasil diperbarui');
    } else {
      const newUser: User = {
        id: `user-${Date.now()}`,
        ...formData
      };
      await db.users.add(newUser);
      toast.success('Pengguna berhasil ditambahkan');
    }
    
    const updatedUsers = await db.users.getAll();
    setUsers(updatedUsers);
    resetForm();
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ username: '', password: '', name: '', role: 'student', kelas: '' });
  };

  const handleEdit = (userToEdit: User) => {
    setFormData({
      username: userToEdit.username,
      password: userToEdit.password || '',
      name: userToEdit.name,
      role: userToEdit.role,
      kelas: userToEdit.kelas || ''
    });
    setEditingId(userToEdit.id);
    setIsAdding(true);
  };

  const openAddForm = (role: User['role']) => {
    resetForm();
    setFormData(prev => ({ ...prev, role }));
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (id === user?.id) return; // Prevent deleting self
    setDeleteId(id);
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.users.delete(deleteId);
      const updatedUsers = await db.users.getAll();
      setUsers(updatedUsers);
      setDeleteId(null);
      setIsDeleting(false);
      toast.success('Pengguna berhasil dihapus');
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setIsDeleting(false);
  };

  const UserSection = ({ title, role, icon: Icon, colorClass }: { title: string, role: User['role'], icon: any, colorClass: string }) => {
    const filteredUsers = users.filter(u => u.role === role);
    
    return (
      <div className="mb-10">
        <div className={cn("px-4 py-3 sm:px-6 flex items-center justify-between rounded-t-lg shadow-sm", colorClass)}>
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-white" />
            <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">{title}</h3>
            <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {filteredUsers.length}
            </span>
          </div>
          <button
            onClick={() => openAddForm(role)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-bold rounded-md text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-all"
          >
            <Plus className="h-3 w-3 mr-1" />
            TAMBAH
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {filteredUsers.map((person) => (
            <li key={person.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-100">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900 truncate">{person.name}</p>
                  </div>
                  <div className="mt-1 flex justify-between items-center">
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Username: <span className="font-medium text-gray-700">{person.username}</span></span>
                      {person.role === 'student' && <span>Kelas: <span className="font-medium text-gray-700">{person.kelas || '-'}</span></span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(person)}
                        className="p-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors shadow-sm"
                        title="Edit Pengguna"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {person.id !== user.id && (
                        <button
                          onClick={() => handleDelete(person.id)}
                          className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {filteredUsers.length === 0 && (
            <li className="bg-white shadow rounded-lg px-4 py-8 text-center text-gray-500 text-sm italic border border-gray-100">Belum ada data {title.toLowerCase()}.</li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Manajemen Pengguna</h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Kelola data admin, guru, dan siswa yang terdaftar dalam sistem.
          </p>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden border-2 border-emerald-500">
          <div className="bg-emerald-500 px-4 py-3">
            <h3 className="text-lg font-bold text-white">
              {editingId ? 'Edit Pengguna' : `Tambah ${formData.role === 'admin' ? 'Admin' : formData.role === 'teacher' ? 'Guru' : 'Siswa'} Baru`}
            </h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="grid grid-cols-6 gap-6">
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    id="username"
                    required
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    type="text"
                    name="password"
                    id="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                  />
                </div>

                {formData.role === 'student' && (
                  <div className="col-span-6 sm:col-span-3">
                    <label htmlFor="kelas" className="block text-sm font-medium text-gray-700">
                      Kelas
                    </label>
                    <select
                      name="kelas"
                      id="kelas"
                      required
                      value={formData.kelas}
                      onChange={e => setFormData({...formData, kelas: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {editingId ? 'Simpan Perubahan' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isDeleting}
        title="Hapus Pengguna"
        message="Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <div className="grid grid-cols-1 gap-6">
        <UserSection 
          title="Administrator" 
          role="admin" 
          icon={ShieldCheck} 
          colorClass="bg-indigo-600" 
        />
        <UserSection 
          title="Guru" 
          role="teacher" 
          icon={UsersIcon} 
          colorClass="bg-emerald-600" 
        />
        <UserSection 
          title="Siswa" 
          role="student" 
          icon={GraduationCap} 
          colorClass="bg-blue-600" 
        />
      </div>
    </div>
  );
}
