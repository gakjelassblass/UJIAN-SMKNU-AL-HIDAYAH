import React, { useState } from 'react';
import { X, FileText, Download, Check, Copy, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { downloadExcelTemplate, downloadWordFormatSample } from '../lib/sampleTemplates';
import { toast } from 'sonner';

interface QuestionFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuestionFormatModal({ isOpen, onClose }: QuestionFormatModalProps) {
  const [activeTab, setActiveTab] = useState<'word' | 'excel' | 'keys_at_bottom'>('word');
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const sampleWordText = `1. Ibu kota negara Republik Indonesia saat ini adalah ...
A. Surabaya
B. Bandung
C. Jakarta
D. Medan
E. Semarang
Kunci: C

2. Perangkat keras yang berfungsi sebagai otak utama pemroses komputer adalah ...
A. RAM
B. Harddisk
C. CPU (Processor)
D. Power Supply
E. Motherboard
Kunci: C

3. Jelaskan fungsi topologi jaringan Star serta sebutkan satu kelebihan utamanya!
Kunci: Setiap komputer tersambung ke perangkat sentral seperti Switch atau Hub. Kelebihan: gangguan 1 komputer tidak memutus jaringan lain.
Skor: 10`;

  const sampleKeyAtBottom = `1. Hasil dari 15 x 4 adalah ...
A. 40
B. 50
C. 60
D. 70
E. 80

2. Komponen penyimpan data jangka pendek pada komputer adalah ...
A. Harddisk
B. RAM
C. Processor
D. Power Supply
E. VGA Card

KUNCI JAWABAN:
1. C
2. B`;

  const handleCopySample = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success('Format contoh berhasil disalin ke clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-700 text-white">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-200" />
            <h3 className="font-bold text-base">Panduan Format Upload Soal (Word, PDF & Excel)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-emerald-600 text-emerald-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('word')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'word'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Format Word / PDF (Kunci di Soal)
          </button>
          <button
            onClick={() => setActiveTab('keys_at_bottom')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'keys_at_bottom'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Format Kunci di Akhir Dokumen
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'excel'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Format Excel (.xlsx)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm text-gray-600">
          {activeTab === 'word' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Aturan Penulisan Dokumen Word (.docx) atau PDF:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    <li>Awali setiap nomor soal dengan angka (misal: <strong>1.</strong> atau <strong>1)</strong>).</li>
                    <li>Pilihan ganda menggunakan <strong>A.</strong>, <strong>B.</strong>, <strong>C.</strong>, <strong>D.</strong>, <strong>E.</strong> (bisa 4 atau 5 pilihan).</li>
                    <li>Kunci jawaban ditulis <strong>Kunci: C</strong> atau <strong>Kunci Jawaban: C</strong> langsung di bawah pilihan.</li>
                    <li>Soal uraian/essay cukup tulis pertanyaannya tanpa pilihan A-E. (Opsional tambahkan <strong>Skor: 10</strong>).</li>
                  </ul>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium">Contoh Teks yang Terbaca:</span>
                  <button
                    onClick={() => handleCopySample(sampleWordText)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold"
                  >
                    {hasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {hasCopied ? 'Tersalin' : 'Salin Contoh'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-emerald-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-800">
                  {sampleWordText}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'keys_at_bottom' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Kunci Jawaban di Akhir Dokumen:</p>
                  <p className="mt-1">
                    Jika pada dokumen Anda semua kunci ditaruh di halaman paling belakang, buat judul <strong>KUNCI JAWABAN:</strong> diikuti nomor dan huruf kunci (misal 1. C, 2. B, dll). Sistem akan otomatis mencocokkannya ke nomor soal terkait.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium">Contoh Format:</span>
                  <button
                    onClick={() => handleCopySample(sampleKeyAtBottom)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold"
                  >
                    {hasCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {hasCopied ? 'Tersalin' : 'Salin Contoh'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-emerald-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed border border-gray-800">
                  {sampleKeyAtBottom}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Format Tabel Excel (.xlsx):</p>
                  <p className="mt-1">
                    Pastikan baris pertama (header) memiliki kolom: <strong>Soal</strong>, <strong>PilA</strong>, <strong>PilB</strong>, <strong>PilC</strong>, <strong>PilD</strong>, <strong>PilE</strong>, <strong>jawab</strong>, dan <strong>skor_maksimal</strong> (untuk essay).
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-xs divide-y divide-gray-200">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Soal</th>
                      <th className="px-2 py-2 text-left">PilA</th>
                      <th className="px-2 py-2 text-left">PilB</th>
                      <th className="px-2 py-2 text-left">PilC</th>
                      <th className="px-2 py-2 text-left">PilD</th>
                      <th className="px-2 py-2 text-left">PilE</th>
                      <th className="px-2 py-2 text-center">jawab</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    <tr>
                      <td className="px-3 py-2 text-gray-800 font-medium">Ibu kota Indonesia ...</td>
                      <td className="px-2 py-2 text-gray-600">Surabaya</td>
                      <td className="px-2 py-2 text-gray-600">Bandung</td>
                      <td className="px-2 py-2 text-gray-600">Jakarta</td>
                      <td className="px-2 py-2 text-gray-600">Medan</td>
                      <td className="px-2 py-2 text-gray-600">Semarang</td>
                      <td className="px-2 py-2 text-center font-bold text-emerald-600">C</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadWordFormatSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-all"
            >
              <Download className="h-3.5 w-3.5 text-gray-500" />
              Unduh Contoh Word (.txt)
            </button>
            <button
              type="button"
              onClick={downloadExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 shadow-sm transition-all"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Unduh Template Excel (.xlsx)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
}
