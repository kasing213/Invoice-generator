// Customer lookup and data mapping utilities
const Invoice = require('../models/invoice');

/**
 * Find customer by name (fuzzy search)
 * @param {string} customerName - Name to search for
 * @returns {Object} Customer data with history
 */
async function findCustomer(customerName) {
  try {
    // Exact match first
    let customer = await getCustomerStats(customerName);
    if (customer) return customer;

    // Fuzzy search - case insensitive partial matches
    const fuzzyMatches = await Invoice.aggregate([
      {
        $match: {
          customer: { $regex: new RegExp(customerName, 'i') },
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    if (fuzzyMatches.length > 0) {
      // Return stats for the most frequent match
      return await getCustomerStats(fuzzyMatches[0]._id);
    }

    return null;
  } catch (error) {
    console.error('❌ Customer lookup error:', error);
    return null;
  }
}

/**
 * Get detailed customer statistics
 * @param {string} customerName - Exact customer name
 * @returns {Object} Customer stats and history
 */
async function getCustomerStats(customerName) {
  try {
    const stats = await Invoice.aggregate([
      {
        $match: {
          customer: customerName,
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          lastAmount: { $last: '$amount' },
          firstInvoice: { $min: '$createdAt' },
          lastInvoice: { $max: '$createdAt' },
          chatId: { $first: '$chatId' },
          username: { $first: '$username' },
          groupName: { $first: '$groupName' },
          recentAmounts: { $push: '$amount' } // Last amounts for pattern detection
        }
      }
    ]);

    if (stats.length === 0) return null;

    const customerData = stats[0];

    // Get last 5 invoice amounts for pattern analysis
    const recentInvoices = await Invoice.find({
      customer: customerName,
      status: { $ne: 'registered' },
      amount: { $gt: 0 }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('amount createdAt');

    return {
      customer: customerData._id,
      totalInvoices: customerData.totalInvoices,
      totalAmount: parseFloat(customerData.totalAmount.toFixed(2)),
      avgAmount: parseFloat(customerData.avgAmount.toFixed(2)),
      minAmount: parseFloat(customerData.minAmount.toFixed(2)),
      maxAmount: parseFloat(customerData.maxAmount.toFixed(2)),
      lastAmount: parseFloat(customerData.lastAmount.toFixed(2)),
      firstInvoice: customerData.firstInvoice,
      lastInvoice: customerData.lastInvoice,
      daysSinceLastInvoice: Math.floor((new Date() - customerData.lastInvoice) / (1000 * 60 * 60 * 24)),
      chatId: customerData.chatId,
      username: customerData.username,
      groupName: customerData.groupName,
      recentAmounts: recentInvoices.map(inv => ({
        amount: parseFloat(inv.amount.toFixed(2)),
        date: inv.createdAt.toISOString().split('T')[0]
      })),
      // Suggest next amount based on patterns
      suggestedAmount: getSuggestedAmount(recentInvoices.map(inv => inv.amount))
    };
  } catch (error) {
    console.error('❌ Customer stats error:', error);
    return null;
  }
}

/**
 * Get suggested amount based on customer history
 * @param {number[]} amounts - Array of recent amounts
 * @returns {number} Suggested amount
 */
function getSuggestedAmount(amounts) {
  if (!amounts || amounts.length === 0) return null;

  // If only one amount, suggest the same
  if (amounts.length === 1) return parseFloat(amounts[0].toFixed(2));

  // Check if amounts are consistent (same amount repeatedly)
  const uniqueAmounts = [...new Set(amounts.map(a => parseFloat(a.toFixed(2))))];
  if (uniqueAmounts.length === 1) {
    return uniqueAmounts[0]; // Customer always uses same amount
  }

  // If multiple amounts, suggest the most recent one
  return parseFloat(amounts[0].toFixed(2));
}

/**
 * Search for customers with similar names
 * @param {string} searchTerm - Search term
 * @param {number} limit - Max results to return
 * @returns {Array} Array of matching customers
 */
async function searchCustomers(searchTerm, limit = 10) {
  try {
    const matches = await Invoice.aggregate([
      {
        $match: {
          customer: { $regex: new RegExp(searchTerm, 'i') },
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          lastInvoice: { $max: '$createdAt' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return matches.map(match => ({
      customer: match._id,
      totalInvoices: match.totalInvoices,
      totalAmount: parseFloat(match.totalAmount.toFixed(2)),
      lastInvoice: match.lastInvoice.toISOString().split('T')[0],
      daysSinceLastInvoice: Math.floor((new Date() - match.lastInvoice) / (1000 * 60 * 60 * 24))
    }));
  } catch (error) {
    console.error('❌ Customer search error:', error);
    return [];
  }
}

/**
 * Get all customers with their basic stats
 * @param {number} limit - Max customers to return
 * @returns {Array} Array of all customers
 */
async function getAllCustomers(limit = 100) {
  try {
    const customers = await Invoice.aggregate([
      {
        $match: {
          status: { $ne: 'registered' },
          amount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          lastInvoice: { $max: '$createdAt' },
          lastAmount: { $last: '$amount' }
        }
      },
      {
        $sort: { lastInvoice: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return customers.map(customer => ({
      customer: customer._id,
      totalInvoices: customer.totalInvoices,
      totalAmount: parseFloat(customer.totalAmount.toFixed(2)),
      avgAmount: parseFloat(customer.avgAmount.toFixed(2)),
      lastAmount: parseFloat(customer.lastAmount.toFixed(2)),
      lastInvoice: customer.lastInvoice.toISOString().split('T')[0],
      daysSinceLastInvoice: Math.floor((new Date() - customer.lastInvoice) / (1000 * 60 * 60 * 24))
    }));
  } catch (error) {
    console.error('❌ Get all customers error:', error);
    return [];
  }
}

/**
 * Format customer data for display
 * @param {Object} customerData - Customer data object
 * @returns {string} Formatted string for display
 */
function formatCustomerInfo(customerData) {
  if (!customerData) return '❌ Customer not found';

  const {
    customer,
    totalInvoices,
    totalAmount,
    avgAmount,
    lastAmount,
    daysSinceLastInvoice,
    suggestedAmount,
    recentAmounts
  } = customerData;

  let info = `👤 **${customer}**\n`;
  info += `📊 Total: ${totalInvoices} invoices, $${totalAmount}\n`;
  info += `💰 Average: $${avgAmount} | Last: $${lastAmount}\n`;
  info += `📅 Last invoice: ${daysSinceLastInvoice} days ago\n`;

  if (suggestedAmount) {
    info += `💡 Suggested amount: $${suggestedAmount}\n`;
  }

  if (recentAmounts && recentAmounts.length > 1) {
    info += `📈 Recent: ${recentAmounts.slice(0, 3).map(r => `$${r.amount}`).join(', ')}`;
  }

  return info;
}

module.exports = {
  findCustomer,
  getCustomerStats,
  searchCustomers,
  getAllCustomers,
  formatCustomerInfo,
  getSuggestedAmount
};