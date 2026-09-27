import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { Attempt, Exam } from '../types';
import { CheckCircle, Clock } from 'lucide-react';

export default function Results() {
  const { user } = useAuth();
  const [scoreHistory, setScoreHistory] = useState<(Attempt & { examTitle: string; mapel: string; isSimulation: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;

      const allAttempts = await db.attempts.getAll();
      const allExams = await db.exams.getAll();

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
      setLoading(false);
    };

    fetchResults();
  }, [user]);

  if (!user || loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Hasil Ujian</h1>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">
            Daftar skor dan riwayat ujian yang telah Anda selesaikan.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 sm:px-6 flex items-center gap-3 rounded-t-lg shadow-sm bg-emerald-600">
        <CheckCircle className="h-5 w-5 text-white" />
        <h3 className="text-md leading-6 font-bold text-white uppercase tracking-wider">Daftar Skor</h3>
        <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
          {scoreHistory.length}
        </span>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-b-lg border border-gray-100">
        <ul className="divide-y divide-gray-200">
          {scoreHistory.map((attempt) => (
            <li key={attempt.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-emerald-600 truncate">
                    {attempt.examTitle} {attempt.isSimulation ? '(Simulasi)' : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <p className="flex items-center text-xs text-gray-500">
                      <Clock className="flex-shrink-0 mr-1 h-3.5 w-3.5 text-gray-400" />
                      Selesai: {new Date(attempt.endTime || 0).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                    Skor: {attempt.totalScore !== undefined ? attempt.totalScore.toFixed(1) : 'Menunggu Penilaian'}
                  </span>
                </div>
              </div>
            </li>
          ))}
          {scoreHistory.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-500 italic">Belum ada skor yang tersedia.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
