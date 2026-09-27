import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { Class, Subject, TimeSlot } from '../types';
import { Plus, Edit, Trash2, Clock, BookOpen, GraduationCap, Users, Settings as SettingsIcon } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { cn } from '../lib/utils';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'classes' | 'subjects' | 'slots' | 'profile'>('profile');
  
  // Profile State
  const [appName, setAppName] = useState('Ujian Online');
  const [institutionName, setInstitutionName] = useState('Institusi');
  const [logoUrl, setLogoUrl] = useState('');
  const [isContinuousCameraEnabled, setIsContinuousCameraEnabled] = useState(false);
  const [cameraSnapshotInterval, setCameraSnapshotInterval] = useState(30);
  const [cameraQuality, setCameraQuality] = useState(30);
  const [isStartEndPhotoEnabled, setIsStartEndPhotoEnabled] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Classes State
  const [classes, setClasses] = useState<Class[]>([]);
  const [isEditingClass, setIsEditingClass] = useState(false);
  const [currentClass, setCurrentClass] = useState<Partial<Class>>({});
  
  // Subjects State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({});
  
  // TimeSlots State
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isEditingSlot, setIsEditingSlot] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotFormData, setSlotFormData] = useState({ name: '', startTime: '', endTime: '' });

  // Common State
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{ id: string, type: 'class' | 'subject' | 'slot' } | null>(null);

  useEffect(() => {
    fetchData();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const settings = await db.settings.get();
    if (settings) {
      setAppName(settings.appName);
      setInstitutionName(settings.institutionName);
      setLogoUrl(settings.logoUrl || '');
      setIsContinuousCameraEnabled(settings.isContinuousCameraEnabled || false);
      setCameraSnapshotInterval(settings.cameraSnapshotInterval || 30);
      setCameraQuality((settings.cameraQuality || 0.3) * 100);
      setIsStartEndPhotoEnabled(settings.isStartEndPhotoEnabled || false);
    }
  };

  const fetchData = async () => {
    const [allClasses, allSubjects, allSlots] = await Promise.all([
      db.classes.getAll(),
      db.subjects.getAll(),
      db.timeSlots.getAll()
    ]);
    setClasses(allClasses);
    setSubjects(allSubjects);
    setSlots(allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  };

  // Handlers for Profile
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await db.settings.update({ 
        id: 'app-settings', 
        appName, 
        institutionName, 
        logoUrl,
        isContinuousCameraEnabled,
        cameraSnapshotInterval,
        cameraQuality: cameraQuality / 100,
        isStartEndPhotoEnabled
      });
      document.title = `${appName} : ${institutionName}`;
      toast.success('Pengaturan profil berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal memperbarui profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handlers for Classes
  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass.name) return;
    if (currentClass.id) {
      await db.classes.update(currentClass as Class);
      toast.success('Kelas berhasil diperbarui');
    } else {
      await db.classes.add({ id: `class-${Date.now()}`, name: currentClass.name, isActive: true });
      toast.success('Kelas berhasil ditambahkan');
    }
    setIsEditingClass(false);
    setCurrentClass({});
    fetchData();
  };

  // Handlers for Subjects
  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSubject.name) return;
    if (currentSubject.id) {
      const oldSubject = subjects.find(s => s.id === currentSubject.id);
      const oldSubjectName = oldSubject?.name;
      const updatedSubject: Subject = {
        id: currentSubject.id,
        name: currentSubject.name,
        shuffleQuestions: currentSubject.shuffleQuestions ?? false,
      };
      await db.subjects.update(updatedSubject);
      toast.success('Mata pelajaran berhasil diperbarui');
      
      // Propagate change to exams
      const allExams = await db.exams.getAll();
      const examsToUpdate = allExams.filter(e => e.mapel === oldSubjectName || e.mapel === currentSubject.name);
      for (const exam of examsToUpdate) {
        await db.exams.update({ 
          ...exam, 
          mapel: currentSubject.name, 
          title: currentSubject.name,
          shuffleQuestions: updatedSubject.shuffleQuestions
        });
      }
    } else {
      await db.subjects.add({ 
        id: `subject-${Date.now()}`, 
        name: currentSubject.name,
        shuffleQuestions: currentSubject.shuffleQuestions ?? false
      });
      toast.success('Mata pelajaran berhasil ditambahkan');
    }
    setIsEditingSubject(false);
    setCurrentSubject({});
    fetchData();
  };

  // Handlers for TimeSlots
  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSlotId) {
      await db.timeSlots.update({ id: editingSlotId, ...slotFormData });
      toast.success('Jam ujian berhasil diperbarui');
    } else {
      await db.timeSlots.add({ id: `slot-${Date.now()}`, ...slotFormData });
      toast.success('Jam ujian berhasil ditambahkan');
    }
    setSlotFormData({ name: '', startTime: '', endTime: '' });
    setIsEditingSlot(false);
    setEditingSlotId(null);
    fetchData();
  };

  const confirmDelete = async () => {
    if (!deleteInfo) return;
    const { id, type } = deleteInfo;
    if (type === 'class') await db.classes.delete(id);
    if (type === 'subject') await db.subjects.delete(id);
    if (type === 'slot') await db.timeSlots.delete(id);
    fetchData();
    setIsDeleting(false);
    setDeleteInfo(null);
    toast.success('Data berhasil dihapus');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Pengaturan Sistem</h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Kelola data referensi untuk kelas, mata pelajaran, dan jam ujian.
          </p>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
            activeTab === 'profile' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Users className="h-5 w-5" />
          PROFIL
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={cn(
            "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
            activeTab === 'classes' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <GraduationCap className="h-5 w-5" />
          KELAS
        </button>
        <button
          onClick={() => setActiveTab('subjects')}
          className={cn(
            "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
            activeTab === 'subjects' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <BookOpen className="h-5 w-5" />
          MATA PELAJARAN
        </button>
        <button
          onClick={() => setActiveTab('slots')}
          className={cn(
            "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
            activeTab === 'slots' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Clock className="h-5 w-5" />
          JAM UJIAN
        </button>
      </div>

      {/* Profile Tab Content */}
      {activeTab === 'profile' && (
        <div className="bg-white shadow sm:rounded-lg p-6 max-w-2xl">
          <form onSubmit={handleProfileSave} className="space-y-6" autoComplete="off">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Ujian</label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                placeholder="Contoh: Ujian Akhir Semester"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Institusi</label>
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                placeholder="Contoh: SMK AL-HIDAYAH"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Logo Aplikasi</label>
              <div className="mt-2 flex items-center space-x-5">
                <div className="h-20 w-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <Plus className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  Ganti Logo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Pengaturan Kamera & Keamanan</h4>
              
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="flex items-center h-5">
                    <input
                      id="continuous-camera"
                      type="checkbox"
                      checked={isContinuousCameraEnabled}
                      onChange={(e) => {
                        setIsContinuousCameraEnabled(e.target.checked);
                        if (e.target.checked) setIsStartEndPhotoEnabled(false);
                      }}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="text-sm">
                    <label htmlFor="continuous-camera" className="font-bold text-gray-700">Akses Kamera Terus Menerus</label>
                    <p className="text-gray-500 text-xs">Jika aktif, siswa harus mengizinkan kamera selama ujian berlangsung. Jika kamera dimatikan, ujian tidak dapat dilanjutkan.</p>
                  </div>
                </div>

                {isContinuousCameraEnabled && (
                  <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Interval Snapshot (Detik)</label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={cameraSnapshotInterval}
                        onChange={(e) => setCameraSnapshotInterval(parseInt(e.target.value))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Kualitas Gambar (%)</label>
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={cameraQuality}
                        onChange={(e) => setCameraQuality(parseInt(e.target.value))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 pt-2 border-t border-gray-200 mt-2">
                  <div className="flex items-center h-5">
                    <input
                      id="start-end-photo"
                      type="checkbox"
                      checked={isStartEndPhotoEnabled}
                      onChange={(e) => {
                        setIsStartEndPhotoEnabled(e.target.checked);
                        if (e.target.checked) setIsContinuousCameraEnabled(false);
                      }}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="text-sm">
                    <label htmlFor="start-end-photo" className="font-bold text-gray-700">Foto Awal & Akhir Saja</label>
                    <p className="text-gray-500 text-xs">Jika aktif, kamera hanya diakses saat memulai ujian dan sesaat sebelum mengumpulkan jawaban.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-lg disabled:opacity-50"
              >
                {isSavingProfile ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes Tab Content */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Daftar Kelas</h3>
            {!isEditingClass && (
              <button
                onClick={() => { setCurrentClass({}); setIsEditingClass(true); }}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" /> TAMBAH KELAS
              </button>
            )}
          </div>

          {isEditingClass && (
            <div className="bg-white shadow sm:rounded-lg p-6 border-2 border-emerald-500">
              <form onSubmit={handleClassSubmit} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Kelas</label>
                  <input
                    type="text"
                    required
                    value={currentClass.name || ''}
                    onChange={(e) => setCurrentClass({ ...currentClass, name: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                    placeholder="Contoh: X RPL 1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="class-active"
                    checked={currentClass.isActive ?? true}
                    onChange={(e) => setCurrentClass({ ...currentClass, isActive: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label htmlFor="class-active" className="text-sm font-bold text-gray-700">Status Aktif</label>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setIsEditingClass(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800">BATAL</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-md">SIMPAN</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <div key={cls.id} className={cn(
                "bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow",
                cls.isActive === false ? "border-red-200 bg-red-50/30" : "border-gray-100"
              )}>
                <div className="flex flex-col">
                  <span className={cn("font-bold", cls.isActive === false ? "text-gray-500" : "text-emerald-700")}>{cls.name}</span>
                  <span className={cn("text-[10px] font-bold uppercase", cls.isActive === false ? "text-red-500" : "text-emerald-500")}>
                    {cls.isActive === false ? 'Tidak Aktif' : 'Aktif'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setCurrentClass(cls); setIsEditingClass(true); }} className="p-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => { setDeleteInfo({ id: cls.id, type: 'class' }); setIsDeleting(true); }} className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subjects Tab Content */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Daftar Mata Pelajaran</h3>
            {!isEditingSubject && (
              <button
                onClick={() => { setCurrentSubject({}); setIsEditingSubject(true); }}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" /> TAMBAH MAPEL
              </button>
            )}
          </div>

          {isEditingSubject && (
            <div className="bg-white shadow sm:rounded-lg p-6 border-2 border-emerald-500">
              <form onSubmit={handleSubjectSubmit} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Mata Pelajaran</label>
                  <input
                    type="text"
                    required
                    value={currentSubject.name || ''}
                    onChange={(e) => setCurrentSubject({ ...currentSubject, name: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                    placeholder="Contoh: Matematika"
                  />
                </div>

                <div className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      type="checkbox"
                      id="subject-shuffle"
                      checked={currentSubject.shuffleQuestions ?? false}
                      onChange={(e) => setCurrentSubject({ ...currentSubject, shuffleQuestions: e.target.checked })}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                  <div className="text-sm">
                    <label htmlFor="subject-shuffle" className="font-bold text-gray-800 cursor-pointer flex items-center gap-1.5">
                      <span>🔀</span> Acak Urutan Soal Ujian
                    </label>
                    <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">
                      Jika dicentang, urutan nomor soal pada mata pelajaran ini akan diacak untuk setiap siswa (misal: soal No 1 di siswa A menjadi No 10 di siswa B).
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditingSubject(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800">BATAL</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-md">SIMPAN</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <div key={subject.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex flex-col">
                  <span className="font-bold text-emerald-800">{subject.name}</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-full w-fit",
                    subject.shuffleQuestions 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {subject.shuffleQuestions ? '🔀 Soal Diacak' : '🔢 Urutan Asli'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setCurrentSubject(subject); setIsEditingSubject(true); }} className="p-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600" title="Edit Mapel"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => { setDeleteInfo({ id: subject.id, type: 'subject' }); setIsDeleting(true); }} className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700" title="Hapus Mapel"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TimeSlots Tab Content */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider">Daftar Jam Ujian</h3>
            {!isEditingSlot && (
              <button
                onClick={() => setIsEditingSlot(true)}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" /> TAMBAH JAM
              </button>
            )}
          </div>

          {isEditingSlot && (
            <div className="bg-white shadow sm:rounded-lg p-6 border-2 border-emerald-500">
              <form onSubmit={handleSlotSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3" autoComplete="off">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Jam</label>
                  <input
                    type="text"
                    required
                    value={slotFormData.name}
                    onChange={(e) => setSlotFormData({ ...slotFormData, name: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                    placeholder="Jam ke-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Waktu Mulai</label>
                  <input
                    type="time"
                    required
                    value={slotFormData.startTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Waktu Selesai</label>
                  <input
                    type="time"
                    required
                    value={slotFormData.endTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2.5 border"
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => { setIsEditingSlot(false); setEditingSlotId(null); setSlotFormData({ name: '', startTime: '', endTime: '' }); }} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800">BATAL</button>
                  <button type="submit" className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-md hover:bg-emerald-700 shadow-md">SIMPAN</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slots.map((slot) => (
              <div key={slot.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-full">
                    <Clock className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{slot.name}</div>
                    <div className="text-xs text-gray-500">{slot.startTime} - {slot.endTime}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSlotFormData({ name: slot.name, startTime: slot.startTime, endTime: slot.endTime }); setEditingSlotId(slot.id); setIsEditingSlot(true); }} className="p-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => { setDeleteInfo({ id: slot.id, type: 'slot' }); setIsDeleting(true); }} className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleting}
        title={`Hapus ${deleteInfo?.type === 'class' ? 'Kelas' : deleteInfo?.type === 'subject' ? 'Mata Pelajaran' : 'Jam Ujian'}`}
        message="Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDelete}
        onCancel={() => { setIsDeleting(false); setDeleteInfo(null); }}
      />
    </div>
  );
}
