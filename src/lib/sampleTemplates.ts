import * as XLSX from 'xlsx';

/**
 * Generates and triggers download of a standardized Excel template for exam questions.
 */
export function downloadExcelTemplate() {
  const data = [
    {
      Soal: 'Ibu kota negara Indonesia saat ini adalah ...',
      PilA: 'Surabaya',
      PilB: 'Bandung',
      PilC: 'Jakarta',
      PilD: 'Medan',
      PilE: 'Semarang',
      jawab: 'C',
      skor_maksimal: '',
    },
    {
      Soal: 'Sila pertama dalam Pancasila berbunyi ...',
      PilA: 'Kemanusiaan yang adil dan beradab',
      PilB: 'Ketuhanan Yang Maha Esa',
      PilC: 'Persatuan Indonesia',
      PilD: 'Kerakyatan yang dipimpin oleh hikmat kebijaksanaan',
      PilE: 'Keadilan sosial bagi seluruh rakyat Indonesia',
      jawab: 'B',
      skor_maksimal: '',
    },
    {
      Soal: 'Jelaskan perbedaan antara perangkat keras (hardware) dan perangkat lunak (software) pada sistem komputer!',
      PilA: '',
      PilB: '',
      PilC: '',
      PilD: '',
      PilE: '',
      jawab: 'Hardware adalah komponen fisik, software adalah program instruksi.',
      skor_maksimal: 10,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Soal');

  // Auto-fit column widths
  ws['!cols'] = [
    { wch: 45 }, // Soal
    { wch: 20 }, // PilA
    { wch: 20 }, // PilB
    { wch: 20 }, // PilC
    { wch: 20 }, // PilD
    { wch: 20 }, // PilE
    { wch: 10 }, // jawab
    { wch: 15 }, // skor_maksimal
  ];

  XLSX.writeFile(wb, 'template_bank_soal.xlsx');
}

/**
 * Downloads a sample formatted text file that can be opened or copied into Word (.docx) or PDF.
 */
export function downloadWordFormatSample() {
  const content = `PANDUAN & CONTOH FORMAT BANK SOAL (WORD / PDF)
SMK AL-HIDAYAH / CBT ONLINE
==================================================

PETUNJUK PENYUSUNAN SOAL:
1. Setiap butir soal diawali dengan nomor soal (contoh: 1., 2., 3.).
2. Pilihan ganda ditulis dengan A., B., C., D., E. (bisa ke bawah atau mendatar).
3. Kunci jawaban dapat dicantumkan langsung di bawah soal dengan tulisan:
   Kunci: C  (atau Kunci Jawaban: C / Jawaban: C)
   Atau dengan tanda bintang pada pilihan yang benar, contoh: *C. Jakarta
4. Soal Essay cukup ditulis soalnya tanpa pilihan A, B, C, D, E.
   Dapat ditambahkan Skor: 10 atau Bobot: 10.
5. Anda juga bisa meletakkan seluruh Kunci Jawaban di akhir dokumen.

--------------------------------------------------
CONTOH SOAL PILIHAN GANDA (DENGAN KUNCI LANGSUNG):
--------------------------------------------------

1. Ibu kota negara Republik Indonesia saat ini adalah ...
A. Surabaya
B. Bandung
C. Jakarta
D. Medan
E. Semarang
Kunci: C

2. Perangkat keras komputer yang berfungsi sebagai otak pemroses data utama adalah ...
A. RAM
B. Harddisk
C. CPU (Processor)
D. Power Supply
E. Motherboard
Kunci: C

3. Di bawah ini yang merupakan contoh sistem operasi open source adalah ...
A. Windows 11
B. macOS
C. Ubuntu Linux
D. iOS
E. MS-DOS
Kunci: C

--------------------------------------------------
CONTOH SOAL ESSAY / URAIAN:
--------------------------------------------------

4. Jelaskan fungsi dari topologi jaringan Star serta sebutkan satu kelebihan utamanya!
Kunci: Menghubungkan setiap node ke switch sentral. Kelebihannya jika satu kabel putus, node lain tetap bekerja.
Skor: 10

5. Sebutkan dan jelaskan 3 pilar keamanan informasi (CIA Triad)!
Skor: 15

==================================================
TIPS:
- Simpan dokumen sebagai .docx (Microsoft Word) atau ekspor ke .pdf.
- Upload file langsung ke menu Tambah Bank Soal pada sistem CBT.
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contoh_format_soal_word.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads an Excel template specifically for Answer Keys (PG & Essay)
 */
export function downloadAnswerKeyTemplateExcel() {
  const data = [
    {
      No: 1,
      Tipe: 'PG',
      Kunci_Jawaban: 'C',
      Skor_Maksimal: 1,
      Keterangan: 'Pilihan Ganda Soal No 1'
    },
    {
      No: 2,
      Tipe: 'PG',
      Kunci_Jawaban: 'A',
      Skor_Maksimal: 1,
      Keterangan: 'Pilihan Ganda Soal No 2'
    },
    {
      No: 3,
      Tipe: 'PG',
      Kunci_Jawaban: 'B',
      Skor_Maksimal: 1,
      Keterangan: 'Pilihan Ganda Soal No 3'
    },
    {
      No: 4,
      Tipe: 'Essay',
      Kunci_Jawaban: 'Menghubungkan setiap node ke switch sentral. Jika satu kabel putus, node lain tetap bekerja normal.',
      Skor_Maksimal: 10,
      Keterangan: 'Kunci Essay / Kata Kunci Penilaian'
    },
    {
      No: 5,
      Tipe: 'Essay',
      Kunci_Jawaban: 'Confidentiality (Kerahasiaan), Integrity (Integritas), Availability (Ketersediaan data).',
      Skor_Maksimal: 10,
      Keterangan: 'Kunci Essay / Kata Kunci Penilaian'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kunci_Jawaban');

  ws['!cols'] = [
    { wch: 8 },  // No
    { wch: 10 }, // Tipe
    { wch: 45 }, // Kunci_Jawaban
    { wch: 15 }, // Skor_Maksimal
    { wch: 30 }  // Keterangan
  ];

  XLSX.writeFile(wb, 'template_kunci_jawaban_ujian.xlsx');
}

/**
 * Downloads sample text format for Answer Keys (PG & Essay)
 */
export function downloadAnswerKeyFormatSampleText() {
  const content = `FORMAT KUNCI JAWABAN UJIAN (PILIHAN GANDA & ESSAY)
SMK AL-HIDAYAH / CBT ONLINE
==================================================

PETUNJUK PENULISAN KUNCI JAWABAN:
1. Pilihan Ganda: Tuliskan nomor soal diikuti opsi (A/B/C/D/E).
   Contoh:
   1. A
   2. C
   3. B
   4. D
   5. E

2. Essay / Uraian: Tuliskan nomor soal diikuti kunci jawaban/kata kunci rubrik dan skor maksimal (opsional).
   Contoh:
   6. Essay: Hardware adalah perangkat keras fisik, sedangkan software adalah instruksi program digital. (Skor: 10)
   7. Uraian: Rukun Iman ada 6 yaitu iman kepada Allah, Malaikat, Kitab, Rasul, Hari Akhir, Qada dan Qadar. (Skor: 10)

Atau format ringkas:
1. A
2. B
3. C
4. D
5. E
6. Jawaban essay nomor 6 di sini...
7. Jawaban essay nomor 7 di sini...
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contoh_format_kunci_jawaban.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

