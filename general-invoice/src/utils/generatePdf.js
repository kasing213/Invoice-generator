const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const renderTemplate = require('./renderTemplate');

/**
 * Generate PDF from invoice data
 * @param {Object} invoiceData - Formatted invoice data
 * @param {Object} options - Generation options
 * @returns {Promise<string>} - Path to generated PDF file
 */
const generatePdf = async (invoiceData, options = {}) => {
  const { format = 'pdf', quality = 90 } = options;

  let browser = null;

  try {
    // Render HTML from template
    const html = renderTemplate(invoiceData);

    // Ensure output directory exists
    const invoicesDir = process.env.INVOICE_DIR || path.join(__dirname, '../../invoices');
    await fs.ensureDir(invoicesDir);

    // Generate filename
    const extension = format === 'pdf' ? 'pdf' : 'jpg';
    const filename = `${invoiceData.invoiceNumber}.${extension}`;
    const outputPath = path.join(invoicesDir, filename);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.emulateMediaType('screen');

    if (format === 'pdf') {
      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px'
        }
      });
    } else {
      // Generate screenshot/image
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 2
      });

      await page.screenshot({
        path: outputPath,
        type: 'jpeg',
        quality,
        fullPage: true
      });
    }

    await browser.close();
    browser = null;

    return outputPath;

  } catch (error) {
    console.error('PDF generation failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = generatePdf;
