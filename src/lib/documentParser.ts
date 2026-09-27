import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { Question } from '../types';

// Configure pdfjs worker safely for Vite/Browser environments
try {
  // Use local or unpkg worker URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Failed to set pdfjs workerSrc:', e);
}

export interface ParseResult {
  questions: Question[];
  totalParsed: number;
  mcqCount: number;
  essayCount: number;
  warnings: string[];
  rawTextPreview?: string;
}

/**
 * Extracts plain text from a PDF file using pdfjs-dist
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const textPages: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by line roughly using transform coordinates or join lines
    let lastY: number | null = null;
    let pageText = '';
    
    for (const item of textContent.items as any[]) {
      if ('str' in item) {
        const currentY = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = currentY;
      }
    }
    textPages.push(pageText);
  }

  return textPages.join('\n\n');
}

/**
 * Extracts plain text from a Word (.docx) file using mammoth
 */
export async function extractTextFromWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Parses questions from an Excel (.xlsx / .xls) file
 */
export async function parseExcelQuestions(file: File, defaultEssayMaxScore = 4): Promise<Question[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const wsname = wb.SheetNames[0];
  const ws = wb.Sheets[wsname];
  const data = XLSX.utils.sheet_to_json(ws);

  return data.map((row: any, index) => {
    const hasPilA = row.PilA !== undefined && row.PilA !== '';
    const questionText = (row.Soal || row.soal || row.Pertanyaan || row.pertanyaan || '').toString().trim();
    const answer = (row.jawab || row.Jawab || row.Kunci || row.kunci || '').toString().trim().toUpperCase();

    if (hasPilA) {
      return {
        id: `q-${Date.now()}-${index}`,
        text: questionText,
        type: 'multiple_choice',
        options: {
          A: row.PilA?.toString().trim() || '',
          B: row.PilB?.toString().trim() || '',
          C: row.PilC?.toString().trim() || '',
          D: row.PilD?.toString().trim() || '',
          E: row.PilE?.toString().trim() || '',
        },
        correctAnswer: answer.charAt(0) || 'A',
      };
    } else {
      return {
        id: `q-${Date.now()}-${index}`,
        text: questionText,
        type: 'essay',
        correctAnswer: answer,
        maxScore: Number(row.skor_maksimal || row.max_score || row.MaxScore || defaultEssayMaxScore) || defaultEssayMaxScore,
      };
    }
  });
}

/**
 * Parses raw text (from PDF, Word, or manual paste) into structured Question objects.
 * Handles diverse Indonesian school exam patterns:
 * - Numbering: "1.", "1)", "Soal 1:", "[1]"
 * - Multiple choice options: "A.", "B.", "a.", "a)", inline "A. ... B. ... C. ..."
 * - Asterisk marking: "*A. ..." or "A. *..."
 * - Answer key indicators: "Kunci: A", "Kunci Jawaban: B", "Jawaban: C"
 * - Separate Answer Key sections at the end: "KUNCI JAWABAN: 1. A 2. B ..."
 * - Essay detection (sections labeled "Essay", "Uraian", or questions without options)
 */
export function parseTextToQuestions(rawText: string, defaultEssayMaxScore = 4): ParseResult {
  const warnings: string[] = [];
  if (!rawText || !rawText.trim()) {
    return { questions: [], totalParsed: 0, mcqCount: 0, essayCount: 0, warnings: ['Teks dokumen kosong'] };
  }

  // 1. Separate potential answer key section at the bottom (e.g. "KUNCI JAWABAN:")
  let contentText = rawText;
  const answerKeyMap = new Map<number, string>();

  const answerKeySectionMatch = rawText.match(
    /(?:KUNCI\s+JAWABAN|KUNCI|ANSWER\s+KEY|KUNCI\s+SOAL)[\s\S]*$/i
  );

  if (answerKeySectionMatch && answerKeySectionMatch.index !== undefined) {
    const keySection = rawText.slice(answerKeySectionMatch.index);
    contentText = rawText.slice(0, answerKeySectionMatch.index);

    // Extract entries like "1. A", "1. B", "1=C", "1: D", "1.A"
    const keyRegex = /(\d+)[\.\)\:\=\s]+([A-Ea-e])/g;
    let km;
    while ((km = keyRegex.exec(keySection)) !== null) {
      const qNum = parseInt(km[1], 10);
      const ans = km[2].toUpperCase();
      answerKeyMap.set(qNum, ans);
    }
  }

  // 2. Normalize text and split into paragraphs/lines
  const lines = contentText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  // Detect section markers
  let currentSectionType: 'multiple_choice' | 'essay' | null = null;

  interface RawQuestionBlock {
    number?: number;
    lines: string[];
    sectionType?: 'multiple_choice' | 'essay' | null;
  }

  const questionBlocks: RawQuestionBlock[] = [];
  let currentBlock: RawQuestionBlock | null = null;

  // Regex to detect start of a question:
  // e.g., "1.", "1)", "1 .", "Soal 1.", "No. 1", "No 1:"
  const questionStartRegex = /^(?:Soal\s+|No\.?\s*)?(\d+)[\.\)\:\-]\s*(.*)$/i;
  
  // Section header regex
  const sectionHeaderRegex = /^(?:BAGIAN|BAB|PART)?\s*(?:[A-Z0-9\.\-\:]+)?\s*(PILIHAN\s+GANDA|PILIHAN|MULTIPLE\s+CHOICE|ESSAY|URAIAN)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for section header
    const secMatch = line.match(sectionHeaderRegex);
    if (secMatch) {
      const secName = secMatch[1].toUpperCase();
      if (secName.includes('ESSAY') || secName.includes('URAIAN')) {
        currentSectionType = 'essay';
      } else {
        currentSectionType = 'multiple_choice';
      }
      continue;
    }

    // Check if this line starts a new question
    const qMatch = line.match(questionStartRegex);
    if (qMatch) {
      const qNum = parseInt(qMatch[1], 10);
      const rest = qMatch[2].trim();

      // Only treat as question start if qNum is reasonable
      if (currentBlock) {
        questionBlocks.push(currentBlock);
      }

      currentBlock = {
        number: qNum,
        lines: rest ? [rest] : [],
        sectionType: currentSectionType,
      };
    } else {
      if (currentBlock) {
        currentBlock.lines.push(line);
      } else {
        // Text before the first numbered question (title, instructions, etc.)
        // Check if there is an unnumbered first question or skip instructions
      }
    }
  }

  if (currentBlock) {
    questionBlocks.push(currentBlock);
  }

  // If no numbered questions were detected, try splitting by double newline or blank lines
  if (questionBlocks.length === 0) {
    const chunks = contentText.split(/\n\s*\n/);
    chunks.forEach((chunk, idx) => {
      const cleanChunk = chunk.trim();
      if (cleanChunk.length > 10) {
        questionBlocks.push({
          number: idx + 1,
          lines: cleanChunk.split('\n').map(l => l.trim()),
          sectionType: currentSectionType,
        });
      }
    });
  }

  // 3. Process each question block into a Question object
  const questions: Question[] = [];

  questionBlocks.forEach((block, index) => {
    const fullText = block.lines.join('\n');
    let qText = '';
    const options: { A?: string; B?: string; C?: string; D?: string; E?: string } = {};
    let detectedAnswer: string | undefined = undefined;
    let maxScore: number | undefined = undefined;

    // Check for inline answer key: "Kunci: A" or "Kunci Jawaban: A" or "Jawaban: A"
    const inlineKeyMatch = fullText.match(
      /(?:KUNCI\s+JAWABAN|KUNCI|JAWABAN|ANSWER|ANS)\s*[:=\-]\s*([A-Ea-e])\b/i
    );
    if (inlineKeyMatch) {
      detectedAnswer = inlineKeyMatch[1].toUpperCase();
    }

    // Check for essay answer / rubric / score
    const scoreMatch = fullText.match(/(?:Skor|Bobot|Score|Max\s*Score)\s*(?:Maksimal|Maks)?\s*[:=\-]?\s*(\d+)/i);
    if (scoreMatch) {
      maxScore = parseInt(scoreMatch[1], 10);
    }

    // Check answer key map from document bottom
    if (!detectedAnswer && block.number && answerKeyMap.has(block.number)) {
      detectedAnswer = answerKeyMap.get(block.number);
    } else if (!detectedAnswer && answerKeyMap.has(index + 1)) {
      detectedAnswer = answerKeyMap.get(index + 1);
    }

    // Parse options from lines
    // Option line patterns: "A. ...", "A) ...", "a. ...", "(A) ...", "*A. ..."
    // Or multiple options in one line: "A. Foo  B. Bar  C. Baz  D. Qux"
    const optionPrefixRegex = /(?:^|\s+)([\*]?)([A-Ea-e])[\.\)]\s+(.*?)(?=(?:\s+[\*]?[A-Ea-e][\.\)]\s+|$))/g;

    const qLines: string[] = [];
    let hasFoundOption = false;

    for (const rawLine of block.lines) {
      const line = rawLine.trim();

      // Skip lines that are just answer key declarations
      if (/^(?:KUNCI\s+JAWABAN|KUNCI|JAWABAN|ANSWER|ANS)\s*[:=\-]/i.test(line)) {
        continue;
      }
      if (/^(?:Skor|Bobot|Score)\s*(?:Maksimal|Maks)?\s*[:=\-]?\s*\d+/i.test(line)) {
        continue;
      }

      // Test if line contains option prefixes
      const lineMatches = Array.from(line.matchAll(optionPrefixRegex));
      
      if (lineMatches.length > 0) {
        hasFoundOption = true;
        for (const match of lineMatches) {
          const isStarred = match[1] === '*';
          const optLetter = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
          let optText = match[3].trim();

          // Check if asterisk was inside the text like "*Jakarta"
          if (optText.startsWith('*')) {
            optText = optText.slice(1).trim();
            detectedAnswer = optLetter;
          } else if (isStarred) {
            detectedAnswer = optLetter;
          }

          options[optLetter] = optText;
        }
      } else {
        if (!hasFoundOption) {
          qLines.push(line);
        } else {
          // If we already started options, this line might be continuation of the last option
          const keys = Object.keys(options) as ('A' | 'B' | 'C' | 'D' | 'E')[];
          if (keys.length > 0) {
            const lastKey = keys[keys.length - 1];
            options[lastKey] = (options[lastKey] ? options[lastKey] + ' ' : '') + line;
          } else {
            qLines.push(line);
          }
        }
      }
    }

    qText = qLines.join(' ').trim();
    if (!qText && block.lines.length > 0) {
      qText = block.lines[0];
    }

    const hasOptions = Object.keys(options).length >= 2;
    const isEssay = block.sectionType === 'essay' || (!hasOptions && block.sectionType !== 'multiple_choice');

    if (!isEssay && hasOptions) {
      // Multiple Choice Question
      if (!detectedAnswer) {
        warnings.push(`Soal no. ${block.number || index + 1} belum memiliki kunci jawaban.`);
      }

      questions.push({
        id: `q-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        text: qText || `Soal Pilihan Ganda No. ${index + 1}`,
        type: 'multiple_choice',
        options: {
          A: options.A || '',
          B: options.B || '',
          C: options.C || '',
          D: options.D || '',
          E: options.E || '',
        },
        correctAnswer: detectedAnswer || 'A',
      });
    } else {
      // Essay Question
      questions.push({
        id: `q-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        text: qText || fullText || `Soal Essay No. ${index + 1}`,
        type: 'essay',
        correctAnswer: detectedAnswer || '',
        maxScore: maxScore || defaultEssayMaxScore,
      });
    }
  });

  const mcqCount = questions.filter(q => q.type === 'multiple_choice').length;
  const essayCount = questions.filter(q => q.type === 'essay').length;

  return {
    questions,
    totalParsed: questions.length,
    mcqCount,
    essayCount,
    warnings,
    rawTextPreview: rawText.slice(0, 500) + (rawText.length > 500 ? '...' : ''),
  };
}

/**
 * Universal document handler that accepts File and returns parsed Questions.
 */
export async function parseDocumentFile(file: File, defaultEssayMaxScore = 4): Promise<ParseResult> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const questions = await parseExcelQuestions(file, defaultEssayMaxScore);
    return {
      questions,
      totalParsed: questions.length,
      mcqCount: questions.filter(q => q.type === 'multiple_choice').length,
      essayCount: questions.filter(q => q.type === 'essay').length,
      warnings: questions.filter(q => q.type === 'multiple_choice' && !q.correctAnswer).map((_, i) => `Soal PG #${i + 1} tanpa kunci jawaban`),
    };
  }

  let text = '';
  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    text = await extractTextFromWord(file);
  } else if (fileName.endsWith('.txt')) {
    text = await file.text();
  } else {
    throw new Error('Format file tidak didukung. Harap gunakan file PDF (.pdf), Word (.docx), atau Excel (.xlsx).');
  }

  if (!text || !text.trim()) {
    throw new Error('Dokumen tidak berisi teks yang dapat diekstrak atau merupakan file hasil scan gambar tanpa teks.');
  }

  return parseTextToQuestions(text, defaultEssayMaxScore);
}
