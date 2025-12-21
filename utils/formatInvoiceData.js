const fs   = require('fs');
const path = require('path');

const PRICE_PER_UNIT    = Number(process.env.PRICE_PER_UNIT || 2000);
const PROTECT_METER_FEE = 2000; // fixed per your requirement
const SECURITY_FEE      = 14000; // fixed security fee
const DEFAULT_ABA       = process.env.ABA_ACC || '086 228 226';
const DEFAULT_PHONE     = process.env.CONTACT_TEL || '086 22 62 25';
const WIN_QR_PATH       = process.env.QR_IMAGE_PATH
  || path.join(__dirname, '../templates/QR-for-Payment.jpg');

function toNum(x){ if(x===''||x==null) return 0; const n=Number(x); return Number.isFinite(n)?n:0; }
function winToWSLPath(p){
  if(!p) return p;
  if(p.startsWith('/mnt/')) return p;
  const m = p.match(/^([A-Za-z]):\\(.*)$/);
  if(!m) return p.replace(/\\/g,'/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g,'/')}`;
}
function fileToDataURI(abs){
  try{
    if(!abs || !fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime = ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
    const b64  = fs.readFileSync(abs).toString('base64');
    return `data:${mime};base64,${b64}`;
  }catch{ return null; }
}

module.exports = function formatInvoiceData(doc){
  const oldMeter = toNum(doc.oldMeter);
  const newMeter = toNum(doc.newMeter);
  const rawUsage = (doc.usage!==undefined)? toNum(doc.usage) : (newMeter - oldMeter);
  const usage    = Math.max(0, rawUsage);

  const unit           = PRICE_PER_UNIT;
  // Always calculate water amount from usage × unit price (don't trust doc.amount)
  const waterAmount    = (usage || 1) * unit;
  const derivedUnit    = unit;

  const rawNo = doc.invoiceNumber || doc.code || (doc._id && String(doc._id).slice(-6)) || `${Date.now()}`;

  // Only WATER in items[] — the template will render Protect fee separately
  const items = [
    { description: '១. ថ្លៃទឹក', qty: usage || 1, unitPrice: derivedUnit, total: waterAmount }
  ];

  // Grand total = items + protectMeterFee + securityFee
  const protectMeterFee = PROTECT_METER_FEE;
  const securityFee     = SECURITY_FEE;
  const itemsTotal      = items.reduce((s,it)=> s + toNum(it.total), 0);
  const grandTotal      = itemsTotal + protectMeterFee + securityFee;

  const qrImagePath = fileToDataURI(winToWSLPath(WIN_QR_PATH)) || undefined;

  return {
    invoiceNumber: String(rawNo),
    name: doc.customer || doc.name || `ID-${doc.chatId || 'unknown'}`,
    currentDate: new Date().toISOString().slice(0,10),
    oldMeter, newMeter, usage,
    dueDate: new Date().toISOString().slice(0,10),
    aba: DEFAULT_ABA,
    phone: DEFAULT_PHONE,
    status: String(doc.status || 'unpaid'), // used by {{#if (eq status "paid")}}...
    items,
    // provide both fields the HTML expects:
    protectMeterFee,     // so the {{#if protectMeterFee}} row renders
    securityFee,         // so the {{#if securityFee}} row renders
    grandTotal,          // includes protect fee + security fee
    chatId: doc.chatId ?? null,
    notes: { instruction: 'សូមផ្ទេរប្រាក់តាម ABA និងបញ្ចូលលេខវិក្កយបត្រ។' },
    qrImagePath          // template uses <img src="{{qrImagePath}}">
  };
};
