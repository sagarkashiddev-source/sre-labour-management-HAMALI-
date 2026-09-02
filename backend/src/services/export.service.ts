import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { DayRow, RangeTotals, MonthlyBillRow, MonthlyBillTotals } from './report.service';
import { getBusinessTodayLabel } from '../utils/businessDate';
import { amountInWordsRupeesOnly } from '../utils/numberToWords';

const BUSINESS_NAME = 'S.R. Logistics Supply Chain Solutions (SRE)';
const BUSINESS_ADDRESS = 'Dongre Wasti, Chimbali Phata, Chakan, Pune - 410501';

// Reproduces the real bill's letterhead exactly (S_R_ENTERPRISES_APRIL_2026
// PDF) — the issuing entity's own name/address/GST, distinct from the
// BUSINESS_NAME/BUSINESS_ADDRESS constants above, which are the *client*
// this bill is issued to (see "BILL TO" on the real document).
const ISSUER_NAME = 'SAGAR ROADWAYS AND ENTERPRISES';
const ISSUER_ADDRESS = 'Gat No.505-506-621/26 Sai Ganesh Phase-2 Flat No- 10, Pune Nashik Road Ektanagar Chakan Pune-410501';
const ISSUER_GST_NO = '33ACOFS6325E1Z3';
const ISSUER_MOBILE = '9922297341 / 8668922861';
const CLIENT_GST_NO = '27BBBPK0030K1Z2';
const BANK_ACCOUNT_NAME = 'Sagar Enterprise';
const BANK_ACCOUNT_NO = '50200032115423';
const BANK_IFSC = 'HDFC0000746';

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

// -----------------------------------------------------------------------
// Monthly Bill (itemized, GST-added invoice — reproduces the real
// S_R_ENTERPRISES bill format exactly: SR.NO / DATE / VEHICLE.NO / TYPE /
// LOAD-UNLOAD / COMPANY / REMARK / AMOUNT rows, then subtotal + GST +
// grand total + amount in words + bank details).
// -----------------------------------------------------------------------

export interface BillMeta {
  billNo?: string;
  billDate?: string; // pre-formatted, e.g. "01/MAY/2026" — the business's own convention
}

export async function generateMonthlyBillExcel(
  month: number,
  year: number,
  rows: MonthlyBillRow[],
  totals: MonthlyBillTotals,
  meta: BillMeta,
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = ISSUER_NAME;
  wb.created = new Date();

  const sheet = wb.addWorksheet(`Bill ${monthName(month)} ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  const COLS = 8; // SR.NO, DATE, VEHICLE.NO, TYPE, LOAD/UNLOAD, COMPANY, REMARK, AMOUNT
  sheet.mergeCells(1, 1, 1, COLS);
  sheet.getCell('A1').value = ISSUER_NAME;
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, COLS);
  sheet.getCell('A2').value = ISSUER_ADDRESS;
  sheet.getCell('A2').font = { name: 'Arial', size: 9 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.mergeCells(3, 1, 3, COLS);
  sheet.getCell('A3').value = `GST NO: ${ISSUER_GST_NO}    MOB NO: ${ISSUER_MOBILE}`;
  sheet.getCell('A3').font = { name: 'Arial', size: 9 };
  sheet.getCell('A3').alignment = { horizontal: 'center' };

  sheet.getCell('A5').value = 'BILL TO:-';
  sheet.getCell('A5').font = { name: 'Arial', bold: true, size: 10 };
  sheet.getCell('C5').value = BUSINESS_NAME;
  sheet.getCell('C5').font = { name: 'Arial', bold: true, size: 10 };
  sheet.getCell('A6').value = BUSINESS_ADDRESS;
  sheet.getCell('A6').font = { name: 'Arial', size: 9 };
  sheet.getCell('A7').value = `GST NO: ${CLIENT_GST_NO}`;
  sheet.getCell('A7').font = { name: 'Arial', size: 9 };

  sheet.getCell('F5').value = `BILL DATE: ${meta.billDate ?? getBusinessTodayLabel()}`;
  sheet.getCell('F5').font = { name: 'Arial', size: 9 };
  sheet.getCell('F6').value = `BILL NO: ${meta.billNo ?? '(not assigned)'}`;
  sheet.getCell('F6').font = { name: 'Arial', size: 9 };
  sheet.getCell('F7').value = `MONTH: ${monthName(month).toUpperCase()} - ${year}`;
  sheet.getCell('F7').font = { name: 'Arial', size: 9 };

  const headerRowIdx = 9;
  const headers = ['SR.NO', 'DATE', 'VEHICLE.NO', 'TYPE', 'LOAD/UNLOAD', 'COMPANY', 'REMARK', 'AMOUNT'];
  const headerRow = sheet.getRow(headerRowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center' };
  });
  sheet.columns = [
    { width: 8 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 12 },
    { width: 20 }, { width: 16 }, { width: 12 },
  ];

  const firstDataRow = headerRowIdx + 1;
  rows.forEach((r, idx) => {
    const row = sheet.getRow(firstDataRow + idx);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = r.date;
    row.getCell(3).value = r.vehicleNo;
    row.getCell(4).value = r.vehicleType;
    row.getCell(5).value = r.loadUnload;
    row.getCell(6).value = r.companyName;
    row.getCell(7).value = r.remark ?? '';
    row.getCell(8).value = Number(r.amount);
    row.getCell(8).numFmt = '#,##0.00';
  });

  const subtotalRowIdx = firstDataRow + rows.length;
  const lastDataRow = firstDataRow + rows.length - 1;
  const subtotalRow = sheet.getRow(subtotalRowIdx);
  subtotalRow.getCell(6).value = 'SUBTOTAL';
  subtotalRow.getCell(6).font = { name: 'Arial', bold: true };
  subtotalRow.getCell(8).value = rows.length > 0 ? { formula: `SUM(H${firstDataRow}:H${lastDataRow})` } : 0;
  subtotalRow.getCell(8).numFmt = '#,##0.00';
  subtotalRow.getCell(8).font = { name: 'Arial', bold: true };

  const gstRowIdx = subtotalRowIdx + 1;
  const gstRow = sheet.getRow(gstRowIdx);
  gstRow.getCell(6).value = `GST (${totals.gstRatePct}%)`;
  gstRow.getCell(6).font = { name: 'Arial', bold: true };
  gstRow.getCell(8).value = { formula: `H${subtotalRowIdx}*${totals.gstRatePct}/100` };
  gstRow.getCell(8).numFmt = '#,##0.00';
  gstRow.getCell(8).font = { name: 'Arial', bold: true };

  const totalRowIdx = gstRowIdx + 1;
  const totalRow = sheet.getRow(totalRowIdx);
  totalRow.getCell(6).value = 'TOTAL';
  totalRow.getCell(6).font = { name: 'Arial', bold: true, size: 11 };
  totalRow.getCell(8).value = { formula: `H${subtotalRowIdx}+H${gstRowIdx}` };
  totalRow.getCell(8).numFmt = '#,##0.00';
  totalRow.getCell(8).font = { name: 'Arial', bold: true, size: 11 };

  sheet.mergeCells(totalRowIdx + 2, 1, totalRowIdx + 2, COLS);
  sheet.getCell(`A${totalRowIdx + 2}`).value =
    `Amount In Word :- ${amountInWordsRupeesOnly(totals.grandTotal.toNumber())}`;
  sheet.getCell(`A${totalRowIdx + 2}`).font = { name: 'Arial', italic: true, size: 9 };

  const bankRowIdx = totalRowIdx + 4;
  sheet.getCell(`A${bankRowIdx}`).value = `Bank Details :- For ${BANK_ACCOUNT_NAME}`;
  sheet.getCell(`A${bankRowIdx}`).font = { name: 'Arial', bold: true, size: 9 };
  sheet.getCell(`A${bankRowIdx + 1}`).value = `Bank A/C No : ${BANK_ACCOUNT_NO}`;
  sheet.getCell(`A${bankRowIdx + 1}`).font = { name: 'Arial', size: 9 };
  sheet.getCell(`A${bankRowIdx + 2}`).value = `Bank IFSC Code: ${BANK_IFSC}`;
  sheet.getCell(`A${bankRowIdx + 2}`).font = { name: 'Arial', size: 9 };

  sheet.mergeCells(bankRowIdx, COLS - 1, bankRowIdx, COLS);
  sheet.getCell(bankRowIdx, COLS - 1).value = 'Authorised Signatory';
  sheet.getCell(bankRowIdx, COLS - 1).font = { name: 'Arial', italic: true, size: 9 };
  sheet.getCell(bankRowIdx, COLS - 1).alignment = { horizontal: 'right' };

  sheet.getRow(headerRowIdx).eachCell((cell) => {
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
  });
  for (let r = firstDataRow; r <= bankRowIdx + 2; r++) {
    sheet.getRow(r).eachCell((cell) => {
      if (!cell.font) cell.font = { name: 'Arial', size: 9 };
    });
  }

  return wb.xlsx.writeBuffer();
}

export function generateMonthlyBillPdf(
  month: number,
  year: number,
  rows: MonthlyBillRow[],
  totals: MonthlyBillTotals,
  meta: BillMeta,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    // Narrower columns than the per-day report — 8 columns instead of 7,
    // and one of them (COMPANY) needs real width, so SR.NO/DATE/TYPE/L-U
    // are kept tight, matching the real bill's dense layout.
    const colX = {
      sr: MARGIN, date: MARGIN + 22, vehicle: MARGIN + 65, type: MARGIN + 130,
      loadUnload: MARGIN + 170, company: MARGIN + 215, remark: MARGIN + 330,
      amount: MARGIN + 420,
    };
    const colW = { sr: 22, date: 43, vehicle: 65, type: 40, loadUnload: 45, company: 115, remark: 90, amount: 75 };
    const rowHeight = 14;
    const tableTop = 150;
    const tableBottom = A4_HEIGHT - MARGIN - 40;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(14).text(ISSUER_NAME, MARGIN, MARGIN, { align: 'center', width: A4_WIDTH - MARGIN * 2 });
      doc.font('Helvetica').fontSize(8).text(ISSUER_ADDRESS, MARGIN, MARGIN + 18, { align: 'center', width: A4_WIDTH - MARGIN * 2 });
      doc.text(`GST NO: ${ISSUER_GST_NO}   MOB NO: ${ISSUER_MOBILE}`, MARGIN, MARGIN + 30, { align: 'center', width: A4_WIDTH - MARGIN * 2 });

      doc.font('Helvetica-Bold').fontSize(9).text('BILL TO:-', MARGIN, MARGIN + 50);
      doc.text(BUSINESS_NAME, MARGIN + 55, MARGIN + 50);
      doc.font('Helvetica').fontSize(8).text(BUSINESS_ADDRESS, MARGIN, MARGIN + 62);
      doc.text(`GST NO: ${CLIENT_GST_NO}`, MARGIN, MARGIN + 74);

      doc.font('Helvetica').fontSize(8)
        .text(`BILL DATE: ${meta.billDate ?? getBusinessTodayLabel()}`, MARGIN + 350, MARGIN + 50)
        .text(`BILL NO: ${meta.billNo ?? '(not assigned)'}`, MARGIN + 350, MARGIN + 62)
        .text(`MONTH: ${monthName(month).toUpperCase()} - ${year}`, MARGIN + 350, MARGIN + 74);

      drawTableHeader();
    }

    function drawTableHeader() {
      const y = tableTop;
      doc.font('Helvetica-Bold').fontSize(7);
      doc.text('SR.NO', colX.sr, y, { width: colW.sr });
      doc.text('DATE', colX.date, y, { width: colW.date });
      doc.text('VEHICLE.NO', colX.vehicle, y, { width: colW.vehicle });
      doc.text('TYPE', colX.type, y, { width: colW.type });
      doc.text('LOAD/UNLD', colX.loadUnload, y, { width: colW.loadUnload });
      doc.text('COMPANY', colX.company, y, { width: colW.company });
      doc.text('REMARK', colX.remark, y, { width: colW.remark });
      doc.text('AMOUNT', colX.amount, y, { width: colW.amount, align: 'right' });
      doc.moveTo(MARGIN, y + 11).lineTo(A4_WIDTH - MARGIN, y + 11).strokeColor('#999999').stroke();
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
    let y = tableTop + 16;
    doc.font('Helvetica').fontSize(7);

    rows.forEach((r, idx) => {
      if (y + rowHeight > tableBottom) {
        doc.addPage();
        drawHeader();
        y = tableTop + 16;
        doc.font('Helvetica').fontSize(7);
      }
      doc.text(String(idx + 1), colX.sr, y, { width: colW.sr });
      doc.text(r.date, colX.date, y, { width: colW.date });
      doc.text(r.vehicleNo, colX.vehicle, y, { width: colW.vehicle });
      doc.text(r.vehicleType, colX.type, y, { width: colW.type });
      doc.text(r.loadUnload, colX.loadUnload, y, { width: colW.loadUnload });
      doc.text(r.companyName, colX.company, y, { width: colW.company, ellipsis: true });
      doc.text(r.remark ?? '', colX.remark, y, { width: colW.remark, ellipsis: true });
      doc.text(Number(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount, y, { width: colW.amount, align: 'right' });
      y += rowHeight;
    });

    // Totals block — kept together on the current page if it fits, else a
    // fresh page, since splitting SUBTOTAL/GST/TOTAL across pages would
    // look wrong on a financial document.
    const totalsBlockHeight = 90;
    if (y + totalsBlockHeight > tableBottom) {
      doc.addPage();
      y = tableTop;
    } else {
      doc.moveTo(MARGIN, y).lineTo(A4_WIDTH - MARGIN, y).strokeColor('#999999').stroke();
      y += 8;
    }

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('SUBTOTAL', colX.company, y, { width: colW.company });
    doc.text(Number(totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount, y, { width: colW.amount, align: 'right' });
    y += 14;
    doc.text(`GST (${totals.gstRatePct}%)`, colX.company, y, { width: colW.company });
    doc.text(Number(totals.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount, y, { width: colW.amount, align: 'right' });
    y += 14;
    doc.fontSize(11);
    doc.text('TOTAL', colX.company, y, { width: colW.company });
    doc.text(Number(totals.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount, y, { width: colW.amount, align: 'right' });
    y += 22;

    doc.font('Helvetica-Oblique').fontSize(8);
    doc.text(`Amount In Word :- ${amountInWordsRupeesOnly(totals.grandTotal.toNumber())}`, MARGIN, y, { width: A4_WIDTH - MARGIN * 2 });
    y += 24;

    doc.font('Helvetica-Bold').fontSize(8).text(`Bank Details :- For ${BANK_ACCOUNT_NAME}`, MARGIN, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).text(`Bank A/C No : ${BANK_ACCOUNT_NO}`, MARGIN, y);
    y += 12;
    doc.text(`Bank IFSC Code: ${BANK_IFSC}`, MARGIN, y);

    doc.font('Helvetica-Oblique').fontSize(8).text('Authorised Signatory', A4_WIDTH - MARGIN - 150, y, { width: 150, align: 'right' });

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, pageCount);
    }

    doc.end();
  });
}
