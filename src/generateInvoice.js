// src/generateInvoice.js
const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const renderTemplate = require('../utils/renderTemplate');
require('dotenv').config();

module.exports = async function generateInvoice(invoiceData){
  try{
    let html = await Promise.resolve(renderTemplate(invoiceData));
    if (typeof html !== 'string') {
      console.error('❌ renderTemplate did not return string. typeof =', typeof html);
      html = String(html);
    }

    const debugDir = path.join(__dirname, '../invoices/.debug');
    await fs.ensureDir(debugDir);
    await fs.writeFile(path.join(debugDir, `${invoiceData.invoiceNumber}.html`), html);

    const invoiceName = `${invoiceData.invoiceNumber}.jpg`;
    const invoicesDir = process.env.INVOICE_DIR
      ? path.resolve(process.env.INVOICE_DIR)
      : path.join(__dirname, '../invoices');
    await fs.ensureDir(invoicesDir);
    const imagePath = path.join(invoicesDir, invoiceName);

    const browser = await puppeteer.launch({ headless: true /*, args:['--no-sandbox']*/ });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    // Set viewport size for consistent image dimensions
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 }); // A4 size at 150 DPI

    // Take screenshot instead of generating PDF
    await page.screenshot({
      path: imagePath,
      format: 'jpeg',
      quality: 90,
      fullPage: true,
      printBackground: true
    });
    await browser.close();

    console.log(`✅ Invoice saved: ${imagePath}`);
    return imagePath;
  }catch(err){
    console.error('❌ Failed to generate invoice:', err.message);
    return null;
  }
};
