export type Role = 'admin' | 'teacher' | 'guru' | 'student';

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text passwords
  role: Role;
  name: string;
  kelas?: string;
  logoUrl?: string;
}

export interface Class {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Subject {
  id: string;
  name: string;
  shuffleQuestions?: boolean;
}

export interface AppSettings {
  id: string;
  appName: string;
  institutionName: string;
  logoUrl?: string;
  examStartDate?: string; // YYYY-MM-DD
  examEndDate?: string;   // YYYY-MM-DD
  examPeriodName?: string; // e.g., "Ujian PSAJ"
  isContinuousCameraEnabled?: boolean;
  cameraSnapshotInterval?: number; // in seconds
  cameraQuality?: number; // 0 to 1 (e.g., 0.3 for 30%)
  isStartEndPhotoEnabled?: boolean;
}

export interface TimeSlot {
  id: string;
  name: string; // e.g., "Jam ke-1"
  startTime: string; // "07:30"
  endTime: string; // "09:00"
}

export interface ExamSchedule {
  id: string;
  examId: string; // Reference to the Exam (template/questions)
  date: string;
  timeSlotId: string;
  kelas: string;
  durationMinutes: number;
  proctorId: string; // ID of the teacher/proctor (Pengawas)
  korektorId: string; // ID of the teacher who grades (Korektor)
  isStrictTime: boolean;
  isActive: boolean;
  shuffleQuestions?: boolean;
  createdAt: number;
}

export type QuestionType = 'multiple_choice' | 'essay';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
    E?: string;
  };
  correctAnswer?: string; // A, B, C, D, E for MC, or keywords/rubric for essay
  maxScore?: number; // Maximum score for essay questions
}

export interface Exam {
  id: string;
  title: string; // Keeping title to identify the template
  mapel?: string;
  description?: string;
  teacherId: string;
  korektorId?: string;
  mcqScore?: number;
  questions: Question[];
  isActive: boolean;
  isSimulation?: boolean;
  durationMinutes?: number;
  shuffleQuestions?: boolean; // Acak urutan soal untuk setiap siswa
  createdAt: number;
}

export interface Answer {
  questionId: string;
  value: string; // The selected option (A, B, C, D, E) or essay text
  score?: number; // Graded score for essay, auto-calculated for MC
}

export interface Attempt {
  id: string;
  examId: string;
  studentId: string;
  startTime: number;
  endTime?: number;
  answers: Record<string, Answer>; // questionId -> Answer
  totalScore?: number;
  isGraded: boolean; // True if all essays are graded (or if no essays)
  korektorId?: string; // ID of the teacher who grades (Korektor)
  latestCameraSnapshot?: string; // Base64 image
  lastActiveAt?: number;
  questionOrder?: string[]; // Array of question IDs in shuffled order
}
