import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { Exam, Question, User, Class, Subject, ExamSchedule, Attempt, TimeSlot, AppSettings } from '../types';
import {
  Upload,
  Plus,
  Trash2,
  Edit,
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  ClipboardPaste,
  RefreshCw,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import QuestionFormatModal from '../components/QuestionFormatModal';
import { parseDocumentFile, parseTextToQuestions } from '../lib/documentParser';

export default function Exams() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [expandedSimulationId, setExpandedSimulationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'template' | 'simulation' | 'settings'>('template');
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [periodSettings, setPeriodSettings] = useState({
    name: '',
    startDate: '',
    endDate: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAttemptId, setDeleteAttemptId] = useState<string | null>(null);
  const [isDeletingAttempt, setIsDeletingAttempt] = useState(false);

  // Upload & Parsing States
  const [uploadMethod, setUploadMethod] = useState<'file' | 'paste'>('file');
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [pasteText, setPasteText] = useState<string>('');
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    mapel: '',
    durationMinutes: 60,
    mcqScore: 2,
    essayMaxScore: 4,
  });
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [allExams, allSchedules, allUsers, allClasses, allSubjects, allAttempts, allSlots, settings] = await Promise.all([
        db.exams.getAll(),
        db.schedules.getAll(),
        db.users.getAll(),
        db.classes.getAll(),
        db.subjects.getAll(),
        db.attempts.getAll(),
        db.timeSlots.getAll(),
        db.settings.get()
      ]);

      setExams(allExams);
      setSchedules(allSchedules);
      setTeachers(allUsers.filter(u => u.role === 'teacher' || u.role === 'guru' || u.role === 'admin'));
      setStudents(allUsers.filter(u => u.role === 'student'));
      setClasses(allClasses.filter(c => c.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
      setSubjects(allSubjects);
      setAttempts(allAttempts);
      setSlots(allSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)));

      if (settings) {
        setAppSettings(settings);
        setPeriodSettings({
          name: settings.examPeriodName || '',
          startDate: settings.examStartDate || '',
          endDate: settings.examEndDate || ''
        });
      }
    };
    fetchData();
  }, []);

  if (user?.role !== 'admin' && user?.role !== 'teacher') {
    return <div>Akses Ditolak</div>;
  }

  // Handle File Upload (PDF, Word DOCX, Excel XLSX/XLS)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsParsing(true);
    setParseStatus(`Membaca file ${file.name}...`);

    try {
      if (file.name.endsWith('.pdf')) {
        setParseStatus('Mengekstrak teks halaman PDF...');
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        setParseStatus('Mengekstrak dokumen Word (.docx)...');
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setParseStatus('Membaca lembar kerja Excel...');
      }

      const result = await parseDocumentFile(file, formData.essayMaxScore);
      
      if (result.questions.length === 0) {
        toast.error('Tidak ditemukan butir soal yang sesuai format. Silakan periksa panduan format.');
      } else {
        setParsedQuestions(result.questions);
        toast.success(`Berhasil memuat ${result.questions.length} soal (${result.mcqCount} Pilihan Ganda, ${result.essayCount} Essay)`);
        if (result.warnings.length > 0) {
          toast.warning(result.warnings[0]);
        }
      }
    } catch (err: any) {
      console.error('Error parsing document:', err);
      toast.error(err?.message || 'Gagal memproses file. Pastikan file valid.');
    } finally {
      setIsParsing(false);
      setParseStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Manual Text Paste
  const handleProcessPasteText = () => {
    if (!pasteText.trim()) {
      toast.error('Silakan tempel teks soal terlebih dahulu');
      return;
    }

    setIsParsing(true);
    setParseStatus('Menganalisis teks soal...');

    try {
      const result = parseTextToQuestions(pasteText, formData.essayMaxScore);
      if (result.questions.length === 0) {
        toast.error('Tidak ditemukan butir soal yang sesuai format. Silakan periksa panduan format.');
      } else {
        setParsedQuestions(result.questions);
        setUploadedFileName('Teks Ditempel');
        toast.success(`Berhasil mendeteksi ${result.questions.length} soal (${result.mcqCount} Pilihan Ganda, ${result.essayCount} Essay)`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Gagal memproses teks soal.');
    } finally {
      setIsParsing(false);
      setParseStatus('');
    }
  };

  // Question editing helpers
  const handleUpdateQuestion = (index: number, updated: Question) => {
    const updatedList = [...parsedQuestions];
    updatedList[index] = updated;
    setParsedQuestions(updatedList);
  };

  const handleDeleteQuestion = (index: number) => {
    const updatedList = parsedQuestions.filter((_, i) => i !== index);
    setParsedQuestions(updatedList);
    toast.info(`Soal no. ${index + 1} dihapus`);
  };

  const handleToggleQuestionType = (index: number) => {
    const target = parsedQuestions[index];
    if (target.type === 'multiple_choice') {
      handleUpdateQuestion(index, {
        ...target,
        type: 'essay',
        maxScore: target.maxScore || formData.essayMaxScore || 4,
      });
    } else {
      handleUpdateQuestion(index, {
        ...target,
        type: 'multiple_choice',
        options: target.options || { A: '', B: '', C: '', D: '', E: '' },
        correctAnswer: target.correctAnswer?.charAt(0) || 'A',
      });
    }
  };

  const handleAddBlankQuestion = () => {
    const newQ: Question = {
      id: `q-manual-${Date.now()}`,
      text: '',
      type: 'multiple_choice',
      options: { A: '', B: '', C: '', D: '', E: '' },
      correctAnswer: 'A',
    };
    setParsedQuestions([...parsedQuestions, newQ]);
    setExpandedQuestionIdx(parsedQuestions.length);
    toast.success('Soal baru ditambahkan. Silakan lengkapi teks dan pilihannya.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedQuestions.length === 0) {
      toast.error('Silakan upload file soal (PDF, Word, atau Excel) terlebih dahulu');
      return;
    }

    // Validate that questions have non-empty text
    const emptyQuestionIdx = parsedQuestions.findIndex(q => !q.text || !q.text.trim());
    if (emptyQuestionIdx !== -1) {
      toast.error(`Soal nomor ${emptyQuestionIdx + 1} masih kosong. Harap lengkapi teks soal.`);
      setExpandedQuestionIdx(emptyQuestionIdx);
      return;
    }

    // Validate MC questions have options
    const invalidMcq = parsedQuestions.findIndex(q => {
      if (q.type !== 'multiple_choice') return false;
      const opts = q.options || {};
      return !opts.A && !opts.B && !opts.C;
    });
    if (invalidMcq !== -1) {
      toast.error(`Soal nomor ${invalidMcq + 1} belum memiliki pilihan jawaban.`);
      setExpandedQuestionIdx(invalidMcq);
      return;
    }

    if (editingId) {
      const existing = exams.find(e => e.id === editingId);
      if (!existing) return;

      const updatedExam: Exam = {
        ...existing,
        title: formData.mapel,
        mapel: formData.mapel,
        questions: parsedQuestions.map(q => q.type === 'essay' ? { ...q, maxScore: q.maxScore || formData.essayMaxScore } : q),
        durationMinutes: formData.durationMinutes,
        mcqScore: formData.mcqScore,
        korektorId: activeTab === 'simulation' ? (teachers.find(t => t.role === 'admin')?.id || user.id) : '',
        isSimulation: activeTab === 'simulation'
      };
      await db.exams.update(updatedExam);
      toast.success('Bank soal berhasil diperbarui');
      
      if (existing.mapel !== formData.mapel) {
        if (!subjects.find(s => s.name === formData.mapel)) {
          await db.subjects.add({
            id: `subject-${Date.now()}`,
            name: formData.mapel
          });
        }
      }
    } else {
      if (!subjects.find(s => s.name === formData.mapel)) {
        await db.subjects.add({
          id: `subject-${Date.now()}`,
          name: formData.mapel
        });
      }

      const newExam: Exam = {
        id: `exam-${Date.now()}`,
        title: formData.mapel,
        mapel: formData.mapel,
        teacherId: user.id,
        korektorId: activeTab === 'simulation' ? (teachers.find(t => t.role === 'admin')?.id || user.id) : '',
        mcqScore: formData.mcqScore,
        questions: parsedQuestions.map(q => q.type === 'essay' ? { ...q, maxScore: q.maxScore || formData.essayMaxScore } : q),
        isActive: false,
        durationMinutes: formData.durationMinutes,
        isSimulation: activeTab === 'simulation',
        createdAt: Date.now()
      };
      await db.exams.add(newExam);
      toast.success('Bank soal berhasil ditambahkan');
    }

    const updatedExams = await db.exams.getAll();
    setExams(updatedExams);
    resetForm();
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ mapel: '', durationMinutes: 60, mcqScore: 2, essayMaxScore: 4 });
    setParsedQuestions([]);
    setUploadedFileName('');
    setPasteText('');
    setExpandedQuestionIdx(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (exam: Exam) => {
    setFormData({
      mapel: exam.mapel || '',
      durationMinutes: exam.durationMinutes || 60,
      mcqScore: exam.mcqScore || 2,
      essayMaxScore: exam.questions.find(q => q.type === 'essay')?.maxScore || 4,
    });
    setParsedQuestions(exam.questions);
    setEditingId(exam.id);
    setIsAdding(true);
  };

  const toggleStatus = async (exam: Exam) => {
    const updated = { ...exam, isActive: !exam.isActive };
    await db.exams.update(updated);
    const updatedExams = await db.exams.getAll();
    setExams(updatedExams);
    toast.success(`Ujian ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    setIsDeleting(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.exams.delete(deleteId);
      const updatedExams = await db.exams.getAll();
      setExams(updatedExams);
      setDeleteId(null);
      setIsDeletingAttempt(false);
      setIsDeleting(false);
      toast.success('Bank soal berhasil dihapus');
    }
  };

  const confirmDeleteAttempt = async () => {
    if (deleteAttemptId) {
      await db.attempts.delete(deleteAttemptId);
      const allAttempts = await db.attempts.getAll();
      setAttempts(allAttempts);
      setDeleteAttemptId(null);
      setIsDeletingAttempt(false);
      toast.success('Riwayat simulasi berhasil dihapus');
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
    setIsDeleting(false);
    setDeleteAttemptId(null);
    setIsDeletingAttempt(false);
  };

  const handleSavePeriodSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appSettings) return;

    const updatedSettings: AppSettings = {
      ...appSettings,
      examPeriodName: periodSettings.name,
      examStartDate: periodSettings.startDate,
      examEndDate: periodSettings.endDate
    };

    await db.settings.update(updatedSettings);
    setAppSettings(updatedSettings);
    toast.success('Pengaturan periode ujian berhasil disimpan');
  };

  const mcqCount = parsedQuestions.filter(q => q.type === 'multiple_choice').length;
  const essayCount = parsedQuestions.filter(q => q.type === 'essay').length;
  const missingAnswerCount = parsedQuestions.filter(q => q.type === 'multiple_choice' && !q.correctAnswer).length;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">
            {activeTab === 'template' ? 'Bank Soal (Template Ujian)' : activeTab === 'simulation' ? 'Simulasi Ujian' : 'Pengaturan Periode Ujian'}
          </h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            {activeTab === 'template' 
              ? 'Kelola bank soal ujian dengan mudah. Mendukung upload file Word (.docx), PDF (.pdf), dan Excel (.xlsx) atau salin-tempel teks soal.'
              : activeTab === 'simulation'
              ? 'Kelola ujian simulasi yang dapat diakses siswa kapan saja tanpa jadwal.'
              : 'Atur rentang tanggal pelaksanaan ujian dan nama periode ujian.'}
          </p>
        </div>
        {activeTab !== 'settings' && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFormatModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 border border-emerald-600 text-xs font-semibold rounded-md text-emerald-700 bg-white hover:bg-emerald-50 shadow-sm transition-all"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Panduan Format Word & PDF
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              TAMBAH {activeTab === 'template' ? 'BANK SOAL' : 'SIMULASI'}
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {user?.role === 'admin' && (
          <>
            <button
              onClick={() => { setActiveTab('template'); resetForm(); }}
              className={cn(
                "px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'template' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              TEMPLATE UJIAN
            </button>
            <button
              onClick={() => { setActiveTab('simulation'); resetForm(); }}
              className={cn(
                "px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'simulation' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              SIMULASI UJIAN
            </button>
            <button
              onClick={() => { setActiveTab('settings'); resetForm(); }}
              className={cn(
                "px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap",
                activeTab === 'settings' ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              PENGATURAN JADWAL
            </button>
          </>
        )}
      </div>

      {/* Form Tambah / Edit Bank Soal */}
      {isAdding && activeTab !== 'settings' && (
        <div className="mt-6 bg-white shadow-lg border border-emerald-100 px-4 py-5 sm:rounded-xl sm:p-6 transition-all">
          <div className="flex items-center justify-between border-b pb-4 mb-5">
            <div>
              <h3 className="text-lg font-bold leading-6 text-gray-900">
                {editingId ? 'Edit Bank Soal' : `Buat ${activeTab === 'template' ? 'Bank Soal' : 'Simulasi'} Baru`}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Upload naskah soal dalam format <strong>PDF</strong>, <strong>Word (.docx)</strong>, atau <strong>Excel (.xlsx)</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormatModalOpen(true)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Lihat Panduan Format
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label htmlFor="mapel" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Mata Pelajaran <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="mapel"
                    id="mapel"
                    list="mapel-list"
                    required
                    value={formData.mapel}
                    onChange={e => setFormData({ ...formData, mapel: e.target.value })}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                    placeholder="Contoh: Matematika, Bahasa Indonesia, Produktif TKJ..."
                  />
                  <datalist id="mapel-list">
                    {subjects.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="durationMinutes" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Durasi Ujian (Menit) <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="durationMinutes"
                    id="durationMinutes"
                    required
                    min="1"
                    value={formData.durationMinutes}
                    onChange={e => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-6 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <div>
                  <label htmlFor="mcqScore" className="block text-xs font-semibold text-gray-700">
                    Skor Tiap Soal Pilihan Ganda
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="mcqScore"
                      id="mcqScore"
                      required
                      min="1"
                      value={formData.mcqScore}
                      onChange={e => setFormData({ ...formData, mcqScore: parseInt(e.target.value) || 1 })}
                      className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border bg-white"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      * Nilai PG = (Jumlah Benar) x (Skor per soal).
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="essayMaxScore" className="block text-xs font-semibold text-gray-700">
                    Standar Maksimal Skor Essay (Per Butir)
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="essayMaxScore"
                      id="essayMaxScore"
                      required
                      min="1"
                      value={formData.essayMaxScore}
                      onChange={e => setFormData({ ...formData, essayMaxScore: parseInt(e.target.value) || 10 })}
                      className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border bg-white"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      * Batas nilai maksimal saat guru mengoreksi essay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Area Upload Soal (Word, PDF, Excel & Paste Text) */}
              <div className="sm:col-span-6 border-t pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Input Naskah Soal:
                    </span>
                    <div className="inline-flex rounded-md shadow-sm">
                      <button
                        type="button"
                        onClick={() => setUploadMethod('file')}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-l-md border transition-colors",
                          uploadMethod === 'file'
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        Upload File (PDF / Word / Excel)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMethod('paste')}
                        className={cn(
                          "px-3 py-1 text-xs font-semibold rounded-r-md border-t border-r border-b transition-colors",
                          uploadMethod === 'paste'
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        Salin & Tempel Teks
                      </button>
                    </div>
                  </div>

                  {parsedQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddBlankQuestion}
                      className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md border border-emerald-300 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Tambah Butir Soal Manual
                    </button>
                  )}
                </div>

                {/* Option 1: File Upload (PDF, Word, Excel) */}
                {uploadMethod === 'file' && (
                  <div className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-6 text-center transition-all bg-emerald-50/20">
                    <div className="flex justify-center items-center gap-3 mb-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shadow-sm" title="Microsoft Word (.docx)">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="p-2.5 bg-red-100 text-red-700 rounded-lg shadow-sm" title="Dokumen PDF (.pdf)">
                        <FileCode className="h-6 w-6" />
                      </div>
                      <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shadow-sm" title="Microsoft Excel (.xlsx)">
                        <FileSpreadsheet className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-gray-800">
                      Pilih dokumen soal dari komputer Anda
                    </div>
                    <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                      Mendukung format file <strong>Word (.docx)</strong>, <strong>PDF (.pdf)</strong>, atau <strong>Excel (.xlsx, .xls)</strong>.
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <label
                        htmlFor="file-upload"
                        className={cn(
                          "cursor-pointer inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all",
                          isParsing && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isParsing ? 'Mengekstrak Soal...' : 'Pilih File (Word / PDF / Excel)'}
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          accept=".docx, .doc, .pdf, .xlsx, .xls, .txt"
                          className="sr-only"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          disabled={isParsing}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsFormatModalOpen(true)}
                        className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
                      >
                        <HelpCircle className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                        Lihat Contoh Format Dokumen
                      </button>
                    </div>

                    {isParsing && (
                      <div className="mt-4 max-w-sm mx-auto flex items-center justify-center gap-2 text-xs text-emerald-700 font-medium">
                        <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                        <span>{parseStatus || 'Sedang memproses dokumen...'}</span>
                      </div>
                    )}

                    {uploadedFileName && !isParsing && (
                      <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-100/60 px-3 py-1 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        File aktif: {uploadedFileName}
                      </div>
                    )}
                  </div>
                )}

                {/* Option 2: Copy-Paste Text Area */}
                {uploadMethod === 'paste' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Buka dokumen soal Anda di Word, Google Docs, atau Notepad, lalu <strong>Select All (Ctrl+A)</strong> dan <strong>Copy (Ctrl+C)</strong>, kemudian tempelkan di kotak bawah ini:
                    </p>
                    <textarea
                      rows={8}
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={`Contoh teks soal:

1. Ibu kota negara Republik Indonesia adalah ...
A. Surabaya
B. Bandung
C. Jakarta
D. Medan
E. Semarang
Kunci: C

2. Jelaskan fungsi dari RAM pada sistem komputer!
Kunci: Menyimpan data instruksi sementara saat komputer menyala.
Skor: 10`}
                      className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setIsFormatModalOpen(true)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Format yang Didukung
                      </button>

                      <button
                        type="button"
                        onClick={handleProcessPasteText}
                        disabled={isParsing || !pasteText.trim()}
                        className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-all"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                        {isParsing ? 'Menganalisis...' : 'Proses & Ekstrak Soal'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Question Verification & Interactive Editor Area */}
                {parsedQuestions.length > 0 && (
                  <div className="mt-6 border-t pt-5 space-y-4">
                    {/* Summary Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-emerald-600" />
                          <h4 className="font-bold text-sm text-emerald-900">
                            Pratinjau & Verifikasi Soal ({parsedQuestions.length} Butir Soal Terdeteksi)
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-emerald-800">
                          <span className="font-medium">Pilihan Ganda: <strong>{mcqCount}</strong></span>
                          <span>&bull;</span>
                          <span className="font-medium">Essay/Uraian: <strong>{essayCount}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddBlankQuestion}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Tambah Soal Manual
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Kosongkan semua soal yang telah terbaca?')) {
                              setParsedQuestions([]);
                              setUploadedFileName('');
                            }
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Warning if any MCQ question is missing an answer key */}
                    {missingAnswerCount > 0 && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold">Perhatian: {missingAnswerCount} soal Pilihan Ganda belum ditentukan kunci jawabannya.</p>
                          <p className="mt-0.5">
                            Silakan klik pada butir soal di bawah untuk memilih opsi kunci (A, B, C, D, E) agar sistem dapat melakukan koreksi otomatis dengan benar.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Questions List with inline editor */}
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {parsedQuestions.map((q, idx) => {
                        const isExpanded = expandedQuestionIdx === idx;
                        const hasNoKey = q.type === 'multiple_choice' && !q.correctAnswer;

                        return (
                          <div
                            key={q.id || idx}
                            className={cn(
                              "border rounded-xl transition-all overflow-hidden bg-white shadow-sm",
                              hasNoKey ? "border-amber-300 ring-1 ring-amber-300" : "border-gray-200"
                            )}
                          >
                            {/* Question Card Header */}
                            <div className="p-3.5 flex items-start justify-between gap-3 bg-gray-50/70 hover:bg-gray-100/70 cursor-pointer">
                              <div
                                className="flex-1 flex items-start gap-2.5"
                                onClick={() => setExpandedQuestionIdx(isExpanded ? null : idx)}
                              >
                                <span className="font-bold text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <p className="text-xs font-semibold text-gray-800 line-clamp-2">
                                    {q.text || <span className="text-red-500 italic">(Teks pertanyaan belum diisi)</span>}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                        q.type === 'multiple_choice'
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-purple-100 text-purple-700"
                                      )}
                                    >
                                      {q.type === 'multiple_choice' ? 'Pilihan Ganda' : 'Essay / Uraian'}
                                    </span>
                                    {q.type === 'multiple_choice' ? (
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                          q.correctAnswer
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-amber-100 text-amber-800"
                                        )}
                                      >
                                        Kunci: {q.correctAnswer || 'Belum Ditentukan!'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-gray-500">
                                        Skor Maks: {q.maxScore || formData.essayMaxScore}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleQuestionType(idx)}
                                  className="text-[11px] font-semibold text-gray-600 hover:text-emerald-700 bg-white border border-gray-300 hover:border-emerald-300 px-2 py-1 rounded-md transition-colors"
                                  title="Ubah tipe antara PG / Essay"
                                >
                                  Ubah ke {q.type === 'multiple_choice' ? 'Essay' : 'PG'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(idx)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                  title="Hapus butir soal"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedQuestionIdx(isExpanded ? null : idx)}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Question Card Expandable Body for Editing */}
                            {isExpanded && (
                              <div className="p-4 border-t border-gray-100 bg-white space-y-4 animate-in fade-in duration-150">
                                <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Teks Pertanyaan
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={q.text}
                                    onChange={e => handleUpdateQuestion(idx, { ...q, text: e.target.value })}
                                    className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Tuliskan butir pertanyaan..."
                                  />
                                </div>

                                {q.type === 'multiple_choice' ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-bold text-gray-700">
                                        Pilihan Jawaban (Pilih Kunci yang Benar):
                                      </label>
                                      <span className="text-[10px] text-gray-400">
                                        Klik radio button untuk memilih kunci jawaban
                                      </span>
                                    </div>

                                    {(['A', 'B', 'C', 'D', 'E'] as const).map(optKey => {
                                      const isCorrect = (q.correctAnswer || '').toUpperCase() === optKey;
                                      const optVal = q.options?.[optKey] || '';

                                      return (
                                        <div
                                          key={optKey}
                                          className={cn(
                                            "flex items-center gap-2 p-2 rounded-lg border transition-all",
                                            isCorrect
                                              ? "bg-emerald-50/70 border-emerald-400"
                                              : "bg-gray-50/50 border-gray-200"
                                          )}
                                        >
                                          <input
                                            type="radio"
                                            name={`correct-opt-${idx}`}
                                            id={`opt-${idx}-${optKey}`}
                                            checked={isCorrect}
                                            onChange={() => handleUpdateQuestion(idx, { ...q, correctAnswer: optKey })}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                                          />
                                          <label
                                            htmlFor={`opt-${idx}-${optKey}`}
                                            className={cn(
                                              "text-xs font-bold w-6 cursor-pointer",
                                              isCorrect ? "text-emerald-700" : "text-gray-600"
                                            )}
                                          >
                                            {optKey}.
                                          </label>
                                          <input
                                            type="text"
                                            value={optVal}
                                            onChange={e => {
                                              const newOpts = { ...(q.options || {}), [optKey]: e.target.value };
                                              handleUpdateQuestion(idx, { ...q, options: newOpts });
                                            }}
                                            placeholder={`Pilihan ${optKey}...`}
                                            className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-md bg-white focus:ring-emerald-500 focus:border-emerald-500"
                                          />
                                          {isCorrect && (
                                            <span className="text-[11px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded">
                                              Kunci
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-purple-50/40 p-3 rounded-lg border border-purple-100">
                                    <div>
                                      <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Skor Maksimal Soal Ini
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={q.maxScore || formData.essayMaxScore}
                                        onChange={e =>
                                          handleUpdateQuestion(idx, {
                                            ...q,
                                            maxScore: parseInt(e.target.value) || 1,
                                          })
                                        }
                                        className="text-xs p-2 border border-gray-300 rounded-md bg-white w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Pedoman Jawaban / Rubrik (Opsional)
                                      </label>
                                      <input
                                        type="text"
                                        value={q.correctAnswer || ''}
                                        onChange={e => handleUpdateQuestion(idx, { ...q, correctAnswer: e.target.value })}
                                        placeholder="Kata kunci jawaban yang diharapkan..."
                                        className="text-xs p-2 border border-gray-300 rounded-md bg-white w-full"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-xs text-gray-500">
                {parsedQuestions.length > 0
                  ? `Total: ${parsedQuestions.length} butir soal siap disimpan.`
                  : 'Unggah file soal atau tempel teks terlebih dahulu.'}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={parsedQuestions.length === 0}
                  className="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all uppercase tracking-wider"
                >
                  {editingId ? 'Simpan Perubahan' : 'Simpan ke Bank Soal'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Format Guide */}
      <QuestionFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
      />

      <ConfirmModal 
        isOpen={isDeleting}
        title="Hapus Bank Soal"
        message="Apakah Anda yakin ingin menghapus bank soal ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <ConfirmModal
        isOpen={isDeletingAttempt}
        title="Hapus Riwayat Simulasi"
        message="Apakah Anda yakin ingin menghapus riwayat pengerjaan siswa ini? Siswa akan dapat melakukan simulasi ulang setelah riwayat dihapus."
        onConfirm={confirmDeleteAttempt}
        onCancel={cancelDelete}
      />

      {/* Pengaturan Jadwal Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white shadow rounded-lg p-6 border border-emerald-100">
          <form onSubmit={handleSavePeriodSettings} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="periodName" className="block text-sm font-medium text-gray-700">
                  Nama Periode Ujian
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="periodName"
                    value={periodSettings.name}
                    onChange={(e) => setPeriodSettings({ ...periodSettings, name: e.target.value })}
                    placeholder="Contoh: Ujian Akhir Semester Ganjil"
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                  Tanggal Mulai
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    id="startDate"
                    value={periodSettings.startDate}
                    onChange={(e) => setPeriodSettings({ ...periodSettings, startDate: e.target.value })}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                  Tanggal Selesai
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    id="endDate"
                    value={periodSettings.endDate}
                    onChange={(e) => setPeriodSettings({ ...periodSettings, endDate: e.target.value })}
                    className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 uppercase tracking-wider"
              >
                Simpan Pengaturan Jadwal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List Bank Soal yang Tersimpan */}
      <div className="mt-8">
        <ul className="space-y-4">
          {activeTab !== 'settings' && exams.filter(e => {
            const matchesTab = activeTab === 'simulation' ? e.isSimulation : !e.isSimulation;
            if (!matchesTab) return false;

            if (user.role === 'admin') return true;
            const isCreator = e.teacherId === user.id;
            const isTemplateKorektor = e.korektorId === user.id;
            const isScheduleKorektor = schedules.some(s => s.examId === e.id && s.korektorId === user.id);
            return isCreator || isTemplateKorektor || isScheduleKorektor;
          }).map((exam) => (
            <li key={exam.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-4 py-4 sm:px-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-emerald-600 truncate">{exam.title}</p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <button
                        onClick={() => user.role === 'admin' && toggleStatus(exam)}
                        disabled={user.role !== 'admin'}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          exam.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        } ${user.role !== 'admin' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                      >
                        {exam.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex flex-wrap gap-x-6 gap-y-1">
                      <p className="flex items-center text-xs text-gray-500">
                        Mapel: {exam.mapel || '-'}
                      </p>
                      <p className="flex items-center text-xs text-gray-500">
                        {exam.questions.length} Soal ({exam.questions.filter(q => q.type === 'multiple_choice').length} PG, {exam.questions.filter(q => q.type === 'essay').length} Essay)
                      </p>
                      <p className="flex items-center text-xs text-gray-500">
                        Durasi: {exam.durationMinutes || 60} Menit
                      </p>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 gap-2">
                      {user.role === 'admin' || user.role === 'teacher' ? (
                        <button 
                          onClick={() => handleEdit(exam)} 
                          className="p-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors shadow-sm"
                          title="Edit Bank Soal"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button 
                        onClick={() => handleDelete(exam.id)} 
                        className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
                        title="Hapus Bank Soal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Simulation Attempts List */}
                  {activeTab === 'simulation' && (
                    <div className="mt-4 border-t pt-4">
                      <button
                        onClick={() => setExpandedSimulationId(expandedSimulationId === exam.id ? null : exam.id)}
                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        {expandedSimulationId === exam.id ? 'Sembunyikan Peserta' : 'Lihat Peserta yang Sudah Mengerjakan'}
                      </button>
                      
                      {expandedSimulationId === exam.id && (
                        <div className="mt-3 bg-gray-50 rounded-md p-3 border border-gray-200">
                          {attempts.filter(a => a.examId === exam.id && a.endTime).length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                              {attempts.filter(a => a.examId === exam.id && a.endTime).map(attempt => {
                                const student = students.find(s => s.id === attempt.studentId);
                                return (
                                  <li key={attempt.id} className="py-2 flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-gray-900">{student?.name || 'Siswa Tidak Diketahui'}</span>
                                      <span className="text-xs text-gray-500">
                                        Selesai: {new Date(attempt.endTime!).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-bold text-emerald-600">
                                        Skor: {attempt.totalScore !== undefined ? attempt.totalScore.toFixed(1) : '-'}
                                      </span>
                                      <button
                                        onClick={() => {
                                          setDeleteAttemptId(attempt.id);
                                          setIsDeletingAttempt(true);
                                        }}
                                        className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded font-bold transition-colors"
                                        title="Hapus Riwayat (Siswa bisa mengulang)"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500 italic text-center py-2">Belum ada siswa yang menyelesaikan simulasi ini.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
          {exams.length === 0 && (
            <li className="bg-white shadow rounded-lg px-4 py-8 text-center text-gray-500">Belum ada data bank soal.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
