import React, { useState } from 'react';
import { X, Upload, Download, Key, CheckCircle, AlertCircle, FileText, Table, Check } from 'lucide-react';
import { Question } from '../types';
import {
  parseAnswerKeyFile,
  parseAnswerKeyFromText,
  AnswerKeyItem,
} from '../lib/documentParser';
import {
  downloadAnswerKeyTemplateExcel,
  downloadAnswerKeyFormatSampleText,
} from '../lib/sampleTemplates';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface AnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  onApplyKeys: (updatedQuestions: Question[]) => void;
}

export default function AnswerKeyModal({
  isOpen,
  onClose,
  questions,
  onApplyKeys,
}: AnswerKeyModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedKeys, setParsedKeys] = useState<AnswerKeyItem[]>([]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    try {
      const keys = await parseAnswerKeyFile(file);
      if (keys.length === 0) {
        toast.error('Tidak ditemukan kunci jawaban yang sesuai format dalam file.');
      } else {
        setParsedKeys(keys);
        toast.success(`Berhasil membaca ${keys.length} kunci jawaban!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Gagal membaca file kunci jawaban.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseText = () => {
    if (!rawText.trim()) {
      toast.error('Silakan masukkan teks kunci jawaban terlebih dahulu.');
      return;
    }
    const keys = parseAnswerKeyFromText(rawText);
    if (keys.length === 0) {
      toast.error('Tidak dapat mendeteksi pola nomor & kunci jawaban dari teks.');
    } else {
      setParsedKeys(keys);
      toast.success(`Berhasil mendeteksi ${keys.length} kunci jawaban!`);
    }
  };

  const handleApply = () => {
    if (parsedKeys.length === 0) {
      toast.error('Belum ada kunci jawaban yang dimuat.');
      return;
    }

    const keyMap = new Map<number, AnswerKeyItem>();
    parsedKeys.forEach(k => keyMap.set(k.number, k));

    let updatedCount = 0;
    const updated = questions.map((q, idx) => {
      const qNum = idx + 1;
      const matchedKey = keyMap.get(qNum);

      if (matchedKey) {
        updatedCount++;
        if (q.type === 'multiple_choice') {
          return {
            ...q,
            correctAnswer: matchedKey.key.toUpperCase().charAt(0),
          };
        } else {
          return {
            ...q,
            correctAnswer: matchedKey.key,
            maxScore: matchedKey.maxScore || q.maxScore || 10,
          };
        }
      }
      return q;
    });

    onApplyKeys(updated);
    toast.success(`Kunci jawaban berhasil diterapkan ke ${updatedCount} soal!`);
    onClose();
  };

  const mcCount = parsedKeys.filter(k => k.type === 'multiple_choice').length;
  const essayCount = parsedKeys.filter(k => k.type === 'essay').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] border border-gray-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Key className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload & Pasang Kunci Jawaban</h3>
              <p className="text-xs text-emerald-100">
                Pilihan Ganda & Essay agar simulasi dan ujian langsung dinilai otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-gray-700">
          {/* Action Bar Download Templates */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="text-xs font-semibold text-emerald-900">
              Butuh template kunci jawaban siap pakai?
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadAnswerKeyTemplateExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Template Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={downloadAnswerKeyFormatSampleText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Contoh Teks (.txt)
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                'py-2.5 px-4 font-semibold text-xs border-b-2 transition-all flex items-center gap-2',
                activeTab === 'upload'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Upload className="w-4 h-4" />
              Upload Dokumen Kunci (Excel / Word / PDF / TXT)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={cn(
                'py-2.5 px-4 font-semibold text-xs border-b-2 transition-all flex items-center gap-2',
                activeTab === 'paste'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <Table className="w-4 h-4" />
              Salin & Tempel Kunci Teks
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-xl p-6 text-center transition-colors">
                <input
                  type="file"
                  id="answer-key-file-upload"
                  accept=".xlsx,.xls,.docx,.doc,.pdf,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="answer-key-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-emerald-600 border border-emerald-200">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-800 hover:underline">
                      Pilih file kunci jawaban
                    </span>{' '}
                    <span className="text-gray-500 text-xs">atau seret file ke sini</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Mendukung Excel (.xlsx), Word (.docx), PDF (.pdf), atau Teks (.txt)
                  </p>
                  {fileName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-300 rounded-full text-xs font-semibold text-emerald-800">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      {fileName}
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Paste Text */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700">
                Tempel Kunci Jawaban di Sini:
              </label>
              <textarea
                rows={7}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`Contoh format:\n1. C\n2. A\n3. B\n4. Essay: Menghubungkan node ke switch sentral [Skor: 10]\n5. Uraian: Rukun iman ada 6 perkara...`}
                className="w-full text-xs font-mono p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                Periksa & Muat Kunci Teks
              </button>
            </div>
          )}

          {/* Parsing Results & Match Preview */}
          {parsedKeys.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-800">
                    Hasil Deteksi Kunci:
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md">
                    {parsedKeys.length} Kunci Terdeteksi ({mcCount} PG, {essayCount} Essay)
                  </span>
                </div>
                <span className="text-[11px] text-gray-500">
                  Total Soal Aktif: {questions.length} Soal
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                {questions.map((q, idx) => {
                  const qNum = idx + 1;
                  const matched = parsedKeys.find(k => k.number === qNum);
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        'px-4 py-2 text-xs flex items-center justify-between gap-3',
                        matched ? 'bg-white' : 'bg-amber-50/40'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-bold text-gray-900 w-12 shrink-0">
                          #{qNum} [{q.type === 'multiple_choice' ? 'PG' : 'Essay'}]
                        </span>
                        <span className="text-gray-600 truncate">
                          {q.text || 'Teks soal kosong'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {matched ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                            <Check className="w-3.5 h-3.5" />
                            {q.type === 'multiple_choice'
                              ? `Kunci: ${matched.key.toUpperCase().charAt(0)}`
                              : `Rubrik Essay (${matched.maxScore || 10} poin)`}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Tidak ditemukan kunci</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={parsedKeys.length === 0 || isProcessing}
            className={cn(
              'px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition-all',
              parsedKeys.length > 0 && !isProcessing
                ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                : 'bg-gray-400 cursor-not-allowed opacity-60'
            )}
          >
            <CheckCircle className="w-4 h-4" />
            Terapkan Kunci ke {questions.length} Soal
          </button>
        </div>
      </div>
    </div>
  );
}
