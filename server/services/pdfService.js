const puppeteer = require('puppeteer');

async function generatePdf(htmlContent, orientation = 'landscape') {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
        format: 'Letter',
        landscape: orientation === 'landscape',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();
    return pdf;
}

module.exports = { generatePdf };
