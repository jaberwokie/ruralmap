/**
 * Training export utilities — generate .docx and .pdf from TrainingSection[].
 *
 * Pure client-side. No network, no server. Used by the /admin/training page
 * download buttons. Safe to delete this folder to remove the feature.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from 'docx';
import jsPDF from 'jspdf';
import type { TrainingBlock, TrainingSection } from './trainingContent';

const FILENAME_BASE = 'Rural_Map_Decision_Assist_Training';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blockToParagraphs(block: TrainingBlock): Paragraph[] {
  switch (block.kind) {
    case 'h1':
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      ];
    case 'h2':
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      ];
    case 'h3':
      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      ];
    case 'p':
      return [new Paragraph({ children: [new TextRun(block.text)] })];
    case 'note':
      return [
        new Paragraph({
          children: [new TextRun({ text: `Note: ${block.text}`, italics: true })],
        }),
      ];
    case 'bullets':
      return block.items.map(
        (t) =>
          new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            children: [new TextRun(t)],
          }),
      );
    case 'steps':
      return block.items.map(
        (t) =>
          new Paragraph({
            numbering: { reference: 'steps', level: 0 },
            children: [new TextRun(t)],
          }),
      );
    case 'screenshot':
      return [
        new Paragraph({
          children: [new TextRun({ text: `[${block.label}]`, bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Capture instruction: ${block.instruction}`, italics: true }),
          ],
        }),
      ];
  }
}

export async function downloadTrainingDocx(
  sections: TrainingSection[],
  title: string,
  subtitle: string,
): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: title, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: subtitle, italics: true })],
    }),
    new Paragraph({ children: [new TextRun('')] }),
  ];

  for (const section of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: section.title, bold: true })],
      }),
    );
    for (const block of section.blocks) {
      for (const p of blockToParagraphs(block)) children.push(p);
    }
  }

  const doc = new Document({
    creator: 'NovumHealth Rural Map',
    title,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 30, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 24, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'steps',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${FILENAME_BASE}.docx`);
}

export function downloadTrainingPdf(
  sections: TrainingSection[],
  title: string,
  subtitle: string,
): void {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 54;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function writeWrapped(text: string, fontSize: number, bold = false, italic = false, indent = 0) {
    pdf.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : italic ? 'italic' : 'normal');
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth - indent);
    const lineHeight = fontSize * 1.25;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin + indent, y);
      y += lineHeight;
    }
  }

  // Title
  writeWrapped(title, 20, true);
  y += 4;
  writeWrapped(subtitle, 11, false, true);
  y += 12;

  for (const section of sections) {
    y += 6;
    writeWrapped(section.title, 16, true);
    y += 2;
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'h1':
          y += 4;
          writeWrapped(block.text, 16, true);
          break;
        case 'h2':
          y += 3;
          writeWrapped(block.text, 13, true);
          break;
        case 'h3':
          y += 2;
          writeWrapped(block.text, 12, true);
          break;
        case 'p':
          writeWrapped(block.text, 11);
          y += 4;
          break;
        case 'note':
          writeWrapped(`Note: ${block.text}`, 11, false, true);
          y += 4;
          break;
        case 'bullets':
          for (const item of block.items) writeWrapped(`\u2022  ${item}`, 11, false, false, 12);
          y += 4;
          break;
        case 'steps':
          block.items.forEach((item, i) =>
            writeWrapped(`${i + 1}.  ${item}`, 11, false, false, 12),
          );
          y += 4;
          break;
        case 'screenshot':
          writeWrapped(`[${block.label}]`, 11, true);
          writeWrapped(`Capture instruction: ${block.instruction}`, 11, false, true);
          y += 4;
          break;
      }
    }
  }

  pdf.save(`${FILENAME_BASE}.pdf`);
}
