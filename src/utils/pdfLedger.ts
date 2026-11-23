import { Account } from '../types';
import {
  MONTH_NAMES,
  calculateMonthSummary,
  formatDisplayDate,
  formatRs,
  getEffectiveStatus,
  makeDateKey,
  makeYearMonthKey,
} from './hazri';

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN_X = 76;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BOTTOM_LIMIT = PAGE_H - 96;

interface SingleMonthRaw {
  counts: Record<'P' | 'A' | 'L' | 'H' | 'O', number>;
  totalWorkingDays: number;
  workingDaysUpToDate: number;
  unmarkedDays: number;
  payableDays: number;
  salary: number;
  perDayRate: number;
  grossEarned: number;
  totalAdvance: number;
  totalPayment: number;
  monthNet: number;
}

function computeSingleMonth(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string
): SingleMonthRaw {
  const calc = calculateMonthSummary(
    account,
    year,
    monthIndex,
    upToDate,
    upToDate
  );
  return {
    counts: calc.counts,
    totalWorkingDays: calc.totalWorkingDays,
    workingDaysUpToDate: calc.workingDaysUpToDate,
    unmarkedDays: calc.unmarkedDays,
    payableDays: calc.payableDays,
    salary: calc.salary,
    perDayRate: calc.perDayRate,
    grossEarned: calc.grossEarned,
    totalAdvance: calc.totalAdvance,
    totalPayment: calc.totalPayment,
    monthNet: calc.monthNet,
  };
}

function createPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.fillStyle = '#4338ca';
  ctx.fillRect(0, 0, PAGE_W, 14);
  return { canvas, ctx };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function buildPdfFromJpegs(pages: Uint8Array[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteOffset = 0;

  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteOffset += b.length;
  };
  const pushText = (s: string) => {
    pushBytes(encoder.encode(s));
  };

  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const pageCount = pages.length;
  // Obj 1: Catalog
  // Obj 2: Pages
  // For each page i (0..pageCount-1):
  //   Page obj: 3 + i * 3
  //   Content obj: 4 + i * 3
  //   Image obj: 5 + i * 3
  const pageIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageIds.push(3 + i * 3);
  }

  offsets[1] = byteOffset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = byteOffset;
  pushText(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(' ')}] /Count ${pageCount} >>\nendobj\n`
  );

  for (let i = 0; i < pageCount; i++) {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imgId = 5 + i * 3;
    const imgBytes = pages[i];
    const streamCmd = `q\n595.28 0 0 841.89 0 0 cm\n/Im${i} Do\nQ\n`;

    offsets[pageId] = byteOffset;
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    offsets[contentId] = byteOffset;
    pushText(
      `${contentId} 0 obj\n<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream\nendobj\n`
    );

    offsets[imgId] = byteOffset;
    pushText(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${PAGE_W} /Height ${PAGE_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
    );
    pushBytes(imgBytes);
    pushText('\nendstream\nendobj\n');
  }

  const totalObjs = 2 + pageCount * 3;
  const xrefPos = byteOffset;
  pushText(`xref\n0 ${totalObjs + 1}\n`);
  pushText('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjs; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushText(`${off} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  );

  const merged = new Uint8Array(byteOffset);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return new Blob([merged], { type: 'application/pdf' });
}

export function generateLedgerPdfBlob(
  account: Account,
  year: number,
  monthIndex: number,
  upToDate: string,
  todayKey: string,
  scope: 'month' | 'all'
): Blob {
  const fontStack =
    '"Plus Jakarta Sans", "Noto Sans Devanagari", system-ui, -apple-system, sans-serif';
  const pages: HTMLCanvasElement[] = [];
  let current = createPageCanvas();
  pages.push(current.canvas);
  let ctx = current.ctx;
  let y = 64;

  const ensureSpace = (needed: number, onNewPage?: () => void) => {
    if (y + needed <= BOTTOM_LIMIT) return;
    current = createPageCanvas();
    pages.push(current.canvas);
    ctx = current.ctx;
    y = 64;
    if (onNewPage) onNewPage();
  };

  // Document Header
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 34px ${fontStack}`;
  ctx.fillText(account.name, MARGIN_X, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4338ca';
  ctx.font = `700 22px ${fontStack}`;
  ctx.fillText('ACCOUNT LEDGER', PAGE_W - MARGIN_X, y - 4);
  ctx.textAlign = 'left';

  y += 32;
  ctx.fillStyle = '#475569';
  ctx.font = `500 20px ${fontStack}`;
  const subLeft = [account.ph, account.em].filter(Boolean).join('  ·  ');
  if (subLeft) {
    ctx.fillText(subLeft, MARGIN_X, y);
  } else {
    ctx.fillText('Staff / Personal Account Statement', MARGIN_X, y);
  }

  ctx.textAlign = 'right';
  const periodLabel =
    scope === 'month'
      ? `${MONTH_NAMES[monthIndex]} ${year} (${formatDisplayDate(upToDate)} तक)`
      : `पूरा लेजर (${formatDisplayDate(todayKey)} तक)`;
  ctx.fillText(periodLabel, PAGE_W - MARGIN_X, y);
  ctx.textAlign = 'left';

  y += 26;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, y);
  ctx.lineTo(PAGE_W - MARGIN_X, y);
  ctx.stroke();
  y += 36;

  if (scope === 'month') {
    const calc = calculateMonthSummary(
      account,
      year,
      monthIndex,
      upToDate,
      todayKey
    );

    // Section 1: Attendance Summary
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 23px ${fontStack}`;
    ctx.fillText('1. हाज़िरी सारांश (Attendance Summary)', MARGIN_X, y);
    y += 18;

    const statDefs: Array<{
      label: string;
      val: number;
      color: string;
      bg: string;
    }> = [
      { label: 'Present', val: calc.counts.P, color: '#16a34a', bg: '#f0fdf4' },
      { label: 'Absent', val: calc.counts.A, color: '#dc2626', bg: '#fef2f2' },
      { label: 'Leave', val: calc.counts.L, color: '#d97706', bg: '#fffbeb' },
      { label: 'Half', val: calc.counts.H, color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'छुट्टी', val: calc.counts.O, color: '#475569', bg: '#f8fafc' },
    ];
    const boxGap = 14;
    const boxW = (CONTENT_W - boxGap * 4) / 5;
    const boxH = 92;

    statDefs.forEach((st, idx) => {
      const bx = MARGIN_X + idx * (boxW + boxGap);
      ctx.fillStyle = st.bg;
      drawRoundedRect(ctx, bx, y, boxW, boxH, 12);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = st.color;
      ctx.font = `700 34px ${fontStack}`;
      ctx.fillText(String(st.val), bx + boxW / 2, y + 48);

      ctx.fillStyle = '#475569';
      ctx.font = `600 18px ${fontStack}`;
      ctx.fillText(st.label, bx + boxW / 2, y + 76);
      ctx.textAlign = 'left';
    });

    y += boxH + 22;

    // Compact Daily Attendance Grid
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cols = 8;
    const cellGap = 8;
    const cellW = (CONTENT_W - cellGap * (cols - 1)) / cols;
    const cellH = 44;
    const rowsNeeded = Math.ceil(daysInMonth / cols);

    for (let d = 1; d <= daysInMonth; d++) {
      const col = (d - 1) % cols;
      const row = Math.floor((d - 1) / cols);
      const cx = MARGIN_X + col * (cellW + cellGap);
      const cy = y + row * (cellH + cellGap);
      const k = makeDateKey(year, monthIndex, d);
      const dw = new Date(year, monthIndex, d).getDay();
      const s = getEffectiveStatus(account, k, dw);

      const chipColor =
        s === 'P'
          ? '#dcfce7'
          : s === 'A'
            ? '#fee2e2'
            : s === 'L'
              ? '#fef3c7'
              : s === 'H'
                ? '#ede9fe'
                : s === 'O'
                  ? '#f1f5f9'
                  : '#ffffff';
      const txtColor =
        s === 'P'
          ? '#15803d'
          : s === 'A'
            ? '#b91c1c'
            : s === 'L'
              ? '#b45309'
              : s === 'H'
                ? '#6d28d9'
                : s === 'O'
                  ? '#475569'
                  : '#94a3b8';

      ctx.fillStyle = chipColor;
      drawRoundedRect(ctx, cx, cy, cellW, cellH, 8);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = txtColor;
      ctx.font = `700 18px ${fontStack}`;
      ctx.textAlign = 'center';
      const label = `${d} ${s === 'O' ? 'छु' : s || '·'}`;
      ctx.fillText(label, cx + cellW / 2, cy + 28);
      ctx.textAlign = 'left';
    }

    y += rowsNeeded * (cellH + cellGap) + 28;

    // Section 2: Salary & Balance Statement
    ensureSpace(340);
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 23px ${fontStack}`;
    ctx.fillText('2. सैलरी व हिसाब विवरण (Hisab Statement)', MARGIN_X, y);
    y += 18;

    const statementRows: Array<{
      label: string;
      value: string;
      color?: string;
      bold?: boolean;
      highlight?: boolean;
    }> = [];

    if (Math.round(calc.openingBalance) !== 0) {
      statementRows.push({
        label:
          calc.openingBalance > 0
            ? 'पिछला बाकी (Carry Forward)'
            : 'पिछला एडवांस / बकाया (Carry Forward)',
        value:
          calc.openingBalance > 0
            ? `+ ${formatRs(calc.openingBalance)}`
            : `− ${formatRs(Math.abs(calc.openingBalance))}`,
        color: calc.openingBalance > 0 ? '#16a34a' : '#dc2626',
        bold: true,
      });
    }

    if (calc.salary > 0) {
      statementRows.push({
        label: `महीने की सैलरी (÷ ${calc.totalWorkingDays} दिन)`,
        value: formatRs(calc.salary),
      });
      statementRows.push({
        label: `${calc.workingDaysUpToDate} दिन (रविवार छोड़कर) × ${formatRs(calc.perDayRate)}`,
        value: formatRs(calc.perDayRate * calc.workingDaysUpToDate),
      });
      statementRows.push({
        label: `Absent ${calc.counts.A} दिन × ${formatRs(calc.perDayRate)}`,
        value: `− ${formatRs(calc.perDayRate * calc.counts.A)}`,
        color: '#dc2626',
      });
      statementRows.push({
        label: `Leave ${calc.counts.L} + Half ${calc.counts.H} + बिना entry ${calc.unmarkedDays} दिन`,
        value: `− ${formatRs(
          calc.perDayRate *
            (calc.counts.L + calc.counts.H * 0.5 + calc.unmarkedDays)
        )}`,
        color: '#dc2626',
      });
      statementRows.push({
        label: `इस महीने की कमाई (${calc.payableDays} दिन)`,
        value: formatRs(calc.grossEarned),
        bold: true,
      });
    }

    statementRows.push({
      label: 'Advance लिया',
      value: `− ${formatRs(calc.totalAdvance)}`,
      color: '#dc2626',
    });
    statementRows.push({
      label: 'Payment मिली',
      value: `− ${formatRs(calc.totalPayment)}`,
      color: '#16a34a',
    });
    statementRows.push({
      label:
        Math.round(calc.openingBalance) !== 0
          ? 'कुल बाकी (पिछले हिसाब सहित)'
          : 'बाकी (इस तारीख तक)',
      value: formatRs(calc.netBalance),
      color: calc.netBalance < 0 ? '#dc2626' : '#4338ca',
      bold: true,
      highlight: true,
    });

    const rowH = 44;
    statementRows.forEach((row) => {
      ensureSpace(rowH + 10);
      if (row.highlight) {
        ctx.fillStyle = '#eef2ff';
        drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, rowH + 6, 10);
        ctx.fill();
      }
      ctx.fillStyle = row.highlight ? '#0f172a' : '#334155';
      ctx.font = `${row.bold ? 700 : 500} ${row.highlight ? 22 : 20}px ${fontStack}`;
      ctx.fillText(row.label, MARGIN_X + 14, y + 30);

      ctx.textAlign = 'right';
      ctx.fillStyle = row.color || '#0f172a';
      ctx.fillText(row.value, PAGE_W - MARGIN_X - 14, y + 30);
      ctx.textAlign = 'left';

      if (!row.highlight) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X, y + rowH);
        ctx.lineTo(PAGE_W - MARGIN_X, y + rowH);
        ctx.stroke();
      }
      y += row.highlight ? rowH + 12 : rowH;
    });

    y += 28;

    // Section 3: Month Ledger Table
    const entries = calc.monthMoney
      .filter((m) => m.d <= upToDate)
      .sort((a, b) => (a.d > b.d ? 1 : -1));

    const drawMoneyTableHeader = () => {
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 23px ${fontStack}`;
      ctx.fillText('3. Advance / Payment लेजर (Transaction Ledger)', MARGIN_X, y);
      y += 16;

      ctx.fillStyle = '#f1f5f9';
      drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = `700 18px ${fontStack}`;
      ctx.fillText('#', MARGIN_X + 16, y + 29);
      ctx.fillText('तारीख', MARGIN_X + 74, y + 29);
      ctx.fillText('प्रकार', MARGIN_X + 240, y + 29);
      ctx.fillText('नोट', MARGIN_X + 410, y + 29);
      ctx.textAlign = 'right';
      ctx.fillText('रकम', PAGE_W - MARGIN_X - 16, y + 29);
      ctx.textAlign = 'left';
      y += 46;
    };

    ensureSpace(120);
    drawMoneyTableHeader();

    if (entries.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = `500 19px ${fontStack}`;
      ctx.fillText('इस महीने कोई Advance / Payment एंट्री नहीं है।', MARGIN_X + 16, y + 32);
      y += 48;
    } else {
      entries.forEach((m, idx) => {
        ensureSpace(46, drawMoneyTableHeader);
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(MARGIN_X, y, CONTENT_W, 42);
        }
        ctx.fillStyle = '#64748b';
        ctx.font = `500 18px ${fontStack}`;
        ctx.fillText(String(idx + 1), MARGIN_X + 16, y + 28);

        ctx.fillStyle = '#0f172a';
        ctx.fillText(formatDisplayDate(m.d), MARGIN_X + 74, y + 28);

        const isAdv = m.t === 'adv';
        ctx.fillStyle = isAdv ? '#dc2626' : '#16a34a';
        ctx.font = `700 18px ${fontStack}`;
        ctx.fillText(isAdv ? 'Advance' : 'Payment', MARGIN_X + 240, y + 28);

        ctx.fillStyle = '#475569';
        ctx.font = `500 18px ${fontStack}`;
        ctx.fillText(
          truncateText(ctx, m.n || '—', CONTENT_W - 600),
          MARGIN_X + 410,
          y + 28
        );

        ctx.textAlign = 'right';
        ctx.fillStyle = isAdv ? '#dc2626' : '#16a34a';
        ctx.font = `700 19px ${fontStack}`;
        ctx.fillText(formatRs(m.a), PAGE_W - MARGIN_X - 16, y + 28);
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X, y + 42);
        ctx.lineTo(PAGE_W - MARGIN_X, y + 42);
        ctx.stroke();
        y += 42;
      });
    }
  } else {
    // Full All-Months Account Ledger Document
    const ymSet = new Set<string>();
    Object.keys(account.days).forEach((k) => {
      const ym = k.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) ymSet.add(ym);
    });
    account.money.forEach((m) => {
      const ym = m.d.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) ymSet.add(ym);
    });
    Object.entries(account.sal).forEach(([ym, val]) => {
      if (/^\d{4}-\d{2}$/.test(ym) && val > 0) ymSet.add(ym);
    });
    ymSet.add(makeYearMonthKey(year, monthIndex));

    const sortedYMs = Array.from(ymSet).sort();

    const drawMonthlyHeader = () => {
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 23px ${fontStack}`;
      ctx.fillText('1. महीने-वार हिसाब सारांश (Monthly Summary)', MARGIN_X, y);
      y += 16;

      ctx.fillStyle = '#f1f5f9';
      drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = `700 18px ${fontStack}`;
      ctx.fillText('महीना', MARGIN_X + 16, y + 29);
      ctx.fillText('हाज़िरी (P/A/L/H)', MARGIN_X + 230, y + 29);
      ctx.textAlign = 'right';
      ctx.fillText('कमाई', MARGIN_X + 635, y + 29);
      ctx.fillText('Advance', MARGIN_X + 790, y + 29);
      ctx.fillText('Payment', MARGIN_X + 940, y + 29);
      ctx.fillText('कुल बाकी', PAGE_W - MARGIN_X - 16, y + 29);
      ctx.textAlign = 'left';
      y += 46;
    };

    drawMonthlyHeader();
    let running = 0;

    sortedYMs.forEach((ym, idx) => {
      ensureSpace(46, drawMonthlyHeader);
      const [yStr, mStr] = ym.split('-');
      const py = Number(yStr);
      const pm = Number(mStr) - 1;
      const dim = new Date(py, pm + 1, 0).getDate();
      const mStart = makeDateKey(py, pm, 1);
      const mEnd = makeDateKey(py, pm, dim);
      const mUpTo =
        mEnd <= todayKey ? mEnd : mStart <= todayKey ? todayKey : mEnd;
      const raw = computeSingleMonth(account, py, pm, mUpTo);
      running += raw.monthNet;

      if (idx % 2 === 1) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(MARGIN_X, y, CONTENT_W, 42);
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = `600 18px ${fontStack}`;
      ctx.fillText(`${MONTH_NAMES[pm].slice(0, 3)} ${py}`, MARGIN_X + 16, y + 28);

      ctx.fillStyle = '#475569';
      ctx.font = `500 17px ${fontStack}`;
      ctx.fillText(
        `P:${raw.counts.P}  A:${raw.counts.A}  L:${raw.counts.L}  H:${raw.counts.H}`,
        MARGIN_X + 230,
        y + 28
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(formatRs(raw.grossEarned), MARGIN_X + 635, y + 28);
      ctx.fillStyle = '#dc2626';
      ctx.fillText(formatRs(raw.totalAdvance), MARGIN_X + 790, y + 28);
      ctx.fillStyle = '#16a34a';
      ctx.fillText(formatRs(raw.totalPayment), MARGIN_X + 940, y + 28);
      ctx.fillStyle = running < 0 ? '#dc2626' : '#4338ca';
      ctx.font = `700 18px ${fontStack}`;
      ctx.fillText(formatRs(running), PAGE_W - MARGIN_X - 16, y + 28);
      ctx.textAlign = 'left';

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, y + 42);
      ctx.lineTo(PAGE_W - MARGIN_X, y + 42);
      ctx.stroke();
      y += 42;
    });

    y += 14;
    ensureSpace(64);
    ctx.fillStyle = '#eef2ff';
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 22px ${fontStack}`;
    ctx.fillText('मौजूदा कुल बाकी (Closing Balance)', MARGIN_X + 16, y + 33);
    ctx.textAlign = 'right';
    ctx.fillStyle = running < 0 ? '#dc2626' : '#4338ca';
    ctx.fillText(formatRs(running), PAGE_W - MARGIN_X - 16, y + 33);
    ctx.textAlign = 'left';
    y += 78;

    // All transactions table
    const allMoney = [...account.money].sort((a, b) => (a.d > b.d ? 1 : -1));
    const drawAllMoneyHeader = () => {
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 23px ${fontStack}`;
      ctx.fillText('2. सभी Advance / Payment एंट्री (Full Ledger)', MARGIN_X, y);
      y += 16;

      ctx.fillStyle = '#f1f5f9';
      drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 44, 8);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = `700 18px ${fontStack}`;
      ctx.fillText('#', MARGIN_X + 16, y + 29);
      ctx.fillText('तारीख', MARGIN_X + 74, y + 29);
      ctx.fillText('प्रकार', MARGIN_X + 240, y + 29);
      ctx.fillText('नोट', MARGIN_X + 410, y + 29);
      ctx.textAlign = 'right';
      ctx.fillText('रकम', PAGE_W - MARGIN_X - 16, y + 29);
      ctx.textAlign = 'left';
      y += 46;
    };

    ensureSpace(120);
    drawAllMoneyHeader();

    if (allMoney.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = `500 19px ${fontStack}`;
      ctx.fillText('कोई Advance / Payment एंट्री दर्ज नहीं है।', MARGIN_X + 16, y + 32);
      y += 48;
    } else {
      allMoney.forEach((m, idx) => {
        ensureSpace(46, drawAllMoneyHeader);
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(MARGIN_X, y, CONTENT_W, 42);
        }
        ctx.fillStyle = '#64748b';
        ctx.font = `500 18px ${fontStack}`;
        ctx.fillText(String(idx + 1), MARGIN_X + 16, y + 28);

        ctx.fillStyle = '#0f172a';
        ctx.fillText(formatDisplayDate(m.d), MARGIN_X + 74, y + 28);

        const isAdv = m.t === 'adv';
        ctx.fillStyle = isAdv ? '#dc2626' : '#16a34a';
        ctx.font = `700 18px ${fontStack}`;
        ctx.fillText(isAdv ? 'Advance' : 'Payment', MARGIN_X + 240, y + 28);

        ctx.fillStyle = '#475569';
        ctx.font = `500 18px ${fontStack}`;
        ctx.fillText(
          truncateText(ctx, m.n || '—', CONTENT_W - 600),
          MARGIN_X + 410,
          y + 28
        );

        ctx.textAlign = 'right';
        ctx.fillStyle = isAdv ? '#dc2626' : '#16a34a';
        ctx.font = `700 19px ${fontStack}`;
        ctx.fillText(formatRs(m.a), PAGE_W - MARGIN_X - 16, y + 28);
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGIN_X, y + 42);
        ctx.lineTo(PAGE_W - MARGIN_X, y + 42);
        ctx.stroke();
        y += 42;
      });
    }
  }

  // Draw Footers on all pages
  const totalPages = pages.length;
  pages.forEach((canvas, idx) => {
    const pctx = canvas.getContext('2d');
    if (!pctx) return;
    pctx.strokeStyle = '#e2e8f0';
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    pctx.moveTo(MARGIN_X, PAGE_H - 64);
    pctx.lineTo(PAGE_W - MARGIN_X, PAGE_H - 64);
    pctx.stroke();

    pctx.fillStyle = '#64748b';
    pctx.font = `500 16px ${fontStack}`;
    pctx.fillText(
      `Attendance App  ·  तारीख: ${formatDisplayDate(todayKey)}`,
      MARGIN_X,
      PAGE_H - 34
    );
    pctx.textAlign = 'right';
    pctx.fillText(
      `पृष्ठ ${idx + 1} / ${totalPages}`,
      PAGE_W - MARGIN_X,
      PAGE_H - 34
    );
    pctx.textAlign = 'left';
  });

  const jpegPages = pages.map(canvasToJpegBytes);
  return buildPdfFromJpegs(jpegPages);
}
