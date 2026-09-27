import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { Users, FileText, CheckCircle, Calendar, Activity, Clock } from 'lucide-react';
import { Exam, Attempt, User, ExamSchedule, TimeSlot, Class } from '../types';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../lib/firebase';

interface ActiveTaker {
  user: User;
  exam: Exam;
  schedule?: ExamSchedule;
  attempt: Attempt;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, exams: 0, attempts: 0, online: 0 });
  const [exams, setExams] = useState<Exam[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [activeTakers, setActiveTakers] = useState<ActiveTaker[]>([]);
  const [pendingGrading, setPendingGrading] = useState<(Attempt & { studentName: string; examTitle: string })[]>([]);
  const [scoreHistory, setScoreHistory] = useState<(Attempt & { examTitle: string; mapel: string; isSimulation: boolean })[]>([]);
  const [isTakersExpanded, setIsTakersExpanded] = useState(true);
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [cardSize, setCardSize] = useState(2); // 1: Small, 2: Medium, 3: Large, 4: Extra Large
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (!user) return;

    // Real-time listener for exams
    const unsubscribeExams = onSnapshot(collection(firestore, 'exams'), (snapshot) => {
      const allExams = snapshot.docs.map(d => d.data() as Exam);
      setExams(allExams);
    });

    // Real-time listener for schedules
    const unsubscribeSchedules = onSnapshot(collection(firestore, 'schedules'), (snapshot) => {
      const allSchedules = snapshot.docs.map(d => d.data() as ExamSchedule);
      setSchedules(allSchedules);
    });

    // Real-time listener for time slots
    const unsubscribeTimeSlots = onSnapshot(collection(firestore, 'timeSlots'), (snapshot) => {
      const allTimeSlots = snapshot.docs.map(d => d.data() as TimeSlot);
      setTimeSlots(allTimeSlots);
    });

    // Real-time listener for classes
    const unsubscribeClasses = onSnapshot(collection(firestore, 'classes'), (snapshot) => {
      const allClasses = snapshot.docs.map(d => d.data() as Class);
      setClasses(allClasses.filter(c => c.isActive !== false));
    });

    // Real-time listener for users
    const unsubscribeUsers = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(d => d.data() as User);
      setStats(prev => ({ ...prev, users: allUsers.length }));
    });

    // Real-time listener for attempts (for stats and active takers)
    const unsubscribeAttempts = onSnapshot(collection(firestore, 'attempts'), (snapshot) => {
      const allAttempts = snapshot.docs.map(d => d.data() as Attempt);
      
      setStats(prev => ({
        ...prev,
        attempts: allAttempts.length
      }));

      if (user.role === 'admin' || user.role === 'teacher') {
        const processDashboardData = async () => {
          const allUsers = await db.users.getAll();
          const allExams = await db.exams.getAll();
          const allSchedules = await db.schedules.getAll();

          const active: ActiveTaker[] = [];
          const pending: (Attempt & { studentName: string; examTitle: string })[] = [];

          for (const attempt of allAttempts) {
            const student = allUsers.find(u => u.id === attempt.studentId);
            const exam = allExams.find(e => e.id === attempt.examId);
            
            if (!attempt.endTime) {
              const schedule = allSchedules.find(s => s.examId === attempt.examId && s.kelas === student?.kelas);
              
              if (student && exam && (schedule || exam.isSimulation)) {
                const isCreator = exam.teacherId === user.id;
                const isProctor = schedule?.proctorId === user.id;
                const isKorektor = schedule?.korektorId === user.id;

                if (user.role === 'admin' || isCreator || isProctor || isKorektor) {
                  active.push({ user: student, exam, schedule, attempt });
                }
              }
            } else if (!attempt.isGraded) {
              // Check if there are essay questions to grade
              const hasEssays = exam?.questions.some(q => q.type === 'essay');
              if (hasEssays && student && exam) {
                const schedule = allSchedules.find(s => s.examId === attempt.examId && s.kelas === student?.kelas);
                const isCreator = exam.teacherId === user.id;
                const isKorektor = schedule?.korektorId === user.id || exam.korektorId === user.id;

                if (user.role === 'admin' || isCreator || isKorektor) {
                  pending.push({ 
                    ...attempt, 
                    studentName: student.name, 
                    examTitle: exam.title 
                  });
                }
              }
            }
          }
          
          setActiveTakers(active);
          setPendingGrading(pending);
          setStats(prev => ({ 
            ...prev, 
            online: active.length,
            users: allUsers.length,
            exams: allExams.length,
            attempts: allAttempts.length
          }));
        };

        processDashboardData();
      } else if (user.role === 'student') {
        const processStudentAttempts = async () => {
          const allExams = await db.exams.getAll();
          const allSchedules = await db.schedules.getAll();
          
          const studentSchedules = allSchedules.filter(s => s.kelas === user.kelas && s.isActive);
          const attemptMap: Record<string, Attempt> = {};
          
          for (const schedule of studentSchedules) {
            const attempt = allAttempts.find(a => a.studentId === user.id && a.examId === schedule.examId);
            if (attempt) {
              attemptMap[schedule.id] = attempt;
            }
          }
          
          const activeSimulations = allExams.filter(e => e.isSimulation && e.isActive);
          for (const sim of activeSimulations) {
            const attempt = allAttempts.find(a => a.studentId === user.id && a.examId === sim.id);
            if (attempt) {
              attemptMap[sim.id] = attempt;
            }
          }
          
          setAttempts(attemptMap);

          // Populate score history
          const history = allAttempts
            .filter(a => a.studentId === user.id && a.endTime)
            .map(a => {
              const exam = allExams.find(e => e.id === a.examId);
              return {
                ...a,
                examTitle: exam?.title || 'Ujian Tidak Diketahui',
                mapel: exam?.mapel || '-',
                isSimulation: exam?.isSimulation || false
              };
            })
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
          setScoreHistory(history);
        };
        
        processStudentAttempts();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeExams();
      unsubscribeSchedules();
      unsubscribeTimeSlots();
      unsubscribeClasses();
      unsubscribeUsers();
      unsubscribeAttempts();
    };
  }, [user]);

  const handleRetakeSimulation = async (examId: string, attemptId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Ulang Simulasi',
      message: 'Apakah Anda yakin ingin mengulang simulasi ini? Jawaban dan nilai sebelumnya akan dihapus.',
      onConfirm: async () => {
        await db.attempts.delete(attemptId);
        setAttempts(prev => {
          const newAttempts = { ...prev };
          delete newAttempts[examId];
          return newAttempts;
        });
        setScoreHistory(prev => prev.filter(a => a.id !== attemptId));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        toast.success('Simulasi berhasil direset');
      }
    });
  };

  if (!user || loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Memuat...</div>;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Dashboard</h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Ringkasan aktivitas sistem, statistik pengguna, dan pemantauan ujian secara real-time.
          </p>
        </div>
      </div>

      {user.role === 'admin' && (
        <div className="grid grid-cols-4 gap-2 sm:gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
            <div className="p-2 sm:p-5">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <div className="flex-shrink-0 bg-blue-100 p-2 sm:p-3 rounded-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" aria-hidden="true" />
                </div>
                <div className="sm:ml-5 text-center sm:text-left">
                  <dl>
                    <dt className="hidden sm:block text-xs sm:text-sm font-medium text-gray-500 truncate uppercase tracking-wider">Total Pengguna</dt>
                    <dd className="text-sm sm:text-2xl font-bold text-gray-900">{stats.users}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
            <div className="p-2 sm:p-5">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <div className="flex-shrink-0 bg-purple-100 p-2 sm:p-3 rounded-lg">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" aria-hidden="true" />
                </div>
                <div className="sm:ml-5 text-center sm:text-left">
                  <dl>
                    <dt className="hidden sm:block text-xs sm:text-sm font-medium text-gray-500 truncate uppercase tracking-wider">Total Bank Soal</dt>
                    <dd className="text-sm sm:text-2xl font-bold text-gray-900">{stats.exams}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
            <div className="p-2 sm:p-5">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <div className="flex-shrink-0 bg-yellow-100 p-2 sm:p-3 rounded-lg">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" aria-hidden="true" />
                </div>
                <div className="sm:ml-5 text-center sm:text-left">
                  <dl>
                    <dt className="hidden sm:block text-xs sm:text-sm font-medium text-gray-500 truncate uppercase tracking-wider">Total Pengerjaan</dt>
                    <dd className="text-sm sm:text-2xl font-bold text-gray-900">{stats.attempts}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow border-b-4 border-emerald-500">
            <div className="p-2 sm:p-5">
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
                <div className="flex-shrink-0 bg-emerald-100 p-2 sm:p-3 rounded-lg">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="sm:ml-5 text-center sm:text-left">
                  <dl>
                    <dt className="hidden sm:block text-xs sm:text-sm font-medium text-gray-500 truncate uppercase tracking-wider">Siswa Online</dt>
                    <dd className="text-sm sm:text-2xl font-bold text-emerald-600">{stats.online}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(user.role === 'admin' || user.role === 'teacher') && (
        <div className="mb-10">
          <div className="px-4 py-3 sm:px-6 flex items-center justify-between rounded-t-lg shadow-sm bg-blue-600">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-white" />
              <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">Jadwal Ujian Hari Ini</h3>
            </div>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 sticky left-0 bg-gray-50 z-10">
                      Jam / Kelas
                    </th>
                    {classes.sort((a, b) => a.name.localeCompare(b.name)).map(cls => (
                      <th key={cls.id} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 min-w-[120px]">
                        {cls.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timeSlots.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(slot => (
                    <tr key={slot.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-200 sticky left-0 bg-white z-10">
                        <div className="font-bold">{slot.name}</div>
                        <div className="text-[10px] text-gray-500">{slot.startTime} - {slot.endTime}</div>
                      </td>
                      {classes.sort((a, b) => a.name.localeCompare(b.name)).map(cls => {
                        const today = new Date().toISOString().split('T')[0];
                        const schedule = schedules.find(s => s.date === today && s.timeSlotId === slot.id && s.kelas === cls.name);
                        return (
                          <td key={cls.id} className={cn("px-2 py-2 border border-gray-200 text-center", schedule ? "bg-emerald-50" : "")}>
                            {schedule ? (
                              <div className="text-[10px]">
                                <div className="font-bold text-emerald-700">
                                  {exams.find(e => e.id === schedule.examId)?.mapel || 'Ujian'}
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(user.role === 'admin' || user.role === 'teacher') && (
        <div className="mb-10">
          <div 
            className="px-4 py-3 sm:px-6 flex items-center justify-between rounded-t-lg shadow-sm bg-emerald-600 cursor-pointer"
            onClick={() => setIsTakersExpanded(!isTakersExpanded)}
          >
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-white" />
              <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">
                <span className="hidden sm:inline">Sedang Mengerjakan Ujian</span>
                <span className="sm:hidden">Online</span>
              </h3>
              <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                {activeTakers.length}
              </span>
            </div>
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1 sm:gap-2 bg-white bg-opacity-20 p-1 rounded-md">
                <span className="hidden sm:inline text-[10px] font-bold text-white ml-1">UKURAN</span>
                <input 
                  type="range" 
                  min="1" 
                  max="4" 
                  step="1" 
                  value={cardSize} 
                  onChange={(e) => setCardSize(parseInt(e.target.value))}
                  className="w-16 sm:w-24 accent-white h-1.5"
                />
              </div>
            </div>
          </div>
          
          {isTakersExpanded && (
            <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100">
              {activeTakers.length > 0 ? (
                <div className={cn(
                  "p-4 grid gap-4",
                  cardSize === 1 && "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
                  cardSize === 2 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
                  cardSize === 3 && "grid-cols-1 sm:grid-cols-2",
                  cardSize === 4 && "grid-cols-1"
                )}>
                  {activeTakers.map((taker, idx) => {
                    const isInactive = taker.attempt.lastActiveAt && (Date.now() - taker.attempt.lastActiveAt > 30000); // 30 seconds inactive
                    return (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className={cn(
                          "relative bg-gray-100",
                          cardSize === 1 ? "h-24" : cardSize === 2 ? "h-48" : cardSize === 3 ? "h-64" : "h-96"
                        )}>
                          {taker.attempt.latestCameraSnapshot ? (
                            <img 
                              src={taker.attempt.latestCameraSnapshot} 
                              alt="Camera feed" 
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center', 'text-gray-400');
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
                              }}
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-emerald-50 text-emerald-700 font-bold text-4xl">
                              {taker.user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isInactive && (
                            <div className="absolute top-2 right-2">
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-600 text-white shadow-sm">
                                TIDAK AKTIF
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={cn("p-4", cardSize === 1 && "p-2")}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className={cn("text-sm font-bold text-gray-900 truncate", cardSize === 1 && "text-xs")}>{taker.user.name}</h4>
                              <p className="text-xs text-gray-500">{taker.user.kelas ? `Kelas ${taker.user.kelas}` : 'Siswa'}</p>
                            </div>
                            {cardSize > 1 && (
                              <div className="text-right">
                                <p className="text-xs font-bold text-emerald-600 truncate max-w-[100px]">
                                  {taker.exam.mapel}
                                </p>
                              </div>
                            )}
                          </div>
                          {cardSize > 1 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
                              <span>Mulai: {new Date(taker.attempt.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>Aktif: {taker.attempt.lastActiveAt ? new Date(taker.attempt.lastActiveAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Tidak ada siswa yang sedang mengerjakan ujian saat ini.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(user.role === 'admin' || user.role === 'teacher') && (
        <div className="mb-10">
          <div 
            className="px-4 py-3 sm:px-6 flex items-center justify-between rounded-t-lg shadow-sm bg-yellow-600 cursor-pointer"
            onClick={() => setIsPendingExpanded(!isPendingExpanded)}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-white" />
              <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">
                Perlu Dikoreksi (Essay)
              </h3>
              <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingGrading.length}
              </span>
            </div>
          </div>
          
          {isPendingExpanded && (
            <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100">
              {pendingGrading.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {pendingGrading.map((attempt) => (
                    <li key={attempt.id} className="hover:bg-gray-50 transition-colors">
                      <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{attempt.studentName}</p>
                          <p className="text-xs text-emerald-600 font-medium">{attempt.examTitle}</p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Selesai: {new Date(attempt.endTime!).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <Link
                            to={`/exams/${attempt.examId}/grade`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 transition-all uppercase tracking-wider"
                          >
                            Koreksi
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Tidak ada pengerjaan yang perlu dikoreksi saat ini.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {user.role === 'student' && (
        <div className="mb-10">
          <div className="px-4 py-3 sm:px-6 flex items-center gap-3 rounded-t-lg shadow-sm bg-emerald-600">
            <Activity className="h-5 w-5 text-white" />
            <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">Simulasi Ujian</h3>
            <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {exams.filter(e => e.isSimulation && e.isActive).length}
            </span>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100 mb-8">
            <ul className="divide-y divide-gray-200">
              {exams.filter(e => e.isSimulation && e.isActive).map((exam) => {
                const attempt = attempts[exam.id];
                return (
                  <li key={exam.id}>
                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        {attempt?.endTime && (
                          <div className="mb-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-green-100 text-green-800">
                              Skor: {attempt.totalScore?.toFixed(1) || '0'}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-bold text-emerald-600 truncate">{exam.title}</p>
                        <div className="mt-1 flex items-center text-xs text-gray-500 gap-4">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.durationMinutes || 60} Menit
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {exam.questions.length} Soal
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {attempt?.endTime ? (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                Selesai
                              </span>
                            </div>
                            <button
                              onClick={() => handleRetakeSimulation(exam.id, attempt.id)}
                              className="inline-flex items-center px-2 py-1 border border-emerald-600 text-[10px] font-bold rounded text-emerald-600 bg-white hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all uppercase tracking-wider"
                            >
                              Ulang Simulasi
                            </button>
                          </div>
                        ) : (
                          <Link
                            to={`/exam/${exam.id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all uppercase tracking-wider"
                          >
                            {attempt ? 'Lanjutkan' : 'Mulai Simulasi'}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {exams.filter(e => e.isSimulation && e.isActive).length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-500 italic">Belum ada simulasi ujian yang tersedia.</li>
              )}
            </ul>
          </div>

          <div className="px-4 py-3 sm:px-6 flex items-center gap-3 rounded-t-lg shadow-sm bg-emerald-600">
            <Calendar className="h-5 w-5 text-white" />
            <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">Jadwal Ujian Tersedia</h3>
            <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {schedules.filter(s => s.isActive && s.kelas === user.kelas).length}
            </span>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100">
            <ul className="divide-y divide-gray-200">
            {schedules.filter(s => s.isActive && s.kelas === user.kelas).map((schedule) => {
              const attempt = attempts[schedule.id];
              const timeSlot = timeSlots.find(ts => ts.id === schedule.timeSlotId);
              
              return (
                <li key={schedule.id}>
                  <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-600 truncate">
                        {schedules.find(s => s.id === schedule.id) && exams.find(e => e.id === schedule.examId)?.mapel}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <p className="flex items-center text-xs text-gray-500">
                          <Calendar className="flex-shrink-0 mr-1 h-3.5 w-3.5 text-gray-400" />
                          {new Date(schedule.date + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                        </p>
                        <p className="flex items-center text-xs text-gray-500">
                          <Clock className="flex-shrink-0 mr-1 h-3.5 w-3.5 text-gray-400" />
                          {timeSlot ? `${timeSlot.name} (${timeSlot.startTime} - ${timeSlot.endTime})` : 'Waktu tidak diatur'}
                        </p>
                        <p className="flex items-center text-xs text-gray-500">
                          <Activity className="flex-shrink-0 mr-1 h-3.5 w-3.5 text-gray-400" />
                          Durasi: {schedule.durationMinutes} Menit
                        </p>
                      </div>
                    </div>
                    <div>
                      {(() => {
                        const now = Date.now();
                        let start = 0;
                        let end = Infinity;
                        
                        if (schedule.date && timeSlot) {
                          start = new Date(`${schedule.date}T${timeSlot.startTime}`).getTime();
                          end = new Date(`${schedule.date}T${timeSlot.endTime}`).getTime();
                        }

                        const isStarted = now >= start;
                        const isEnded = now > end;

                        if (attempt?.endTime) {
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-blue-600 uppercase tracking-wider">
                                Selesai
                              </span>
                              <span className="text-[10px] font-bold text-gray-500">
                                Skor: {attempt.totalScore !== undefined ? attempt.totalScore.toFixed(1) : 'Menunggu'}
                              </span>
                            </div>
                          );
                        }

                        if (attempt) {
                          return (
                            <Link
                              to={`/exam/${schedule.examId}`}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all uppercase tracking-wider"
                            >
                              Lanjutkan
                            </Link>
                          );
                        }

                        if (schedule.isStrictTime && !isStarted) {
                          return (
                            <button
                              disabled
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-gray-400 cursor-not-allowed uppercase tracking-wider"
                            >
                              Belum Mulai
                            </button>
                          );
                        }

                        if (schedule.isStrictTime && isEnded) {
                          return (
                            <button
                              disabled
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-red-500 cursor-not-allowed uppercase tracking-wider"
                            >
                              Sudah Berakhir
                            </button>
                          );
                        }

                        return (
                          <Link
                            to={`/exam/${schedule.examId}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all uppercase tracking-wider"
                          >
                            Kerjakan
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </li>
              );
            })}
            {schedules.filter(s => s.isActive && s.kelas === user.kelas).length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-500">Belum ada jadwal ujian untuk kelas Anda.</li>
            )}
          </ul>
        </div>
      </div>
    )}
    </div>
  );
}
