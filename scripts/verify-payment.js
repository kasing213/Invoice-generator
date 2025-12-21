const mongoose = require('mongoose');
const { verifyPayment, verifyPaymentWithTolerance, getInvoicesByChatId } = require('../utils/paymentVerification');
require('dotenv').config();

/**
 * Test script for payment verification
 * Usage: node scripts/verify-payment.js <chatId> <amount>
 */

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.length < 1) {
      console.log('Usage:');
      console.log('  node scripts/verify-payment.js <chatId> [amount]');
      console.log('  node scripts/verify-payment.js <chatId> list');
      console.log('\nExamples:');
      console.log('  node scripts/verify-payment.js 123456789 100');
      console.log('  node scripts/verify-payment.js 123456789 list');
      process.exit(1);
    }

    const chatId = parseInt(args[0]);
    const secondArg = args[1];

    if (!chatId || isNaN(chatId)) {
      console.error('❌ Invalid chat ID');
      process.exit(1);
    }

    // List all invoices for this chatId
    if (secondArg === 'list') {
      console.log(`📋 Fetching all invoices for Chat ID: ${chatId}\n`);
      const result = await getInvoicesByChatId(chatId);

      if (result.found) {
        console.log('📊 Summary:');
        console.log(`   Total invoices: ${result.summary.total}`);
        console.log(`   ✅ Paid: ${result.summary.paid} ($${result.summary.paidAmount})`);
        console.log(`   ❌ Unpaid: ${result.summary.unpaid}`);
        console.log(`   ⏳ Pending: ${result.summary.pending}`);
        console.log(`   💰 Total amount: $${result.summary.totalAmount}\n`);

        console.log('📋 Invoices:');
        result.invoices.forEach((inv, index) => {
          const statusIcon = inv.status === 'paid' ? '✅' : inv.status === 'pending' ? '⏳' : '❌';
          console.log(`\n${index + 1}. ${statusIcon} ${inv.status.toUpperCase()}`);
          console.log(`   Customer: ${inv.customer}`);
          console.log(`   Amount: $${inv.amount}`);
          console.log(`   Created: ${new Date(inv.createdAt).toLocaleString()}`);
          console.log(`   Invoice ID: ${inv.id}`);
        });
      } else {
        console.log(result.message);
      }

    } else if (secondArg) {
      // Verify specific amount
      const amount = parseFloat(secondArg);

      if (isNaN(amount)) {
        console.error('❌ Invalid amount');
        process.exit(1);
      }

      console.log(`🔍 Verifying payment for:`);
      console.log(`   Chat ID: ${chatId}`);
      console.log(`   Amount: $${amount}\n`);

      // Exact match verification
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('EXACT MATCH VERIFICATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const exactResult = await verifyPayment(chatId, amount);

      console.log(`\n${exactResult.message}\n`);

      if (exactResult.found) {
        const inv = exactResult.invoice;
        console.log('📄 Invoice Details:');
        console.log(`   Customer: ${inv.customer}`);
        console.log(`   Username: ${inv.username}`);
        console.log(`   Amount: $${inv.amount}`);
        console.log(`   Status: ${inv.status}`);
        console.log(`   Due Date: ${inv.dueDate}`);
        console.log(`   Created: ${new Date(inv.createdAt).toLocaleString()}`);
        console.log(`   Invoice ID: ${inv.id}`);

        if (exactResult.totalMatches > 1) {
          console.log(`\n⚠️  Note: Found ${exactResult.totalMatches} invoices with same amount`);
          console.log('   Other matches:');
          exactResult.allMatches.slice(1).forEach((match, i) => {
            console.log(`   ${i + 2}. ${match.customer} - ${match.status} (${new Date(match.createdAt).toLocaleDateString()})`);
          });
        }
      }

      // Tolerance-based verification
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('TOLERANCE-BASED VERIFICATION (±$0.50)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const toleranceResult = await verifyPaymentWithTolerance(chatId, amount, 0.50);

      console.log(`\n${toleranceResult.message}\n`);

      if (toleranceResult.found) {
        const inv = toleranceResult.invoice;
        console.log('📄 Invoice Details:');
        console.log(`   Customer: ${inv.customer}`);
        console.log(`   Invoice Amount: $${inv.amount}`);
        console.log(`   Expected Amount: $${inv.expectedAmount}`);
        console.log(`   Difference: $${inv.difference.toFixed(2)}`);
        console.log(`   Status: ${inv.status}`);

        if (inv.difference > 0.01) {
          if (inv.amount < inv.expectedAmount) {
            console.log(`   ⚠️  Paid ${((inv.amount / inv.expectedAmount) * 100).toFixed(1)}% of expected amount`);
          } else {
            console.log(`   ℹ️  Overpaid by $${inv.difference.toFixed(2)}`);
          }
        }
      }

    } else {
      console.error('❌ Please provide an amount or use "list"');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

main();
