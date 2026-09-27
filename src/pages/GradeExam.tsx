import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { toast } from 'sonner';
import { Exam, Attempt, User, ExamSchedule } from '../types';
import { CheckCircle, XCircle } from 'lucide-react';

export default function GradeExam() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [attempts, setAttempts] = useState<(Attempt & { studentName: string; studentKelas?: string })[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchGradeData = async () => {
      if (!id || !user) return;
      
      const foundExam = await db.exams.getById(id);
      const allSchedules = await db.schedules.getAll();
      const examSchedules = allSchedules.filter(s => s.examId === id);
      setSchedules(examSchedules);

      const isCreator = foundExam?.teacherId === user.id;
      const isTemplateKorektor = foundExam?.korektorId === user.id;
      const isScheduleKorektor = examSchedules.some(s => s.korektorId === user.id);

      if (!foundExam || (user.role !== 'admin' && !isCreator && !isTemplateKorektor && !isScheduleKorektor)) {
        toast.error('Akses ditolak');
        navigate('/dashboard');
        return;
      }
      setExam(foundExam);

      const allAttempts = await db.attempts.getAll();
      const examAttempts = allAttempts.filter(a => a.examId === id && a.endTime);
      
      const attemptsWithNames = await Promise.all(examAttempts.map(async a => {
        const student = await db.users.getById(a.studentId);
        return {
          ...a,
          studentName: student?.name || 'Unknown Student',
          studentKelas: student?.kelas
        };
      }));

      // Filter attempts if user is only a korektor for specific classes
      let filteredAttempts = attemptsWithNames;
      if (user.role !== 'admin' && !isCreator && !isTemplateKorektor) {
        const korektorClasses = examSchedules.filter(s => s.korektorId === user.id).map(s => s.kelas);
        filteredAttempts = attemptsWithNames.filter(a => a.studentKelas && korektorClasses.includes(a.studentKelas));
      }

      setAttempts(filteredAttempts);
    };
    fetchGradeData();
  }, [id, user, navigate]);

  const handleSelectAttempt = (attempt: Attempt) => {
    setSelectedAttempt(attempt);
    const initialScores: Record<string, number> = {};
    if (exam) {
      exam.questions.forEach(q => {
        if (q.type === 'essay' && attempt.answers[q.id]?.score !== undefined) {
          initialScores[q.id] = attempt.answers[q.id].score!;
        }
      });
    }
    setEssayScores(initialScores);
  };

  const handleScoreChange = (questionId: string, score: number) => {
    setEssayScores(prev => ({ ...prev, [questionId]: score }));
  };

  const handleSaveGrades = async () => {
    if (!selectedAttempt || !exam) return;

    let totalScore = 0;
    const updatedAnswers = { ...selectedAttempt.answers };

    exam.questions.forEach(q => {
      if (q.type === 'multiple_choice') {
        const isCorrect = updatedAnswers[q.id]?.value === q.correctAnswer;
        const score = isCorrect ? (exam.mcqScore || 1) : 0;
        updatedAnswers[q.id] = { ...updatedAnswers[q.id], score };
        totalScore += score;
      } else if (q.type === 'essay') {
        const score = essayScores[q.id] || 0;
        updatedAnswers[q.id] = { ...updatedAnswers[q.id], score };
        totalScore += score;
      }
    });

    const updatedAttempt: Attempt = {
      ...selectedAttempt,
      answers: updatedAnswers,
      isGraded: true,
      totalScore: totalScore
    };

    await db.attempts.update(updatedAttempt);
    
    // Update local state
    setAttempts(prev => prev.map(a => a.id === updatedAttempt.id ? { ...updatedAttempt, studentName: a.studentName } : a));
    setSelectedAttempt(null);
    toast.success('Nilai berhasil disimpan!');
  };

  if (!exam) return <div>Memuat...</div>;

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar list of attempts */}
      <div className="w-1/3 bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-md leading-6 font-bold text-gray-900 uppercase tracking-wider">Daftar Pengerjaan</h3>
          <p className="mt-2 text-xs text-gray-500 text-justify sm:text-left">{exam.title}</p>
        </div>
        <ul className="divide-y divide-gray-200 overflow-y-auto flex-1">
          {attempts.map((attempt) => (
            <li 
              key={attempt.id}
              onClick={() => handleSelectAttempt(attempt)}
              className={`px-4 py-4 sm:px-6 cursor-pointer hover:bg-gray-50 ${selectedAttempt?.id === attempt.id ? 'bg-emerald-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-emerald-600 truncate">
                  {attempt.studentName}
                  {attempt.studentKelas && <span className="text-xs text-gray-500 ml-2">({attempt.studentKelas})</span>}
                </p>
                <div className="ml-2 flex-shrink-0 flex">
                  {attempt.isGraded ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Dinilai ({attempt.totalScore})
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Perlu Dikoreksi
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between">
                <div className="sm:flex">
                  <p className="flex items-center text-sm text-gray-500">
                    Selesai: {new Date(attempt.endTime!).toLocaleString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {attempts.length === 0 && (
            <li className="px-4 py-4 sm:px-6 text-sm text-gray-500 text-center">Belum ada siswa yang menyelesaikan ujian ini.</li>
          )}
        </ul>
      </div>

      {/* Main content area for grading */}
      <div className="w-2/3 bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        {selectedAttempt ? (
          <>
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Koreksi Jawaban: {attempts.find(a => a.id === selectedAttempt.id)?.studentName}
                </h3>
              </div>
              <button
                onClick={handleSaveGrades}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Simpan Nilai
              </button>
            </div>
            <div className="px-4 py-5 sm:p-6 overflow-y-auto flex-1 space-y-8">
              {exam.questions.map((q, index) => {
                const answer = selectedAttempt.answers[q.id];
                
                if (q.type === 'multiple_choice') {
                  const isCorrect = answer?.value === q.correctAnswer;
                  return (
                    <div key={q.id} className="border-b pb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-2">
                        {index + 1}. {q.text} <span className="text-xs text-gray-500">(Pilihan Ganda)</span>
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">Jawaban Siswa:</span>
                        <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {answer?.value || 'Tidak dijawab'}
                        </span>
                        {isCorrect ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                      </div>
                      <div className="text-sm text-gray-500">
                        Kunci Jawaban: <span className="font-bold">{q.correctAnswer}</span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={q.id} className="border-b pb-6 bg-yellow-50 p-4 rounded-md">
                      <h4 className="text-md font-medium text-gray-900 mb-2">
                        {index + 1}. {q.text} <span className="text-xs text-gray-500">(Essay)</span>
                      </h4>
                      <div className="mb-4">
                        <span className="text-sm font-medium text-gray-700 block mb-1">Jawaban Siswa:</span>
                        <div className="bg-white p-3 border rounded-md text-sm text-gray-800 whitespace-pre-wrap">
                          {answer?.value || <span className="text-gray-400 italic">Tidak dijawab</span>}
                        </div>
                      </div>
                      {q.correctAnswer && (
                        <div className="mb-4">
                          <span className="text-sm font-medium text-gray-700 block mb-1">Kunci/Rubrik:</span>
                          <div className="bg-gray-100 p-3 border rounded-md text-sm text-gray-600 whitespace-pre-wrap">
                            {q.correctAnswer}
                          </div>
                        </div>
                      )}
                  <div className="flex items-center gap-4">
                    <label htmlFor={`score-${q.id}`} className="block text-sm font-medium text-gray-700">
                      Beri Nilai (Maks {q.maxScore || 100}):
                    </label>
                    <input
                      type="number"
                      id={`score-${q.id}`}
                      min="0"
                      max={q.maxScore || 100}
                      autoComplete="off"
                      value={essayScores[q.id] || 0}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        const max = q.maxScore || 100;
                        if (val > max) val = max;
                        if (val < 0) val = 0;
                        handleScoreChange(q.id, val);
                      }}
                      className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-24 sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                    />
                  </div>
                    </div>
                  );
                }
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Pilih siswa di sebelah kiri untuk mulai mengoreksi
          </div>
        )}
      </div>
    </div>
  );
}
