import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { DayRow, RangeTotals } from './report.service';
import { getBusinessTodayLabel } from '../utils/businessDate';

const BUSINESS_NAME = 'S.R. Logistics Supply Chain Solutions (SRE)';
const BUSINESS_ADDRESS = 'Dongre Wasti, Chimbali Phata, Chakan, Pune - 410501';

function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' });
}

// -----------------------------------------------------------------------
// Excel
// -----------------------------------------------------------------------

/**
 * Reproduces the workbook's per-day summary sheet structure (spec section
 * 21: Date, Amount, Deduction, Net, Labour Present, Per Person) as a real
 * .xlsx with live formulas for the totals row — not hardcoded numbers —
 * per the xlsx skill's "use formulas, never hardcoded results" rule.
 */
export async function generateMonthlyExcel(
  month: number,
  year: number,
  days: DayRow[],
  totals: RangeTotals,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = BUSINESS_NAME;
  wb.created = new Date();

  const sheet = wb.addWorksheet(`${monthName(month)} ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }, // 9 = A4
  });

  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `${BUSINESS_NAME} — Monthly Hamali Report`;
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true };

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `${monthName(month)} ${year}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 11 };

  sheet.mergeCells('A3:G3');
  sheet.getCell('A3').value = `Generated: ${getBusinessTodayLabel()}`;
  sheet.getCell('A3').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };

  const headerRowIdx = 5;
  const headers = ['SR.NO', 'DATE', 'GROSS AMOUNT', 'DEDUCTION', 'NET AMOUNT', 'PRESENT', 'PER PERSON'];
  const headerRow = sheet.getRow(headerRowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center' };
  });
  sheet.columns = [
    { width: 8 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 10 }, { width: 14 },
  ];

  const firstDataRow = headerRowIdx + 1;
  days.forEach((d, idx) => {
    const r = sheet.getRow(firstDataRow + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(2).value = d.date;
    r.getCell(3).value = Number(d.grossAmount);
    r.getCell(4).value = Number(d.totalDeduction);
    r.getCell(5).value = Number(d.netAmount);
    r.getCell(6).value = d.present ?? '-';
    r.getCell(7).value = d.perPerson ? Number(d.perPerson) : '-';
    for (let c = 3; c <= 5; c++) r.getCell(c).numFmt = '#,##0.00';
    if (typeof r.getCell(7).value === 'number') r.getCell(7).numFmt = '#,##0.00';
  });

  const totalsRowIdx = firstDataRow + days.length + 1;
  const lastDataRow = firstDataRow + days.length - 1;
  const totalsRow = sheet.getRow(totalsRowIdx);
  totalsRow.getCell(2).value = 'GRAND TOTAL';
  totalsRow.getCell(2).font = { name: 'Arial', bold: true };
  if (days.length > 0) {
    totalsRow.getCell(3).value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
    totalsRow.getCell(4).value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})` };
    totalsRow.getCell(5).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` };
  } else {
    totalsRow.getCell(3).value = 0;
    totalsRow.getCell(4).value = 0;
    totalsRow.getCell(5).value = 0;
  }
  for (let c = 3; c <= 5; c++) {
    totalsRow.getCell(c).numFmt = '#,##0.00';
    totalsRow.getCell(c).font = { name: 'Arial', bold: true };
  }
  totalsRow.getCell(6).value = totals.totalLabourDays;
  totalsRow.getCell(6).font = { name: 'Arial', bold: true };

  sheet.getRow(headerRowIdx).eachCell((cell) => {
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  // Ensure every data cell uses a professional font (xlsx skill requirement).
  for (let r = firstDataRow; r <= totalsRowIdx; r++) {
    sheet.getRow(r).eachCell((cell) => {
      if (!cell.font) cell.font = { name: 'Arial', size: 10 };
    });
  }

  return wb.xlsx.writeBuffer();
}

// -----------------------------------------------------------------------
// PDF
// -----------------------------------------------------------------------

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;

/**
 * Professional A4 PDF with repeated headers and automatic page breaks
 * (spec section 19 requirements). Streams to a Buffer.
 */
export function generateMonthlyPdf(
  month: number,
  year: number,
  days: DayRow[],
  totals: RangeTotals,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const colX = { sr: MARGIN, date: MARGIN + 40, gross: MARGIN + 130, deduction: MARGIN + 240, net: MARGIN + 340, present: MARGIN + 430, perPerson: MARGIN + 470 };
    const rowHeight = 18;
    const tableTop = 150;
    const tableBottom = A4_HEIGHT - MARGIN - 40;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(16).text(BUSINESS_NAME, MARGIN, MARGIN);
      doc.font('Helvetica').fontSize(9).text(BUSINESS_ADDRESS, MARGIN, MARGIN + 20);
      doc.fontSize(13).font('Helvetica-Bold').text(`Monthly Hamali Report — ${monthName(month)} ${year}`, MARGIN, MARGIN + 45);
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text(`Generated: ${getBusinessTodayLabel()}`, MARGIN, MARGIN + 65);
      doc.fillColor('black');
      drawTableHeader();
    }

    function drawTableHeader() {
      const y = tableTop;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('SR.NO', colX.sr, y, { width: 35 });
      doc.text('DATE', colX.date, y, { width: 85 });
      doc.text('GROSS', colX.gross, y, { width: 100, align: 'right' });
      doc.text('DEDUCTION', colX.deduction, y, { width: 90, align: 'right' });
      doc.text('NET', colX.net, y, { width: 85, align: 'right' });
      doc.text('PRES.', colX.present, y, { width: 35, align: 'right' });
      doc.text('PER PERSON', colX.perPerson, y, { width: 85, align: 'right' });
      doc.moveTo(MARGIN, y + 14).lineTo(A4_WIDTH - MARGIN, y + 14).strokeColor('#999999').stroke();
    }

    function drawFooter(pageNum: number, pageCount: number) {
      doc.font('Helvetica').fontSize(8).fillColor('#666666')
        .text(`Page ${pageNum} of ${pageCount}`, MARGIN, A4_HEIGHT - MARGIN + 10, {
          width: A4_WIDTH - MARGIN * 2,
          align: 'center',
        });
      doc.fillColor('black');
    }

    drawHeader();
    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(9);

    for (const d of days) {
      if (y + rowHeight > tableBottom) {
        doc.addPage();
        drawHeader();
        y = tableTop + 22;
        doc.font('Helvetica').fontSize(9);
      }
      const idx = days.indexOf(d) + 1;
      doc.text(String(idx), colX.sr, y, { width: 35 });
      doc.text(d.date, colX.date, y, { width: 85 });
      doc.text(Number(d.grossAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.gross, y, { width: 100, align: 'right' });
      doc.text(Number(d.totalDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.deduction, y, { width: 90, align: 'right' });
      doc.text(Number(d.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.net, y, { width: 85, align: 'right' });
      doc.text(d.present !== null ? String(d.present) : '-', colX.present, y, { width: 35, align: 'right' });
      doc.text(d.perPerson ? Number(d.perPerson).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-', colX.perPerson, y, { width: 85, align: 'right' });
      y += rowHeight;
    }

    if (y + rowHeight > tableBottom) {
      doc.addPage();
      drawHeader();
      y = tableTop + 22;
    }
    doc.moveTo(MARGIN, y).lineTo(A4_WIDTH - MARGIN, y).strokeColor('#999999').stroke();
    y += 6;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('GRAND TOTAL', colX.date, y, { width: 85 });
    doc.text(Number(totals.grossAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.gross, y, { width: 100, align: 'right' });
    doc.text(Number(totals.totalDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.deduction, y, { width: 90, align: 'right' });
    doc.text(Number(totals.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.net, y, { width: 85, align: 'right' });
    doc.text(String(totals.totalLabourDays), colX.present, y, { width: 35, align: 'right' });

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, pageCount);
    }

    doc.end();
  });
}
