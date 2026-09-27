/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Exams from './pages/Exams';
import ExamSchedule from './pages/ExamSchedule';
import TakeExam from './pages/TakeExam';
import GradeExam from './pages/GradeExam';
import Settings from './pages/Settings';
import Results from './pages/Results';
import Profile from './pages/Profile';
import Grading from './pages/Grading';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="exams" element={<Exams />} />
            <Route path="schedule" element={<ExamSchedule />} />
            <Route path="settings" element={<Settings />} />
            <Route path="results" element={<Results />} />
            <Route path="profile" element={<Profile />} />
            <Route path="grading" element={<Grading />} />
            <Route path="exam/:id" element={<TakeExam />} />
            <Route path="exams/:id/grade" element={<GradeExam />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

