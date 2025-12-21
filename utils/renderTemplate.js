const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Helpers used by the template
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('fmt', (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toLocaleString('en-US') : (n ?? '');
});

let compiled;
module.exports = function renderTemplate(data) {
  if (!compiled) {
    // make sure this path points to your uploaded invoice.html
    const templatePath = path.join(__dirname, '../templates/invoice.html');
    const raw = fs.readFileSync(templatePath, 'utf8');
    compiled = Handlebars.compile(raw);
  }
  const html = compiled(data);
  return typeof html === 'string' ? html : String(html);
};
