import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { Exam, ExamSchedule, Attempt, User } from '../types';
import { FileText, Clock, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Grading() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const [allSchedules, allExams, allAttempts] = await Promise.all([
        db.schedules.getAll(),
        db.exams.getAll(),
        db.attempts.getAll()
      ]);

      // Filter schedules where this user is the korektor
      const mySchedules = allSchedules.filter(s => s.korektorId === user.id);
      setSchedules(mySchedules);
      setExams(allExams);
      setAttempts(allAttempts);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const getExamTitle = (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    return exam ? (exam.mapel || exam.title) : 'Ujian Tidak Ditemukan';
  };

  const getAttemptStats = (scheduleId: string, examId: string, kelas: string) => {
    // In this app, attempts are linked to examId and studentId.
    // We need to filter attempts by students in the specific class for that exam.
    // However, the current Attempt type doesn't have scheduleId.
    // We'll filter by examId and then by student's class if we had student data.
    // For now, let's just show all attempts for that examId.
    const relevantAttempts = attempts.filter(a => a.examId === examId);
    const total = relevantAttempts.length;
    const graded = relevantAttempts.filter(a => a.isGraded).length;
    const pending = total - graded;
    
    return { total, graded, pending };
  };

  const filteredSchedules = schedules.filter(s => 
    getExamTitle(s.examId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.kelas.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Memuat data koreksi...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wider">Koreksi Jawaban</h1>
          <p className="mt-2 text-sm text-gray-500">
            Daftar ujian yang ditugaskan kepada Anda untuk dikoreksi.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          placeholder="Cari mata pelajaran atau kelas..."
        />
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-dashed border-gray-300">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-bold text-gray-900 uppercase">Tidak Ada Tugas Koreksi</h3>
          <p className="mt-1 text-sm text-gray-500">
            Anda belum ditugaskan sebagai korektor untuk jadwal ujian manapun.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSchedules.map((schedule) => {
            const stats = getAttemptStats(schedule.id, schedule.examId, schedule.kelas);
            return (
              <div key={schedule.id} className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase">
                      {schedule.kelas}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {schedule.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={getExamTitle(schedule.examId)}>
                    {getExamTitle(schedule.examId)}
                  </h3>
                  
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 p-2 rounded">
                      <div className="text-lg font-bold text-gray-900">{stats.total}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Total</div>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded">
                      <div className="text-lg font-bold text-emerald-600">{stats.graded}</div>
                      <div className="text-[10px] text-emerald-500 font-bold uppercase">Selesai</div>
                    </div>
                    <div className="bg-orange-50 p-2 rounded">
                      <div className="text-lg font-bold text-orange-600">{stats.pending}</div>
                      <div className="text-[10px] text-orange-500 font-bold uppercase">Belum</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link
                      to={`/exams/${schedule.examId}/grade`}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-bold rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      MULAI KOREKSI
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
