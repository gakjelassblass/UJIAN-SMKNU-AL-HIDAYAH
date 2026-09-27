import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { Exam, ExamSchedule, Class, TimeSlot, User, AppSettings } from '../types';
import { Calendar, Plus, Edit, Trash2, Clock, Users, X } from 'lucide-react';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

export default function ExamSchedulePage() {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);
  const [formData, setFormData] = useState({
    examId: '',
    date: '',
    timeSlotId: '',
    kelas: '',
    selectedClasses: [] as string[],
    durationMinutes: 60,
    proctorId: '',
    korektorId: '',
    isStrictTime: true
  });

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [allSchedules, allExams, allClasses, allSlots, allUsers, settings] = await Promise.all([
        db.schedules.getAll(),
        db.exams.getAll(),
        db.classes.getAll(),
        db.timeSlots.getAll(),
        db.users.getAll(),
        db.settings.get()
      ]);
      setSchedules(allSchedules);
      setExams(allExams.filter(e => !e.isSimulation));
      setClasses(allClasses.filter(c => c.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
      setSlots(allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setTeachers(allUsers.filter(u => u.role === 'teacher' || u.role === 'admin'));
      if (settings) {
        setAppSettings(settings);
        if (settings.examStartDate && !selectedDate) {
          setSelectedDate(settings.examStartDate);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Gagal mengambil data dari database.');
    }
  };

  const openModal = (slotId?: string, className?: string, schedule?: ExamSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        examId: schedule.examId,
        date: schedule.date,
        timeSlotId: schedule.timeSlotId,
        kelas: schedule.kelas,
        selectedClasses: [schedule.kelas],
        durationMinutes: schedule.durationMinutes,
        proctorId: schedule.proctorId,
        korektorId: schedule.korektorId || '',
        isStrictTime: schedule.isStrictTime
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        examId: '',
        date: selectedDate,
        timeSlotId: slotId || '',
        kelas: className || '',
        selectedClasses: className ? [className] : [],
        durationMinutes: 60,
        proctorId: '',
        korektorId: '',
        isStrictTime: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedule) {
        await db.schedules.update({
          ...editingSchedule,
          ...formData,
          kelas: formData.selectedClasses[0] || formData.kelas
        });
        toast.success('Jadwal berhasil diperbarui');
      } else {
        const classesToSchedule = formData.selectedClasses.length > 0 
          ? formData.selectedClasses 
          : [formData.kelas];

        let addedCount = 0;
        for (const className of classesToSchedule) {
          if (!className) continue;
          
          // Check if already scheduled to avoid duplicates
          const existing = schedules.find(s => 
            s.date === formData.date && 
            s.timeSlotId === formData.timeSlotId && 
            s.kelas === className
          );
          
          if (existing) continue;

          await db.schedules.add({
            id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...formData,
            kelas: className,
            isActive: true,
            createdAt: Date.now()
          });
          addedCount++;
        }
        
        if (addedCount > 0) {
          toast.success(`${addedCount} jadwal berhasil ditambahkan`);
        } else {
          toast.error('Gagal menambahkan jadwal (mungkin sudah ada)');
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Gagal menyimpan jadwal. Silakan periksa koneksi atau izin database.');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.schedules.delete(deleteId);
      fetchData();
      toast.success('Jadwal berhasil dihapus');
    }
    setIsDeleting(false);
    setDeleteId(null);
  };

  const getScheduleAt = (slotId: string, className: string) => {
    return schedules.find(s => s.date === selectedDate && s.timeSlotId === slotId && s.kelas === className);
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  };

  const generateDateTabs = () => {
    if (!appSettings?.examStartDate || !appSettings?.examEndDate) return [];
    
    const start = new Date(appSettings.examStartDate + 'T00:00:00');
    const end = new Date(appSettings.examEndDate + 'T00:00:00');
    const dates = [];
    
    let current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const dateTabs = generateDateTabs();

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">
            Jadwal Ujian {appSettings?.examPeriodName ? `- ${appSettings.examPeriodName}` : ''}
          </h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Kelola jadwal pelaksanaan ujian untuk setiap kelas dan jam pengerjaan.
          </p>
        </div>
      </div>

      {dateTabs.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-200">
            {dateTabs.map((date, index) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "px-6 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors",
                  selectedDate === date
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <div className="uppercase tracking-wider">Hari ke-{index + 1}</div>
                <div className="text-xs font-normal mt-1">{getDayName(date)}, {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 w-full">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <span className="text-sm font-medium text-gray-500">Hari:</span>
              <span className="text-sm font-bold text-emerald-700 uppercase">{getDayName(selectedDate)}</span>
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-sm font-medium text-gray-500">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none focus:ring-0 text-sm font-bold text-emerald-700 p-0 bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 sticky left-0 bg-gray-50 z-10">
                Jam / Kelas
              </th>
              {classes.map(cls => (
                <th key={cls.id} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 min-w-[150px]">
                  {cls.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {slots.map(slot => (
              <tr key={slot.id}>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-200 sticky left-0 bg-white z-10">
                  <div className="font-bold">{slot.name}</div>
                  <div className="text-xs text-gray-500">{slot.startTime} - {slot.endTime}</div>
                </td>
                {classes.map(cls => {
                  const schedule = getScheduleAt(slot.id, cls.name);
                  return (
                    <td 
                      key={cls.id} 
                      className={cn(
                        "px-2 py-2 border border-gray-200 text-center relative group cursor-pointer transition-colors",
                        schedule ? "bg-emerald-50" : "hover:bg-gray-50"
                      )}
                      onClick={() => openModal(slot.id, cls.name, schedule)}
                    >
                      {schedule ? (
                        <div className="text-xs">
                          <div className="font-bold text-emerald-700 mb-1">
                            {exams.find(e => e.id === schedule.examId)?.mapel || 'Ujian'}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" /> {schedule.durationMinutes}m
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1 truncate" title={`Pengawas: ${teachers.find(t => t.id === schedule.proctorId)?.name || '-'}`}>
                            P: {teachers.find(t => t.id === schedule.proctorId)?.name || '-'}
                          </div>
                          <div className="text-[10px] text-emerald-600 truncate" title={`Korektor: ${teachers.find(t => t.id === schedule.korektorId)?.name || '-'}`}>
                            K: {teachers.find(t => t.id === schedule.korektorId)?.name || '-'}
                          </div>
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(schedule.id); }}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 text-emerald-600">
                          <Plus className="h-5 w-5 mx-auto" />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {slots.length === 0 && (
              <tr>
                <td colSpan={classes.length + 1} className="px-4 py-8 text-center text-gray-500">
                  Belum ada data jam pengerjaan. Silakan atur di menu Jam Ujian.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div 
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
            onClick={() => setIsModalOpen(false)}
            aria-hidden="true"
          ></div>
          
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-[10000]">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    {editingSchedule ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pilih Soal (Template)</label>
                    <select
                      required
                      value={formData.examId}
                      onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                    >
                      <option value="">-- Pilih Soal --</option>
                      {exams.map(exam => (
                        <option key={exam.id} value={exam.id}>
                          {exam.title} ({exam.mapel}) {exam.shuffleQuestions ? '🔀 [Soal Diacak]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Durasi (Menit)</label>
                      <input
                        type="number"
                        required
                        value={formData.durationMinutes}
                        onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pilih Kelas</label>
                      <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-gray-50">
                        {classes.map(cls => (
                          <label key={cls.id} className="flex items-center space-x-2 text-xs">
                            <input
                              type="checkbox"
                              checked={formData.selectedClasses.includes(cls.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({ ...formData, selectedClasses: [...formData.selectedClasses, cls.name] });
                                } else {
                                  setFormData({ ...formData, selectedClasses: formData.selectedClasses.filter(c => c !== cls.name) });
                                }
                              }}
                              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                            />
                            <span className="truncate">{cls.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Jam</label>
                      <select
                        required
                        value={formData.timeSlotId}
                        onChange={(e) => setFormData({ ...formData, timeSlotId: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                      >
                        <option value="">-- Pilih Jam --</option>
                        {slots.map(slot => (
                          <option key={slot.id} value={slot.id}>{slot.name} ({slot.startTime})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Pengawas</label>
                      <select
                        required
                        value={formData.proctorId}
                        onChange={(e) => setFormData({ ...formData, proctorId: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                      >
                        <option value="">-- Pilih Pengawas --</option>
                        {teachers.map(teacher => (
                          <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Korektor</label>
                      <select
                        required
                        value={formData.korektorId}
                        onChange={(e) => setFormData({ ...formData, korektorId: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm p-2 border"
                      >
                        <option value="">-- Pilih Korektor --</option>
                        {teachers.map(teacher => (
                          <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="isStrictTime"
                      type="checkbox"
                      checked={formData.isStrictTime}
                      onChange={(e) => setFormData({ ...formData, isStrictTime: e.target.checked })}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isStrictTime" className="ml-2 block text-sm text-gray-900">
                      Aktifkan Tepat Waktu (Strict Time)
                    </label>
                  </div>
                  <div className="mt-5 sm:mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
                    >
                      Simpan Jadwal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleting}
        title="Hapus Jadwal"
        message="Apakah Anda yakin ingin menghapus jadwal ujian ini?"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleting(false)}
      />
    </div>
  );
}
