/**
 * Format invoice data for template rendering
 */
const formatInvoiceForTemplate = (invoice) => {
  return {
    invoiceNumber: invoice.invoiceNumber,
    client: {
      name: invoice.client?.name || '',
      email: invoice.client?.email || '',
      phone: invoice.client?.phone || '',
      address: invoice.client?.address || ''
    },
    items: (invoice.items || []).map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total || (item.quantity * item.unitPrice)
    })),
    subtotal: invoice.subtotal || 0,
    tax: invoice.tax || 0,
    taxRate: invoice.taxRate || 0,
    discount: invoice.discount || 0,
    discountRate: invoice.discountRate || 0,
    grandTotal: invoice.grandTotal || 0,
    status: invoice.status || 'draft',
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes || '',
    currency: invoice.currency || 'USD',
    // Payment verification fields
    bank: invoice.bank || '',
    expectedAccount: invoice.expectedAccount || '',
    verificationStatus: invoice.verificationStatus || 'pending',
    verifiedAt: invoice.verifiedAt,
    verifiedBy: invoice.verifiedBy || '',
    verificationNote: invoice.verificationNote || ''
  };
};

/**
 * Format invoice data for Excel/CSV export
 */
const formatInvoiceForExport = (invoice) => {
  // Flatten items into a single string for export
  const itemsDescription = (invoice.items || [])
    .map(item => `${item.description} (${item.quantity} x ${item.unitPrice})`)
    .join('; ');

  return {
    'Invoice Number': invoice.invoiceNumber || '',
    'Client Name': invoice.client?.name || '',
    'Client Email': invoice.client?.email || '',
    'Client Phone': invoice.client?.phone || '',
    'Client Address': invoice.client?.address || '',
    'Items': itemsDescription,
    'Status': invoice.status || 'draft',
    'Subtotal': invoice.subtotal || 0,
    'Tax Rate (%)': invoice.taxRate || 0,
    'Tax': invoice.tax || 0,
    'Discount Rate (%)': invoice.discountRate || 0,
    'Discount': invoice.discount || 0,
    'Grand Total': invoice.grandTotal || 0,
    'Currency': invoice.currency || 'USD',
    'Bank': invoice.bank || '',
    'Expected Account': invoice.expectedAccount || '',
    'Verification Status': invoice.verificationStatus || 'pending',
    'Verified At': invoice.verifiedAt ? new Date(invoice.verifiedAt).toISOString().split('T')[0] : '',
    'Verified By': invoice.verifiedBy || '',
    'Created Date': invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : '',
    'Due Date': invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '',
    'Paid Date': invoice.paidAt ? new Date(invoice.paidAt).toISOString().split('T')[0] : '',
    'Notes': invoice.notes || '',
    'External Ref': invoice.externalRef || ''
  };
};

/**
 * Format currency for display
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

module.exports = {
  formatInvoiceForTemplate,
  formatInvoiceForExport,
  formatCurrency,
  formatDate
};
