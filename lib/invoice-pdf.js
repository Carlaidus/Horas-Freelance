const PDFDocument = require('pdfkit');

const EUR    = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const HORAS  = (n) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n || 0) + ' h';
const EURDIA = (n) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n || 0) + ' €/día';
const PCT = (n) => `${parseFloat(n || 0).toFixed(0)}%`;
const FECHA = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function generateInvoicePdf(invoice, lines, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Factura ${invoice.full_number}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.full_number}.pdf"`);
  doc.pipe(res);

  const W = 595 - 100; // usable width
  const DARK = '#1a1a2e';
  const GRAY = '#555580';
  const LGRAY = '#e8e8f0';
  const BLACK = '#111111';
  const GOLD = '#c8a000';

  // ── HEADER ──────────────────────────────────────────────────
  doc.rect(50, 40, W, 60).fill('#06060f');
  doc.fillColor('#f5c842').fontSize(22).font('Helvetica-Bold')
     .text('FACTURA', 65, 58, { continued: true })
     .fillColor('#f5c842').fontSize(13).font('Helvetica')
     .text(`  Nº ${invoice.full_number}`, { baseline: 'middle' });
  doc.fillColor('#9090b8').fontSize(9).font('Helvetica')
     .text(`Fecha de emisión: ${FECHA(invoice.issue_date)}`, 65, 78);
  if (invoice.operation_date && invoice.operation_date !== invoice.issue_date) {
    doc.text(`  ·  Fecha de operación: ${FECHA(invoice.operation_date)}`, { continued: false });
  }

  let y = 120;

  // ── EMISOR / CLIENTE ─────────────────────────────────────────
  const col1 = 50, col2 = 310;
  const blockW = 230;

  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
     .text('EMISOR', col1, y)
     .text('CLIENTE / DESTINATARIO', col2, y);
  y += 14;

  // Emisor
  doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold')
     .text(invoice.issuer_name || '—', col1, y, { width: blockW });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica');
  if (invoice.issuer_nif) doc.text(`NIF: ${invoice.issuer_nif}`, col1, y + 14, { width: blockW });
  const issuerLines = [invoice.issuer_address, [invoice.issuer_postal_code, invoice.issuer_city].filter(Boolean).join(' ')].filter(Boolean);
  issuerLines.forEach((l, i) => doc.text(l, col1, y + 26 + i * 13, { width: blockW }));

  // Cliente
  doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold')
     .text(invoice.customer_name || '—', col2, y, { width: blockW });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica');
  if (invoice.customer_nif) doc.text(`NIF/CIF: ${invoice.customer_nif}`, col2, y + 14, { width: blockW });
  const custLines = [
    invoice.customer_address,
    [invoice.customer_postal_code, invoice.customer_city].filter(Boolean).join(' '),
    invoice.customer_country !== 'España' ? invoice.customer_country : null
  ].filter(Boolean);
  custLines.forEach((l, i) => doc.text(l, col2, y + 26 + i * 13, { width: blockW }));

  y += 70;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 16;

  // ── LÍNEAS ───────────────────────────────────────────────────
  const colDesc = 50, colQty = 330, colPrice = 390, colTotal = 470;
  const isProjectInvoice = lines.some(l => l.project_id != null);
  doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold')
     .text(isProjectInvoice ? 'CONCEPTO / PROYECTO' : 'CONCEPTO', colDesc, y)
     .text(isProjectInvoice ? 'HORAS' : 'CANT.', colQty, y, { width: 55, align: 'right' })
     .text(isProjectInvoice ? 'PRECIO/DÍA' : 'PRECIO', colPrice, y, { width: 70, align: 'right' })
     .text('IMPORTE', colTotal, y, { width: 75, align: 'right' });
  y += 12;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 10;

  lines.forEach((line) => {
    const descHeight = doc.heightOfString(line.description, { width: 270, fontSize: 9 });
    doc.fillColor(BLACK).fontSize(9).font('Helvetica')
       .text(line.description, colDesc, y, { width: 270 });
    if (line.quantity !== 1 || line.unit_price > 0) {
      if (line.project_id != null) {
        doc.text(HORAS(line.quantity), colQty, y, { width: 55, align: 'right' });
        doc.text(EURDIA(line.unit_price * 8), colPrice, y, { width: 70, align: 'right' });
      } else {
        doc.text(
          line.quantity % 1 === 0 ? String(line.quantity) : line.quantity.toFixed(2),
          colQty, y, { width: 55, align: 'right' }
        );
        doc.text(EUR(line.unit_price), colPrice, y, { width: 70, align: 'right' });
      }
    }
    doc.text(EUR(line.line_total), colTotal, y, { width: 75, align: 'right' });
    y += Math.max(descHeight, 14) + 6;

    if (y > 680) {
      doc.addPage();
      y = 50;
    }
  });

  y += 6;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LGRAY).lineWidth(0.5).stroke();
  y += 16;

  // ── TOTALES ──────────────────────────────────────────────────
  const totX = 350, totLabelW = 130, totValueW = 65;

  const totRow = (label, value, bold = false) => {
    doc.fillColor(bold ? BLACK : GRAY).fontSize(9)
       .font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(label, totX, y, { width: totLabelW })
       .text(value, totX + totLabelW, y, { width: totValueW, align: 'right' });
    y += 15;
  };

  totRow('Base imponible', EUR(invoice.subtotal));

  if (invoice.iva_exempt) {
    totRow('IVA (exento)', '0,00 €');
  } else {
    totRow(`IVA (${PCT(invoice.iva_rate)})`, EUR(invoice.iva_amount));
  }

  if (invoice.irpf_rate > 0) {
    totRow(`Retención IRPF (${PCT(invoice.irpf_rate)})`, `- ${EUR(invoice.irpf_amount)}`);
  }

  y += 4;
  doc.moveTo(totX, y).lineTo(545, y).strokeColor(DARK).lineWidth(1).stroke();
  y += 8;
  totRow('TOTAL A PAGAR', EUR(invoice.total), true);

  // ── NOTAS / LEYENDAS ─────────────────────────────────────────
  y += 20;

  if (invoice.iva_exempt) {
    doc.rect(50, y, W, 26).fill('#f0f0f8');
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('Operación exenta de IVA según el artículo 20 de la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido.', 58, y + 9, { width: W - 16 });
    y += 36;
  }

  if (invoice.notes) {
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold').text('NOTAS:', 50, y);
    y += 12;
    doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(invoice.notes, 50, y, { width: W });
  }

  doc.end();
}

module.exports = { generateInvoicePdf };
