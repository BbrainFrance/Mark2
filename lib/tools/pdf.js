const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');

// Creer le dossier downloads s'il n'existe pas
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

const definition = {
  name: 'generate_pdf',
  description:
    'Genere un fichier PDF professionnel a partir de contenu texte structure. ' +
    'Le PDF est sauvegarde et une URL de telechargement est retournee. ' +
    'Utilise des sections separees par "## " pour les titres de section, ' +
    'et "### " pour les sous-titres. Le texte normal est mis en paragraphes.',
  input_schema: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Nom du fichier PDF (sans extension), ex: "rapport-seo"',
      },
      title: {
        type: 'string',
        description: 'Titre principal du document',
      },
      content: {
        type: 'string',
        description:
          'Contenu du PDF en texte structure. Utilise "## " pour les titres de section, ' +
          '"### " pour les sous-titres, "- " pour les listes a puces, ' +
          'et du texte normal pour les paragraphes. Separe les sections par des lignes vides.',
      },
      author: {
        type: 'string',
        description: 'Auteur du document (optionnel)',
      },
    },
    required: ['filename', 'title', 'content'],
  },
};

function execute(input, context = {}) {
  return new Promise((resolve, reject) => {
    const { filename, title, content, author } = input;

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

      // Titre principal
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#1a1a2e')
        .text(title, { align: 'center' });

      doc.moveDown(0.3);

      // Ligne de separation
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#3498db')
        .lineWidth(2)
        .stroke();

      doc.moveDown(0.5);

      // Meta (date + auteur)
      const dateStr = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666')
        .text(`${dateStr}${author ? ` — ${author}` : ''}`, { align: 'center' });

      doc.moveDown(1.5);

      // Parser le contenu ligne par ligne
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Saut de page si on depasse
        if (doc.y > 720) {
          doc.addPage();
        }

        if (!trimmed) {
          doc.moveDown(0.5);
          continue;
        }

        if (trimmed.startsWith('## ')) {
          // Titre de section
          doc.moveDown(0.8);
          doc
            .fontSize(16)
            .font('Helvetica-Bold')
            .fillColor('#2c3e50')
            .text(trimmed.substring(3));
          doc.moveDown(0.3);
          // Petite ligne sous le titre
          doc
            .moveTo(50, doc.y)
            .lineTo(250, doc.y)
            .strokeColor('#3498db')
            .lineWidth(1)
            .stroke();
          doc.moveDown(0.4);
        } else if (trimmed.startsWith('### ')) {
          // Sous-titre
          doc.moveDown(0.5);
          doc
            .fontSize(13)
            .font('Helvetica-Bold')
            .fillColor('#34495e')
            .text(trimmed.substring(4));
          doc.moveDown(0.2);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          // Liste a puces
          const bulletText = trimmed.substring(2);
          doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#333')
            .text(`  •  ${bulletText}`, { indent: 15 });
          doc.moveDown(0.15);
        } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          // Texte en gras
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#333')
            .text(trimmed.slice(2, -2));
          doc.moveDown(0.2);
        } else {
          // Paragraphe normal
          doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#333')
            .text(trimmed, { align: 'justify', lineGap: 3 });
          doc.moveDown(0.3);
        }
      }

      // Footer
      doc.moveDown(2);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#ccc')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999')
        .text('Document genere par Mark2 / Jarvis', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        const baseUrl = process.env.MARK2_PUBLIC_URL || `http://localhost:${process.env.PORT || 3456}`;
        const downloadUrl = `${baseUrl}/downloads/${pdfFilename}`;
        resolve(
          `PDF genere avec succes !\n` +
          `Fichier: ${pdfFilename}\n` +
          `Telechargement: ${downloadUrl}`
        );
      });

      stream.on('error', (err) => {
        resolve(`Erreur generation PDF: ${err.message}`);
      });
    } catch (err) {
      resolve(`Erreur generation PDF: ${err.message}`);
    }
  });
}

module.exports = { definition, execute };
