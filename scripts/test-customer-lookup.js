// Test customer lookup functionality
const mongoose = require('mongoose');
const { findCustomer, searchCustomers, getAllCustomers, formatCustomerInfo } = require('../utils/customerLookup');
require('dotenv').config();

async function testCustomerLookup() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Get all customers
    console.log('📋 Test 1: Getting recent customers...');
    const recentCustomers = await getAllCustomers(5);
    console.log(`Found ${recentCustomers.length} customers:`);
    recentCustomers.forEach((customer, i) => {
      console.log(`${i + 1}. ${customer.customer} - $${customer.totalAmount} (${customer.totalInvoices} invoices)`);
    });

    if (recentCustomers.length > 0) {
      // Test 2: Find specific customer
      const testCustomer = recentCustomers[0].customer;
      console.log(`\n🔍 Test 2: Finding customer "${testCustomer}"...`);
      const foundCustomer = await findCustomer(testCustomer);
      if (foundCustomer) {
        console.log('✅ Customer found:');
        console.log(formatCustomerInfo(foundCustomer));
      } else {
        console.log('❌ Customer not found');
      }

      // Test 3: Search customers
      const searchTerm = testCustomer.substring(0, 3);
      console.log(`\n🔎 Test 3: Searching for customers containing "${searchTerm}"...`);
      const searchResults = await searchCustomers(searchTerm, 3);
      console.log(`Found ${searchResults.length} matches:`);
      searchResults.forEach((match, i) => {
        console.log(`${i + 1}. ${match.customer} - $${match.totalAmount}`);
      });
    }

    // Test 4: Test fuzzy search
    console.log(`\n🎯 Test 4: Testing fuzzy search with partial name...`);
    if (recentCustomers.length > 0) {
      const partialName = recentCustomers[0].customer.substring(0, 4);
      const fuzzyResult = await findCustomer(partialName);
      if (fuzzyResult) {
        console.log(`✅ Fuzzy search found: ${fuzzyResult.customer}`);
        console.log(`   Suggested amount: $${fuzzyResult.suggestedAmount || 'N/A'}`);
        console.log(`   Recent amounts: ${fuzzyResult.recentAmounts?.map(r => `$${r.amount}`).join(', ') || 'N/A'}`);
      } else {
        console.log('❌ Fuzzy search found no matches');
      }
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔐 Disconnected from MongoDB');
  }
}

// Run the tests
testCustomerLookup();