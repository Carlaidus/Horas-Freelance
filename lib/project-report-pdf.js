const PDFDocument = require('pdfkit');

const EUR = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const PCT = (n) => `${parseFloat(n || 0).toFixed(0)}%`;
const FECHA = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const HRS = (h) => `${parseFloat(h || 0).toFixed(2)} h`;

function generateProjectReportPdf(project, entries, user, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Informe — ${project.name}` } });
  const safeName = project.name.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="informe-${safeName}.pdf"`);
  doc.pipe(res);

  const W = 595 - 100;
  const DARK  = '#1a1a2e';
  const GRAY  = '#555580';
  const LGRAY = '#e8e8f0';
  const BLACK = '#111111';
  const GOLD  = '#c8a000';

  const ivaRate  = user?.iva_rate  ?? 21;
  const irpfRate = user?.irpf_rate ?? 15;
  const gross    = project.total_amount || 0;
  const ivaAmt   = gross * (ivaRate / 100);
  const irpfAmt  = gross * (irpfRate / 100);
  const net      = gross + ivaAmt - irpfAmt;
  const avgRate  = project.total_hours > 0 ? gross / project.total_hours : 0;

  const endDate = project.completed_at || project.last_entry_date;
  const statusLabel = project.status === 'paid' ? 'COBRADO'
    : project.is_completed ? 'TERMINADO'
    : project.status === 'sent' ? 'FACTURADO'
    : 'EN CURSO';

  // ── HEADER ───────────────────────────────────────────────────
  doc.rect(50, 40, W, 70).fill('#06060f');
  doc.fillColor('#9090b8').fontSize(9).font('Helvetica')
     .text('INFORME DE PROYECTO', 65, 50);
  doc.fillColor('#f5c842').fontSize(18).font('Helvetica-Bold')
     .text(project.name, 65, 64, { width: W - 90 });
  doc.fillColor('#9090b8').fontSize(9).font('Helvetica')
     .text(statusLabel, 65, 90);

  let y = 130;

  // ── EMISOR / CLIENTE ─────────────────────────────────────────
  const col1 = 50, col2 = 310, blockW = 230;

  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
     .text('PROFESIONAL', col1, y)
     .text('CLIENTE / EMPRESA', col2, y);
  y += 14;

  doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold')
     .text(user?.name || '—', col1, y, { width: blockW });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica');
  if (user?.nif) doc.text(`NIF: ${user.nif}`, col1, y + 14, { width: blockW });
  const issuerLines = [user?.address, [user?.postal_code, user?.city].filter(Boolean).join(' ')].filter(Boolean);
  issuerLines.forEach((l, i) => doc.text(l, col1, y + 26 + i * 13, { width: blockW }));

  doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold')
     .text(project.company_name || '—', col2, y, { width: blockW });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica');
  if (project.company_cif) doc.text(`CIF: ${project.company_cif}`, col2, y + 14, { width: blockW });
  const custLines = [project.company_address, [project.company_postal_code, project.company_city].filter(Boolean).join(' ')].filter(Boolean);
  custLines.forEach((l, i) => doc.text(l, col2, y + 26 + i * 13, { width: blockW }));

  y += 70;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 14;

  // ── PERIODO ──────────────────────────────────────────────────
  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('PERIODO', 50, y);
  y += 12;
  const startLabel = `Inicio: ${FECHA(project.first_entry_date || project.created_at)}`;
  const endLabel   = endDate ? `Fin: ${FECHA(endDate)}` : 'Estado: En curso';
  doc.fillColor(BLACK).fontSize(10).font('Helvetica')
     .text(startLabel, 50, y, { continued: true })
     .text(`    ${endLabel}`, { continued: false });
  y += 24;

  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 14;

  // ── RESUMEN FINANCIERO ───────────────────────────────────────
  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('RESUMEN FINANCIERO', 50, y);
  y += 14;

  const summaryRow = (label, value, bold = false, color = BLACK) => {
    doc.fillColor(bold ? BLACK : GRAY).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(label, 50, y, { width: 250 });
    doc.fillColor(color).fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(value, 300, y, { width: 245, align: 'right' });
    y += 14;
  };

  summaryRow(`Total horas trabajadas`, HRS(project.total_hours));
  summaryRow(`Tarifa media`, `${EUR(avgRate)}/h`);
  y += 4;
  summaryRow('Base imponible', EUR(gross));
  summaryRow(`IVA (${PCT(ivaRate)})`, `+ ${EUR(ivaAmt)}`);
  summaryRow(`Retención IRPF (${PCT(irpfRate)})`, `− ${EUR(irpfAmt)}`);
  y += 2;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(DARK).lineWidth(1).stroke();
  y += 8;
  summaryRow('TOTAL', EUR(net), true, GOLD);
  y += 10;

  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 14;

  // ── DETALLE DE TRABAJOS ──────────────────────────────────────
  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('DETALLE DE TRABAJOS', 50, y);
  y += 14;

  const colDate  = 50;
  const colDesc  = 120;
  const colHrs   = 350;
  const colRate  = 400;
  const colAmt   = 465;

  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
     .text('FECHA',     colDate, y, { width: 65 })
     .text('DESCRIPCIÓN', colDesc, y, { width: 225 })
     .text('H.',        colHrs, y,  { width: 45,  align: 'right' })
     .text('TARIFA',    colRate, y, { width: 60,  align: 'right' })
     .text('IMPORTE',   colAmt,  y, { width: 80,  align: 'right' });
  y += 12;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 8;

  let totalHrs = 0;
  let totalAmt = 0;

  for (const e of entries) {
    const rate   = e.hourly_rate_override ?? project.hourly_rate;
    const amount = e.hours * rate;
    totalHrs += e.hours;
    totalAmt += amount;

    const descHeight = doc.heightOfString(e.description || '—', { width: 225, fontSize: 9 });

    if (y + Math.max(descHeight, 14) + 6 > 760) {
      doc.addPage();
      y = 50;
    }

    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
       .text(FECHA(e.date), colDate, y, { width: 65 });
    doc.fillColor(BLACK).fontSize(9).font('Helvetica')
       .text(e.description || '—', colDesc, y, { width: 225 });
    doc.fillColor(GRAY).fontSize(9).font('Helvetica')
       .text(e.hours % 1 === 0 ? String(e.hours) : e.hours.toFixed(2), colHrs, y, { width: 45, align: 'right' })
       .text(EUR(rate), colRate, y, { width: 60, align: 'right' });
    doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold')
       .text(EUR(amount), colAmt, y, { width: 80, align: 'right' });

    y += Math.max(descHeight, 14) + 6;
  }

  y += 4;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(DARK).lineWidth(0.8).stroke();
  y += 8;

  doc.fillColor(GRAY).fontSize(9).font('Helvetica-Bold')
     .text('TOTALES', colDate, y, { width: 295 })
     .text(HRS(totalHrs), colHrs, y, { width: 45, align: 'right' });
  doc.fillColor(GOLD).fontSize(9).font('Helvetica-Bold')
     .text(EUR(totalAmt), colAmt, y, { width: 80, align: 'right' });
  y += 20;

  // ── NOTAS ────────────────────────────────────────────────────
  if (project.notes) {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
    y += 12;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('NOTAS:', 50, y);
    y += 12;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(project.notes, 50, y, { width: W });
  }

  doc.end();
}

module.exports = { generateProjectReportPdf };
