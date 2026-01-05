const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('fmt', (n) => {
  const x = Number(n);
  return Number.isFinite(x)
    ? x.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : (n ?? '');
});

Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

Handlebars.registerHelper('uppercase', (str) => {
  return str ? str.toUpperCase() : '';
});

Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
  switch (operator) {
    case '==':
      return (v1 == v2) ? options.fn(this) : options.inverse(this);
    case '===':
      return (v1 === v2) ? options.fn(this) : options.inverse(this);
    case '!=':
      return (v1 != v2) ? options.fn(this) : options.inverse(this);
    case '!==':
      return (v1 !== v2) ? options.fn(this) : options.inverse(this);
    case '<':
      return (v1 < v2) ? options.fn(this) : options.inverse(this);
    case '<=':
      return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    case '>':
      return (v1 > v2) ? options.fn(this) : options.inverse(this);
    case '>=':
      return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
});

// Cache compiled template
let compiledTemplate = null;

/**
 * Render invoice template with data
 * @param {Object} data - Invoice data
 * @returns {string} - Rendered HTML
 */
const renderTemplate = (data) => {
  if (!compiledTemplate) {
    const templatePath = path.join(__dirname, '../templates/invoice.html');
    const rawTemplate = fs.readFileSync(templatePath, 'utf8');
    compiledTemplate = Handlebars.compile(rawTemplate);
  }

  return compiledTemplate(data);
};

module.exports = renderTemplate;
