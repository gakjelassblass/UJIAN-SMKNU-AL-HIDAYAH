import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { Exam, Attempt, Answer, ExamSchedule, TimeSlot, AppSettings, Question } from '../types';
import { toast } from 'sonner';
import { Clock, AlertCircle, Camera, XCircle, Trophy, Award, CheckCircle2, ArrowRight, Maximize, Lock, ShieldAlert, Monitor } from 'lucide-react';
import { cn, shuffleArrayWithSeed } from '../lib/utils';
import { gradeEssayAnswer } from '../lib/documentParser';
import ConfirmModal from '../components/ConfirmModal';

export default function TakeExam() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Mode Layar: true = Layar Penuh Terkunci (default), false = Layar Normal (sesuai profil pengguna)
  const isFullscreenLockEnabled = user?.fullscreenLockExam !== false;
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const setupVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTakenInitialSnapshot, setHasTakenInitialSnapshot] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    totalScore: number;
    mcqCorrect: number;
    mcqTotal: number;
    mcqScore: number;
    essayEarned: number;
    essayTotalPossible: number;
    essayCount: number;
    isSimulation?: boolean;
    examTitle: string;
  } | null>(null);
  const questionsPerPage = 10;

  const requestFullScreen = async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const exitFullScreen = async () => {
    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
      setIsFullscreen(false);
    } catch (e) {
      console.warn('Exit fullscreen failed:', e);
    }
  };

  const takeSnapshot = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && cameraActive && video.readyState === 4) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const quality = appSettings?.cameraQuality || 0.3;
          return canvas.toDataURL('image/jpeg', quality);
        }
      }
    }
    return null;
  }, [cameraActive, appSettings?.cameraQuality]);

  useEffect(() => {
    const fetchExamData = async () => {
      if (!id || !user) return;
      
      const foundExam = await db.exams.getById(id);
      if (!foundExam || !foundExam.isActive) {
        toast.error('Ujian tidak ditemukan atau belum aktif');
        navigate('/dashboard');
        return;
      }

      setExam(foundExam);

      const settings = await db.settings.get();
      if (settings) {
        setAppSettings(settings);
      }

      if (foundExam.isSimulation) {
        // Simulation logic: no schedule needed
        const existingAttempt = await db.attempts.getByStudentAndExam(user.id, id);
        if (existingAttempt) {
          if (existingAttempt.endTime) {
            toast.info('Anda sudah menyelesaikan simulasi ini');
            navigate('/dashboard');
            return;
          }
          setAttempt(existingAttempt);
          setAnswers(existingAttempt.answers);
          
          const elapsed = Math.floor((Date.now() - existingAttempt.startTime) / 1000);
          const remaining = ((foundExam.durationMinutes || 60) * 60) - elapsed;
          setTimeLeft(Math.max(0, remaining));
        } else {
          // Find an admin to be the default korektor for simulations if not set in exam
          const allUsers = await db.users.getAll();
          const admin = allUsers.find(u => u.role === 'admin');
          
          const initialQuestionOrder = foundExam.shuffleQuestions
            ? shuffleArrayWithSeed(foundExam.questions, `${user.id}-${id}`).map(q => q.id)
            : undefined;

          const newAttempt: Attempt = {
            id: `attempt-${Date.now()}`,
            examId: id,
            studentId: user.id,
            startTime: Date.now(),
            answers: {},
            isGraded: false,
            questionOrder: initialQuestionOrder,
            korektorId: foundExam.korektorId || admin?.id || 'admin-default'
          };
          await db.attempts.add(newAttempt);
          setAttempt(newAttempt);
          setTimeLeft((foundExam.durationMinutes || 60) * 60);
        }
        return;
      }

      // Regular exam logic: find schedule for this student's class
      const allSchedules = await db.schedules.getAll();
      const foundSchedule = allSchedules.find(s => s.examId === id && s.kelas === user.kelas && s.isActive);
      
      if (!foundSchedule) {
        toast.error('Jadwal ujian tidak ditemukan untuk kelas Anda.');
        navigate('/dashboard');
        return;
      }

      const allTimeSlots = await db.timeSlots.getAll();
      const timeSlot = allTimeSlots.find(ts => ts.id === foundSchedule.timeSlotId);

      const now = Date.now();
      let start = 0;
      let end = Infinity;
      
      if (foundSchedule.date && timeSlot) {
        start = new Date(`${foundSchedule.date}T${timeSlot.startTime}`).getTime();
        end = new Date(`${foundSchedule.date}T${timeSlot.endTime}`).getTime();
      }

      if (foundSchedule.isStrictTime) {
        if (now < start) {
          toast.error(`Ujian ini baru bisa dikerjakan pada ${new Date(foundSchedule.date + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'medium' })} jam ${timeSlot?.startTime}`);
          navigate('/dashboard');
          return;
        }

        if (now > end) {
          toast.error('Ujian ini sudah berakhir dan tidak bisa dikerjakan lagi.');
          navigate('/dashboard');
          return;
        }
      }

      setSchedule(foundSchedule);

      const existingAttempt = await db.attempts.getByStudentAndExam(user.id, id);
      if (existingAttempt) {
        if (existingAttempt.endTime) {
          toast.info('Anda sudah menyelesaikan ujian ini');
          navigate('/dashboard');
          return;
        }
        setAttempt(existingAttempt);
        setAnswers(existingAttempt.answers);
        
        const elapsed = Math.floor((Date.now() - existingAttempt.startTime) / 1000);
        const remaining = (foundSchedule.durationMinutes * 60) - elapsed;
        setTimeLeft(Math.max(0, remaining));
      } else {
        const initialQuestionOrder = (foundExam.shuffleQuestions || foundSchedule.shuffleQuestions)
          ? shuffleArrayWithSeed(foundExam.questions, `${user.id}-${id}`).map(q => q.id)
          : undefined;

        const newAttempt: Attempt = {
          id: `attempt-${Date.now()}`,
          examId: id,
          studentId: user.id,
          startTime: Date.now(),
          answers: {},
          isGraded: false,
          questionOrder: initialQuestionOrder,
          korektorId: foundSchedule.korektorId
        };
        await db.attempts.add(newAttempt);
        setAttempt(newAttempt);
        setTimeLeft(foundSchedule.durationMinutes * 60);
      }
    };
    fetchExamData();
  }, [id, user, navigate]);

  const orderedQuestions = React.useMemo(() => {
    if (!exam || !exam.questions || exam.questions.length === 0) return [];

    const shouldShuffle = exam.shuffleQuestions ?? false;
    if (!shouldShuffle) {
      return exam.questions;
    }

    if (attempt?.questionOrder && attempt.questionOrder.length === exam.questions.length) {
      const qMap = new Map(exam.questions.map(q => [q.id, q]));
      const reconstructed = attempt.questionOrder
        .map(qid => qMap.get(qid))
        .filter((q): q is Question => q !== undefined);
      
      if (reconstructed.length === exam.questions.length) {
        return reconstructed;
      }
    }

    // Fallback deterministic seed
    const seed = `${user?.id || 'student'}-${exam.id}`;
    return shuffleArrayWithSeed(exam.questions, seed);
  }, [exam, attempt?.questionOrder, user?.id]);

  const totalPages = orderedQuestions.length > 0 ? Math.ceil(orderedQuestions.length / questionsPerPage) : 0;
  const currentQuestions = orderedQuestions.slice((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage);

  const handleSubmit = React.useCallback(async () => {
    if (!attempt || !exam || isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      // Take final snapshot if enabled
      let finalSnapshot = null;
      if (appSettings?.isContinuousCameraEnabled || appSettings?.isStartEndPhotoEnabled) {
        finalSnapshot = takeSnapshot();
      }

      // Calculate score for multiple choice & essay
      let mcqCorrect = 0;
      let mcqTotal = 0;
      let mcqScoreEarned = 0;
      const mcqUnitScore = exam.mcqScore || 1;

      let essayEarned = 0;
      let essayTotalPossible = 0;
      let essayCount = 0;

      const updatedAnswers: Record<string, Answer> = { ...answers };

      exam.questions.forEach(q => {
        const studentAns = (answers[q.id]?.value || '').trim();

        if (q.type === 'multiple_choice') {
          mcqTotal += 1;
          const cleanCorrect = (q.correctAnswer || '').trim().toUpperCase();
          const isCorrect = cleanCorrect !== '' && studentAns.toUpperCase() === cleanCorrect;
          
          if (isCorrect) {
            mcqCorrect += 1;
            mcqScoreEarned += mcqUnitScore;
          }
          updatedAnswers[q.id] = {
            questionId: q.id,
            value: studentAns,
            score: isCorrect ? mcqUnitScore : 0
          };
        } else {
          // Essay Question
          essayCount += 1;
          const maxScore = q.maxScore || 10;
          essayTotalPossible += maxScore;
          const earned = gradeEssayAnswer(studentAns, q.correctAnswer || '', maxScore);
          essayEarned += earned;
          updatedAnswers[q.id] = {
            questionId: q.id,
            value: studentAns,
            score: earned
          };
        }
      });

      // Total score calculation (scaled to 0 - 100)
      const totalPossiblePoints = (mcqTotal * mcqUnitScore) + essayTotalPossible;
      const totalEarnedPoints = mcqScoreEarned + essayEarned;
      const finalScaledScore = totalPossiblePoints > 0
        ? Math.round((totalEarnedPoints / totalPossiblePoints) * 100 * 10) / 10
        : 0;

      const finalAttempt: Attempt = {
        ...attempt,
        answers: updatedAnswers,
        endTime: Date.now(),
        isGraded: true,
        latestCameraSnapshot: finalSnapshot || attempt.latestCameraSnapshot || null,
        totalScore: finalScaledScore
      };

      await db.attempts.update(finalAttempt);
      setIsConfirmModalOpen(false);

      // Stop camera stream safely
      if ((window as any).localStream) {
        (window as any).localStream.getTracks().forEach((track: any) => track.stop());
        (window as any).localStream = null;
      }

      await exitFullScreen();

      toast.success('Ujian berhasil dikumpulkan & dinilai otomatis!');

      setSubmissionResult({
        totalScore: finalScaledScore,
        mcqCorrect,
        mcqTotal,
        mcqScore: mcqScoreEarned,
        essayEarned,
        essayTotalPossible,
        essayCount,
        isSimulation: exam.isSimulation,
        examTitle: exam.title
      });
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Gagal mengumpulkan ujian. Silakan periksa koneksi internet Anda dan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt, exam, answers, isSubmitting, takeSnapshot, appSettings]);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    try {
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      (window as any).localStream = stream;
      
      // Attach to whichever video element is currently available
      const activeVideo = isCameraReady ? videoRef.current : setupVideoRef.current;
      if (activeVideo) {
        activeVideo.srcObject = stream;
        activeVideo.onloadedmetadata = () => {
          activeVideo.play().catch(e => console.error("Error playing video:", e));
          setCameraActive(true);
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        (window as any).localStream = stream;
        const activeVideo = isCameraReady ? videoRef.current : setupVideoRef.current;
        if (activeVideo) {
          activeVideo.srcObject = stream;
          activeVideo.onloadedmetadata = () => {
            activeVideo.play().catch(e => console.error("Error playing video:", e));
            setCameraActive(true);
          };
        }
      } catch (fallbackErr) {
        console.error("Fallback camera access failed:", fallbackErr);
        setCameraError(fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
      }
    }
  }, [isCameraReady]);

  useEffect(() => {
    if (attempt && !attempt.endTime) {
      startCamera();
    }

    return () => {
      if ((window as any).localStream) {
        const stream = (window as any).localStream as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        (window as any).localStream = null;
      }
    };
  }, [attempt?.id, attempt?.endTime, startCamera]);

  useEffect(() => {
    if (!attempt || attempt.endTime || (!schedule && !exam?.isSimulation)) return;

    const timer = setInterval(async () => {
      // Check strict time end
      if (schedule && schedule.isStrictTime && schedule.date) {
        const allTimeSlots = await db.timeSlots.getAll();
        const timeSlot = allTimeSlots.find(ts => ts.id === schedule.timeSlotId);
        if (timeSlot) {
          const end = new Date(`${schedule.date}T${timeSlot.endTime}`).getTime();
          if (Date.now() > end) {
            clearInterval(timer);
            toast.error('Waktu ujian telah berakhir (Strict Time). Jawaban Anda akan otomatis dikumpulkan.');
            handleSubmit();
            return;
          }
        }
      }

      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Ping timer to keep student "online" without taking photos
    const pingTimer = setInterval(() => {
      if (attempt) {
        const now = Date.now();
        db.attempts.update({
          ...attempt,
          answers,
          lastActiveAt: now
        });
        setAttempt(prev => prev ? { ...prev, lastActiveAt: now } : null);
      }
    }, 60000); // Every 60 seconds

    return () => {
      clearInterval(timer);
      clearInterval(pingTimer);
    };
  }, [attempt?.id, attempt?.endTime, answers, schedule, exam?.isSimulation, handleSubmit]);

  // Take snapshot when exam starts
  useEffect(() => {
    if (isCameraReady && attempt && !attempt.endTime && cameraActive && !hasTakenInitialSnapshot) {
      if (appSettings?.isContinuousCameraEnabled || appSettings?.isStartEndPhotoEnabled) {
        const timer = setTimeout(async () => {
          const snapshot = takeSnapshot();
          if (snapshot) {
            const now = Date.now();
            const updatedAttempt: Attempt = {
              ...attempt,
              answers,
              latestCameraSnapshot: snapshot,
              lastActiveAt: now
            };
            await db.attempts.update(updatedAttempt);
            setAttempt(updatedAttempt);
            setHasTakenInitialSnapshot(true);
          }
        }, 2000); // Give camera 2s to stabilize
        return () => clearTimeout(timer);
      } else {
        setHasTakenInitialSnapshot(true);
      }
    }
  }, [isCameraReady, attempt?.id, cameraActive, takeSnapshot, hasTakenInitialSnapshot, answers, appSettings]);

  // Continuous snapshot logic
  useEffect(() => {
    if (isCameraReady && attempt && !attempt.endTime && cameraActive && appSettings?.isContinuousCameraEnabled) {
      const interval = (appSettings.cameraSnapshotInterval || 30) * 1000;
      const timer = setInterval(async () => {
        const snapshot = takeSnapshot();
        if (snapshot) {
          const now = Date.now();
          const updatedAttempt: Attempt = {
            ...attempt,
            answers,
            latestCameraSnapshot: snapshot,
            lastActiveAt: now
          };
          await db.attempts.update(updatedAttempt);
          setAttempt(updatedAttempt);
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [isCameraReady, attempt?.id, cameraActive, takeSnapshot, answers, appSettings]);

  // Listen for fullscreen change events across all browsers
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isCurrentlyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Prevent closing tab / navigating away while taking exam
  useEffect(() => {
    if (isCameraReady && !attempt?.endTime && !submissionResult) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Ujian sedang berlangsung! Jawaban Anda mungkin hilang jika menutup halaman ini.';
        return 'Ujian sedang berlangsung! Jawaban Anda mungkin hilang jika menutup halaman ini.';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isCameraReady, attempt?.endTime, submissionResult]);

  // Prevent back button navigation during exam
  useEffect(() => {
    if (isCameraReady && !attempt?.endTime && !submissionResult) {
      history.pushState(null, '', location.href);
      const handlePopState = () => {
        history.pushState(null, '', location.href);
        toast.warning('⚠️ Navigasi dinonaktifkan selama ujian berlangsung!');
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isCameraReady, attempt?.endTime, submissionResult]);

  // Anti-cheat tab switch warning
  useEffect(() => {
    if (isCameraReady && !attempt?.endTime && !submissionResult) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          toast.error('⚠️ PERINGATAN: Dilarang berpindah tab atau meminimalkan layar ujian!');
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isCameraReady, attempt?.endTime, submissionResult]);

  // Disable right-click context menu and developer tool shortcuts
  useEffect(() => {
    if (isCameraReady && !attempt?.endTime && !submissionResult) {
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
          (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
        ) {
          e.preventDefault();
        }
      };

      window.addEventListener('contextmenu', handleContextMenu);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('contextmenu', handleContextMenu);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isCameraReady, attempt?.endTime, submissionResult]);

  useEffect(() => {
    if (timeLeft === 0 && attempt && !attempt.endTime) {
      handleSubmit();
    }
  }, [timeLeft, attempt, handleSubmit]);

  const handleAnswerChange = (questionId: string, value: string) => {
    const newAnswers = {
      ...answers,
      [questionId]: { questionId, value }
    };
    setAnswers(newAnswers);
    
    if (attempt) {
      const updatedAttempt = { ...attempt, answers: newAnswers };
      db.attempts.update(updatedAttempt);
      setAttempt(updatedAttempt);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!exam || !attempt) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Memuat...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Block UI if continuous camera is enabled but camera is inactive */}
      {isCameraReady && appSettings?.isContinuousCameraEnabled && !cameraActive && !attempt.endTime && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white rounded-2xl p-8 shadow-2xl border-4 border-red-500">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2 uppercase">Kamera Terputus!</h2>
            <p className="text-gray-600 mb-6 font-medium">
              Ujian ini mewajibkan akses kamera terus menerus. Silakan aktifkan kembali kamera Anda untuk melanjutkan ujian.
            </p>
            <button 
              onClick={startCamera}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg"
            >
              HUBUNGKAN ULANG KAMERA
            </button>
          </div>
        </div>
      )}

      {/* Hidden video/canvas for background processing */}
      <div className={cn("fixed top-0 left-0 w-1 h-1 overflow-hidden opacity-0 pointer-events-none z-[-1]", !isCameraReady && "hidden")}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} />
      </div>

      {!isCameraReady ? (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
              <Camera className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">Persiapan Kamera</h2>
            </div>
            <div className="p-6 space-y-6 text-center">
              <p className="text-gray-600 text-sm leading-relaxed">
                Untuk menjaga integritas ujian, Anda wajib mengaktifkan kamera selama pengerjaan soal. Pastikan wajah Anda terlihat jelas.
              </p>
              
              <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-inner relative group">
                <video 
                  autoPlay 
                  playsInline 
                  muted 
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    cameraActive ? "opacity-100" : "opacity-0"
                  )} 
                  ref={setupVideoRef}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3 bg-gray-900/80">
                    {cameraError ? (
                      <>
                        <XCircle className="h-10 w-10 text-red-500" />
                        <span className="text-xs font-medium text-red-400 px-4 text-center">{cameraError}</span>
                        <button 
                          onClick={startCamera}
                          className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >
                          COBA LAGI
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        <span className="text-xs font-medium">Menghubungkan kamera...</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={async () => {
                    if (isFullscreenLockEnabled) {
                      await requestFullScreen();
                    }
                    setIsCameraReady(true);
                  }}
                  disabled={!cameraActive}
                  className={cn(
                    "w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2",
                    cameraActive 
                      ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200 cursor-pointer" 
                      : "bg-gray-300 cursor-not-allowed"
                  )}
                >
                  {isFullscreenLockEnabled ? (
                    <>
                      <Maximize className="w-5 h-5" />
                      <span>{cameraActive ? 'MULAI KERJAKAN SOAL (LAYAR PENUH & TERKUNCI)' : 'MENUNGGU KAMERA...'}</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-5 h-5" />
                      <span>{cameraActive ? 'MULAI KERJAKAN SOAL (LAYAR NORMAL)' : 'MENUNGGU KAMERA...'}</span>
                    </>
                  )}
                </button>
                
                <div className="mt-2.5 flex items-center justify-center">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border",
                    isFullscreenLockEnabled 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-blue-50 text-blue-800 border-blue-300"
                  )}>
                    {isFullscreenLockEnabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        Mode Layar: Penuh Terkunci (Sesuai Profil)
                      </>
                    ) : (
                      <>
                        <Monitor className="w-3.5 h-3.5 text-blue-600" />
                        Mode Layar: Normal Bebas (Sesuai Profil)
                      </>
                    )}
                  </span>
                </div>

                {!cameraActive && (
                  <p className="mt-3 text-[10px] text-red-500 font-medium">
                    Jika kamera tidak muncul, pastikan Anda telah memberikan izin akses kamera di browser Anda.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white shadow sm:rounded-lg mb-6 sticky top-0 z-10 border-b-4 border-emerald-500">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div className="flex items-center gap-4">
                {cameraActive && (
                  <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                    <video 
                      autoPlay 
                      playsInline 
                      muted 
                      className="h-full w-full object-cover"
                      ref={(el) => {
                        if (el && (window as any).localStream) {
                          el.srcObject = (window as any).localStream;
                        }
                      }}
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-lg leading-6 font-bold text-gray-900">{exam.mapel || exam.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Jawablah pertanyaan dengan teliti.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isFullscreenLockEnabled ? (
                  !isFullscreen ? (
                    <button
                      onClick={requestFullScreen}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors animate-pulse cursor-pointer"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                      Aktifkan Fullscreen
                    </button>
                  ) : (
                    <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-300">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      Fullscreen Terkunci
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-100/90 px-3 py-1 rounded-full border border-blue-300">
                      <Monitor className="w-3.5 h-3.5 text-blue-600" />
                      Layar Normal
                    </div>
                    <button
                      onClick={isFullscreen ? exitFullScreen : requestFullScreen}
                      title={isFullscreen ? "Kembali ke mode normal" : "Perbesar ke layar penuh (opsional)"}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-gray-200"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">{isFullscreen ? 'Kecilkan' : 'Perbesar'}</span>
                    </button>
                  </div>
                )}

                <div className={`flex items-center text-lg font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                  <Clock className="mr-2 h-5 w-5" />
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {currentQuestions.map((q, index) => {
              const globalIndex = (currentPage - 1) * questionsPerPage + index;
              return (
                <div key={q.id} className="bg-white shadow sm:rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="px-4 py-5 sm:p-6">
                    <h4 className="text-md font-bold text-gray-900 mb-4">
                      {globalIndex + 1}. {q.text}
                    </h4>
                    
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="space-y-3">
                        {['A', 'B', 'C', 'D', 'E'].map((opt) => {
                          const optionText = q.options![opt as keyof typeof q.options];
                          if (!optionText) return null;
                          
                          const isSelected = answers[q.id]?.value === opt;
                          
                          return (
                            <div 
                              key={opt} 
                              className={cn(
                                "flex items-center p-3 rounded-lg border transition-colors cursor-pointer",
                                isSelected ? "bg-emerald-50 border-emerald-500" : "bg-white border-gray-200 hover:bg-gray-50"
                              )}
                              onClick={() => handleAnswerChange(q.id, opt)}
                            >
                              <input
                                id={`${q.id}-${opt}`}
                                name={q.id}
                                type="radio"
                                value={opt}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(q.id, opt)}
                                className="focus:ring-emerald-500 h-4 w-4 text-emerald-600 border-gray-300"
                              />
                              <label htmlFor={`${q.id}-${opt}`} className="ml-3 block text-sm font-medium text-gray-700 cursor-pointer w-full">
                                <span className="font-bold mr-2">{opt}.</span> {optionText}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'essay' && (
                      <div className="mt-2">
                        <textarea
                          rows={4}
                          name={q.id}
                          id={q.id}
                          autoComplete="off"
                          value={answers[q.id]?.value || ''}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="shadow-sm focus:ring-emerald-500 focus:border-emerald-500 block w-full sm:text-sm border-gray-300 rounded-md p-3 border"
                          placeholder="Tulis jawaban Anda di sini..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  setCurrentPage(prev => Math.max(1, prev - 1));
                  window.scrollTo(0, 0);
                }}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Kembali
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    setCurrentPage(page);
                    window.scrollTo(0, 0);
                  }}
                  className={`px-4 py-2 border rounded-md text-sm font-bold ${
                    currentPage === page
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => {
                  setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  window.scrollTo(0, 0);
                }}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          )}

          <div className="mt-8 flex justify-center pb-10">
            <button
              onClick={() => setIsConfirmModalOpen(true)}
              disabled={isSubmitting}
              className={cn(
                "inline-flex items-center px-10 py-4 border border-transparent text-lg font-bold rounded-md shadow-lg text-white transition-all",
                isSubmitting 
                  ? "bg-gray-400 cursor-not-allowed" 
                  : "bg-emerald-600 hover:bg-emerald-700 focus:outline-none"
              )}
            >
              {isSubmitting ? 'Mengumpulkan...' : 'Selesai & Kumpulkan'}
            </button>
          </div>

          <ConfirmModal
            isOpen={isConfirmModalOpen}
            title="Selesai & Kumpulkan"
            message="Apakah Anda yakin ingin mengumpulkan ujian ini? Anda tidak bisa mengubah jawaban setelah ini."
            onConfirm={handleSubmit}
            onCancel={() => setIsConfirmModalOpen(false)}
          />
        </>
      )}

      {/* Immediate Score Result Modal */}
      {submissionResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 text-center animate-in zoom-in-95 duration-200">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-6 text-white relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-xs mb-3 shadow-inner">
                <Trophy className="w-9 h-9 text-amber-300 animate-bounce" />
              </div>
              <h3 className="text-xl font-extrabold">
                {submissionResult.isSimulation ? 'Simulasi Ujian Selesai!' : 'Ujian Berhasil Dikumpulkan!'}
              </h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto">
                {submissionResult.examTitle}
              </p>
            </div>

            {/* Score Centerpiece */}
            <div className="p-6 space-y-6">
              <div className="bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl p-5 max-w-xs mx-auto shadow-sm">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
                  Nilai Akhir
                </div>
                <div className="text-5xl font-black text-emerald-700 my-1 tracking-tight">
                  {submissionResult.totalScore.toFixed(1)}
                </div>
                <div className="text-[11px] font-semibold text-gray-500">
                  Skala Nilai 0 - 100
                </div>

                {/* Performance Badge */}
                <div className="mt-3">
                  <span className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-xs",
                    submissionResult.totalScore >= 85
                      ? "bg-emerald-600 text-white"
                      : submissionResult.totalScore >= 75
                      ? "bg-teal-600 text-white"
                      : submissionResult.totalScore >= 60
                      ? "bg-amber-500 text-white"
                      : "bg-red-500 text-white"
                  )}>
                    {submissionResult.totalScore >= 85
                      ? '🌟 Sangat Memuaskan'
                      : submissionResult.totalScore >= 75
                      ? '✅ Tuntas / Memuaskan'
                      : submissionResult.totalScore >= 60
                      ? '⚠️ Cukup'
                      : '📚 Perlu Ditingkatkan'}
                  </span>
                </div>
              </div>

              {/* Breakdown Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Pilihan Ganda
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {submissionResult.mcqCorrect} / {submissionResult.mcqTotal} Benar
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Skor PG: {submissionResult.mcqScore} poin
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Essay / Uraian
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {submissionResult.essayCount > 0 ? (
                      `${submissionResult.essayEarned.toFixed(1)} / ${submissionResult.essayTotalPossible} Poin`
                    ) : (
                      'Tidak ada essay'
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {submissionResult.essayCount > 0 ? 'Dinilai otomatis sesuai kunci' : 'Hanya pilihan ganda'}
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                type="button"
                onClick={() => {
                  setSubmissionResult(null);
                  navigate('/dashboard');
                }}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Kembali ke Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lock Screen Overlay (Hanya jika Mode Layar Full Terkunci aktif di Profil) */}
      {isFullscreenLockEnabled && isCameraReady && !isFullscreen && !attempt?.endTime && !submissionResult && (
        <div className="fixed inset-0 bg-slate-950/95 z-[999] flex items-center justify-center p-6 text-center backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-md bg-white rounded-3xl p-8 shadow-2xl border-4 border-amber-500 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl mx-auto flex items-center justify-center text-amber-600 mb-4 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2 uppercase">Layar Penuh Terputus!</h2>
            <p className="text-gray-600 text-xs sm:text-sm mb-6 leading-relaxed">
              Ujian dan Simulasi SMK AL-HIDAYAH mewajibkan mode <strong>Layar Penuh (Fullscreen)</strong>. Halaman ini terkunci dan tidak dapat ditutup sampai ujian selesai dikumpulkan.
            </p>
            <button 
              onClick={requestFullScreen}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
            >
              <Maximize className="w-5 h-5" />
              KEMBALI KE LAYAR PENUH (FULLSCREEN)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
