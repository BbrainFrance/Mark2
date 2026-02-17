const fs = require('fs');
const path = require('path');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// =====================================================================
// OUTIL 1 : generate_document (HTML complet -> fichier HTML servi)
// =====================================================================

const generateDocumentDefinition = {
  name: 'generate_document',
  description:
    'Genere un document web (HTML) riche et professionnel, sauvegarde sur le serveur. ' +
    'Retourne une URL de telechargement/consultation. ' +
    'Tu peux creer des presentations, rapports, dashboards, landing pages, etc. ' +
    'Le HTML doit etre COMPLET (<!DOCTYPE html> avec <head>, <style> inline, <body>). ' +
    'Tu peux utiliser Google Fonts, Chart.js (via CDN), Font Awesome, des gradients, ' +
    'des tableaux, des grilles CSS, animations, etc. ' +
    'Fais des designs modernes et professionnels dignes d\'une agence. ' +
    'IMPORTANT: tout le CSS doit etre inline dans une balise <style>, pas de fichiers externes sauf CDN publics.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Nom du fichier (sans extension), ex: "rapport-seo-paybrain"',
      },
      html: {
        type: 'string',
        description:
          'Code HTML complet du document. Doit commencer par <!DOCTYPE html> et inclure ' +
          'tout le CSS dans une balise <style>. Utilise des CDN pour les libs externes ' +
          '(Chart.js, Font Awesome, Google Fonts). Fais un design moderne, pro et soigne.',
      },
      format: {
        type: 'string',
        description: 'Format de sortie: "html" (page web consultable) ou "pdf" (converti en PDF via navigateur). Defaut: "html".',
        enum: ['html', 'pdf'],
      },
    },
    required: ['filename', 'html'],
  },
};

async function generateDocumentExecute(input) {
  const { filename, html, format } = input;
  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const baseUrl = process.env.MARK2_PUBLIC_URL || `http://localhost:${process.env.PORT || 3456}`;

  // Toujours sauvegarder le HTML
  const htmlFilename = `${safeName}_${timestamp}.html`;
  const htmlPath = path.join(DOWNLOADS_DIR, htmlFilename);

  try {
    fs.writeFileSync(htmlPath, html, 'utf-8');
  } catch (err) {
    return `Erreur ecriture HTML: ${err.message}`;
  }

  const htmlUrl = `${baseUrl}/downloads/${htmlFilename}`;

  // Si format PDF demande, convertir via Puppeteer
  if (format === 'pdf') {
    try {
      const puppeteer = require('puppeteer');
      const pdfFilename = `${safeName}_${timestamp}.pdf`;
      const pdfPath = path.join(DOWNLOADS_DIR, pdfFilename);

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      await browser.close();

      const pdfUrl = `${baseUrl}/downloads/${pdfFilename}`;
      return (
        `Document genere avec succes !\n` +
        `Version HTML: ${htmlUrl}\n` +
        `Version PDF: ${pdfUrl}`
      );
    } catch (err) {
      // Puppeteer pas installe ou erreur -> retourner juste le HTML
      return (
        `Document HTML genere avec succes !\n` +
        `Consultation: ${htmlUrl}\n` +
        `(Conversion PDF non disponible: ${err.message})`
      );
    }
  }

  return (
    `Document genere avec succes !\n` +
    `Consultation: ${htmlUrl}`
  );
}

// =====================================================================
// OUTIL 2 : generate_pdf (texte structure -> PDF simple via pdfkit)
// Garde comme fallback pour les PDF simples sans HTML
// =====================================================================

const generatePdfDefinition = {
  name: 'generate_pdf',
  description:
    'Genere un PDF simple a partir de texte structure. Pour des documents riches ' +
    '(tableaux, graphiques, design avance), utilise plutot generate_document. ' +
    'Cet outil est adapte pour des rapports textuels rapides.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Nom du fichier PDF (sans extension)',
      },
      title: {
        type: 'string',
        description: 'Titre principal du document',
      },
      content: {
        type: 'string',
        description:
          'Contenu en texte structure. "## " pour titres, "### " pour sous-titres, ' +
          '"- " pour listes, texte normal pour paragraphes.',
      },
      author: {
        type: 'string',
        description: 'Auteur du document (optionnel)',
      },
    },
    required: ['filename', 'title', 'content'],
  },
};

function generatePdfExecute(input) {
  return new Promise((resolve) => {
    const { filename, title, content, author } = input;

    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      return resolve(
        'pdfkit non installe. Utilise l\'outil generate_document a la place pour creer un document HTML riche.'
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const pdfFilename = `${safeName}_${timestamp}.pdf`;
    const filePath = path.join(DOWNLOADS_DIR, pdfFilename);

    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: title,
          Author: author || 'Mark2 / Jarvis',
          Creator: 'Mark2 Engine',
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Titre
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a1a2e')
        .text(title, { align: 'center' });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#3498db').lineWidth(2).stroke();
      doc.moveDown(0.5);

      const dateStr = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      doc.fontSize(10).font('Helvetica').fillColor('#666')
        .text(`${dateStr}${author ? ` — ${author}` : ''}`, { align: 'center' });
      doc.moveDown(1.5);

      const lines = content.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (doc.y > 720) doc.addPage();

        if (!t) { doc.moveDown(0.5); continue; }

        if (t.startsWith('## ')) {
          doc.moveDown(0.8);
          doc.fontSize(16).font('Helvetica-Bold').fillColor('#2c3e50').text(t.substring(3));
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(250, doc.y).strokeColor('#3498db').lineWidth(1).stroke();
          doc.moveDown(0.4);
        } else if (t.startsWith('### ')) {
          doc.moveDown(0.5);
          doc.fontSize(13).font('Helvetica-Bold').fillColor('#34495e').text(t.substring(4));
          doc.moveDown(0.2);
        } else if (t.startsWith('- ') || t.startsWith('• ')) {
          doc.fontSize(11).font('Helvetica').fillColor('#333')
            .text(`  •  ${t.substring(2)}`, { indent: 15 });
          doc.moveDown(0.15);
        } else if (t.startsWith('**') && t.endsWith('**')) {
          doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text(t.slice(2, -2));
          doc.moveDown(0.2);
        } else {
          doc.fontSize(11).font('Helvetica').fillColor('#333')
            .text(t, { align: 'justify', lineGap: 3 });
          doc.moveDown(0.3);
        }
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica').fillColor('#999')
        .text('Document genere par Mark2 / Jarvis', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        const baseUrl = process.env.MARK2_PUBLIC_URL || `http://localhost:${process.env.PORT || 3456}`;
        resolve(
          `PDF genere avec succes !\n` +
          `Fichier: ${pdfFilename}\n` +
          `Telechargement: ${baseUrl}/downloads/${pdfFilename}`
        );
      });
      stream.on('error', (err) => resolve(`Erreur generation PDF: ${err.message}`));
    } catch (err) {
      resolve(`Erreur generation PDF: ${err.message}`);
    }
  });
}

module.exports = {
  generateDocument: { definition: generateDocumentDefinition, execute: generateDocumentExecute },
  generatePdf: { definition: generatePdfDefinition, execute: generatePdfExecute },
};
