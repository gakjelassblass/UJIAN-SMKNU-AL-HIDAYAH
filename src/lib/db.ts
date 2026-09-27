import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where
} from 'firebase/firestore';
import { firestore, auth } from './firebase';
import { User, Exam, Attempt, Class, Subject, AppSettings, TimeSlot, ExamSchedule } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  const sanitized: any = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      sanitized[key] = sanitizeData(data[key]);
    }
  }
  return sanitized;
}

export const initDB = async () => {
  try {
    const adminRef = doc(firestore, 'users', 'admin-1');
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        id: 'admin-1',
        username: 'admin',
        password: 'password',
        role: 'admin',
        name: 'Administrator',
      });
    }

    const settingsRef = doc(firestore, 'settings', 'app-settings');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        id: 'app-settings',
        appName: 'Ujian Online',
        institutionName: 'Institusi',
      });
    }
  } catch (error) {
    console.error('Error initializing DB:', error);
  }
};

export const db = {
  users: {
    getAll: async (): Promise<User[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'users'));
        return snap.docs.map(d => d.data() as User);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
        return [];
      }
    },
    getById: async (id: string): Promise<User | undefined> => {
      try {
        const snap = await getDoc(doc(firestore, 'users', id));
        return snap.exists() ? (snap.data() as User) : undefined;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${id}`);
      }
    },
    getByUsername: async (username: string): Promise<User | undefined> => {
      try {
        const q = query(collection(firestore, 'users'), where('username', '==', username));
        const snap = await getDocs(q);
        return snap.empty ? undefined : (snap.docs[0].data() as User);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    },
    add: async (user: User) => {
      try {
        await setDoc(doc(firestore, 'users', user.id), sanitizeData(user));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.id}`);
      }
    },
    update: async (user: User) => {
      try {
        await updateDoc(doc(firestore, 'users', user.id), sanitizeData(user) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'users', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      }
    }
  },
  classes: {
    getAll: async (): Promise<Class[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'classes'));
        return snap.docs.map(d => d.data() as Class);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'classes');
        return [];
      }
    },
    add: async (cls: Class) => {
      try {
        await setDoc(doc(firestore, 'classes', cls.id), sanitizeData(cls));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `classes/${cls.id}`);
      }
    },
    update: async (cls: Class) => {
      try {
        await updateDoc(doc(firestore, 'classes', cls.id), sanitizeData(cls) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `classes/${cls.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'classes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
      }
    }
  },
  subjects: {
    getAll: async (): Promise<Subject[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'subjects'));
        return snap.docs.map(d => d.data() as Subject);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'subjects');
        return [];
      }
    },
    add: async (subject: Subject) => {
      try {
        await setDoc(doc(firestore, 'subjects', subject.id), sanitizeData(subject));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `subjects/${subject.id}`);
      }
    },
    update: async (subject: Subject) => {
      try {
        await updateDoc(doc(firestore, 'subjects', subject.id), sanitizeData(subject) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `subjects/${subject.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'subjects', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
      }
    }
  },
  settings: {
    get: async (): Promise<AppSettings | undefined> => {
      try {
        const snap = await getDoc(doc(firestore, 'settings', 'app-settings'));
        return snap.exists() ? (snap.data() as AppSettings) : undefined;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/app-settings');
      }
    },
    update: async (settings: AppSettings) => {
      try {
        await setDoc(doc(firestore, 'settings', 'app-settings'), sanitizeData(settings));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'settings/app-settings');
      }
    }
  },
  timeSlots: {
    getAll: async (): Promise<TimeSlot[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'timeSlots'));
        return snap.docs.map(d => d.data() as TimeSlot);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'timeSlots');
        return [];
      }
    },
    add: async (slot: TimeSlot) => {
      try {
        await setDoc(doc(firestore, 'timeSlots', slot.id), sanitizeData(slot));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `timeSlots/${slot.id}`);
      }
    },
    update: async (slot: TimeSlot) => {
      try {
        await updateDoc(doc(firestore, 'timeSlots', slot.id), sanitizeData(slot) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `timeSlots/${slot.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'timeSlots', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `timeSlots/${id}`);
      }
    }
  },
  schedules: {
    getAll: async (): Promise<ExamSchedule[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'schedules'));
        return snap.docs.map(d => d.data() as ExamSchedule);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'schedules');
        return [];
      }
    },
    getById: async (id: string): Promise<ExamSchedule | undefined> => {
      try {
        const snap = await getDoc(doc(firestore, 'schedules', id));
        return snap.exists() ? (snap.data() as ExamSchedule) : undefined;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `schedules/${id}`);
      }
    },
    add: async (schedule: ExamSchedule) => {
      try {
        await setDoc(doc(firestore, 'schedules', schedule.id), sanitizeData(schedule));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `schedules/${schedule.id}`);
      }
    },
    update: async (schedule: ExamSchedule) => {
      try {
        await updateDoc(doc(firestore, 'schedules', schedule.id), sanitizeData(schedule) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `schedules/${schedule.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'schedules', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
      }
    }
  },
  exams: {
    getAll: async (): Promise<Exam[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'exams'));
        return snap.docs.map(d => d.data() as Exam);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exams');
        return [];
      }
    },
    getById: async (id: string): Promise<Exam | undefined> => {
      try {
        const snap = await getDoc(doc(firestore, 'exams', id));
        return snap.exists() ? (snap.data() as Exam) : undefined;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `exams/${id}`);
      }
    },
    add: async (exam: Exam) => {
      try {
        await setDoc(doc(firestore, 'exams', exam.id), sanitizeData(exam));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `exams/${exam.id}`);
      }
    },
    update: async (exam: Exam) => {
      try {
        await updateDoc(doc(firestore, 'exams', exam.id), sanitizeData(exam) as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `exams/${exam.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'exams', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `exams/${id}`);
      }
    }
  },
  attempts: {
    getAll: async (): Promise<Attempt[]> => {
      try {
        const snap = await getDocs(collection(firestore, 'attempts'));
        return snap.docs.map(d => d.data() as Attempt);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attempts');
        return [];
      }
    },
    getById: async (id: string): Promise<Attempt | undefined> => {
      try {
        const snap = await getDoc(doc(firestore, 'attempts', id));
        return snap.exists() ? (snap.data() as Attempt) : undefined;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `attempts/${id}`);
      }
    },
    getByStudentAndExam: async (studentId: string, examId: string): Promise<Attempt | undefined> => {
      try {
        const q = query(collection(firestore, 'attempts'), where('studentId', '==', studentId), where('examId', '==', examId));
        const snap = await getDocs(q);
        return snap.empty ? undefined : (snap.docs[0].data() as Attempt);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'attempts');
      }
    },
    add: async (attempt: Attempt) => {
      try {
        await setDoc(doc(firestore, 'attempts', attempt.id), sanitizeData(attempt));
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `attempts/${attempt.id}`);
      }
    },
    update: async (attempt: Attempt) => {
      try {
        await setDoc(doc(firestore, 'attempts', attempt.id), sanitizeData(attempt), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `attempts/${attempt.id}`);
      }
    },
    delete: async (id: string) => {
      try {
        await deleteDoc(doc(firestore, 'attempts', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `attempts/${id}`);
      }
    }
  }
};
