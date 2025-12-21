const Invoice = require('../models/invoice');

/**
 * Verify payment status by matching chatId and amount
 * @param {Number} chatId - Telegram chat ID
 * @param {Number} amount - Invoice amount
 * @returns {Object} Payment verification result
 */
async function verifyPayment(chatId, amount) {
  try {
    // Find invoices matching both chatId and amount
    const matchingInvoices = await Invoice.find({
      chatId: chatId,
      amount: amount
    }).sort({ createdAt: -1 }); // Sort by newest first

    if (matchingInvoices.length === 0) {
      return {
        found: false,
        status: 'not_found',
        message: `❌ No invoice found for Chat ID: ${chatId} with amount: $${amount}`,
        chatId,
        amount
      };
    }

    // Get the most recent matching invoice
    const latestInvoice = matchingInvoices[0];

    // Determine payment status
    let paymentStatus;
    let statusMessage;

    if (latestInvoice.status === 'paid') {
      paymentStatus = 'paid';
      statusMessage = `✅ PAID - Invoice has been paid`;
    } else if (latestInvoice.status === 'unpaid') {
      paymentStatus = 'unpaid';
      statusMessage = `❌ UNPAID - Payment not received`;
    } else if (latestInvoice.status === 'pending') {
      paymentStatus = 'pending';
      statusMessage = `⏳ PENDING - Payment incomplete or not enough`;
    } else {
      paymentStatus = latestInvoice.status;
      statusMessage = `ℹ️ Status: ${latestInvoice.status}`;
    }

    return {
      found: true,
      status: paymentStatus,
      message: statusMessage,
      invoice: {
        id: latestInvoice._id,
        customer: latestInvoice.customer,
        chatId: latestInvoice.chatId,
        username: latestInvoice.username,
        amount: latestInvoice.amount,
        status: latestInvoice.status,
        dueDate: latestInvoice.dueDate,
        createdAt: latestInvoice.createdAt,
        invoiceNumber: latestInvoice.invoiceNumber
      },
      totalMatches: matchingInvoices.length,
      allMatches: matchingInvoices.map(inv => ({
        id: inv._id,
        customer: inv.customer,
        status: inv.status,
        createdAt: inv.createdAt
      }))
    };

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return {
      found: false,
      status: 'error',
      message: `❌ Error checking payment: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Verify payment with tolerance for amount differences
 * Useful for checking partial payments
 * @param {Number} chatId - Telegram chat ID
 * @param {Number} expectedAmount - Expected invoice amount
 * @param {Number} tolerance - Acceptable difference (default 0.01)
 * @returns {Object} Payment verification result
 */
async function verifyPaymentWithTolerance(chatId, expectedAmount, tolerance = 0.01) {
  try {
    const minAmount = expectedAmount - tolerance;
    const maxAmount = expectedAmount + tolerance;

    const matchingInvoices = await Invoice.find({
      chatId: chatId,
      amount: { $gte: minAmount, $lte: maxAmount }
    }).sort({ createdAt: -1 });

    if (matchingInvoices.length === 0) {
      return {
        found: false,
        status: 'not_found',
        message: `❌ No invoice found for Chat ID: ${chatId} with amount near $${expectedAmount}`,
        chatId,
        expectedAmount
      };
    }

    const latestInvoice = matchingInvoices[0];
    const amountDiff = Math.abs(latestInvoice.amount - expectedAmount);

    let paymentStatus;
    if (latestInvoice.status === 'paid') {
      paymentStatus = 'paid';
    } else if (amountDiff > tolerance && latestInvoice.amount < expectedAmount) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = latestInvoice.status;
    }

    return {
      found: true,
      status: paymentStatus,
      message: `Invoice found - Status: ${paymentStatus}`,
      invoice: {
        id: latestInvoice._id,
        customer: latestInvoice.customer,
        chatId: latestInvoice.chatId,
        amount: latestInvoice.amount,
        expectedAmount: expectedAmount,
        difference: amountDiff,
        status: latestInvoice.status
      },
      totalMatches: matchingInvoices.length
    };

  } catch (error) {
    console.error('❌ Error verifying payment with tolerance:', error);
    return {
      found: false,
      status: 'error',
      message: `❌ Error: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Get all invoices for a specific chatId
 * @param {Number} chatId - Telegram chat ID
 * @returns {Object} All invoices and summary
 */
async function getInvoicesByChatId(chatId) {
  try {
    const invoices = await Invoice.find({ chatId }).sort({ createdAt: -1 });

    if (invoices.length === 0) {
      return {
        found: false,
        message: `❌ No invoices found for Chat ID: ${chatId}`,
        chatId
      };
    }

    const summary = {
      total: invoices.length,
      paid: invoices.filter(inv => inv.status === 'paid').length,
      unpaid: invoices.filter(inv => inv.status === 'unpaid').length,
      pending: invoices.filter(inv => inv.status === 'pending').length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      paidAmount: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
    };

    return {
      found: true,
      chatId,
      summary,
      invoices: invoices.map(inv => ({
        id: inv._id,
        customer: inv.customer,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt
      }))
    };

  } catch (error) {
    console.error('❌ Error getting invoices:', error);
    return {
      found: false,
      message: `❌ Error: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  verifyPayment,
  verifyPaymentWithTolerance,
  getInvoicesByChatId
};
