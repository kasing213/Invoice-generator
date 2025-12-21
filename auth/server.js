require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

// Adjust model path if needed
const Invoice = require('../models/invoice');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  promptInvoice();
}).catch(err => {
  console.error('❌ Connection failed:', err);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function promptInvoice() {
  rl.question('Enter customer name: ', (customer) => {
    rl.question('Enter amount: ', (amount) => {
      rl.question('Enter chat ID: ', (chatId) => {
        rl.question('Enter Telegram username (without @): ', (username) => {
          const invoice = new Invoice({
            customer,
            amount: parseFloat(amount),
            chatId,
            username
          });

          invoice.save()
            .then(() => {
              console.log(`✅ Invoice saved for ${customer} ($${amount})\n📦 Chat ID: ${chatId}\n👤 Username: ${username}`);
              rl.close();
              mongoose.connection.close();
            })
            .catch(err => {
              console.error('❌ Failed to save invoice:', err);
              rl.close();
              mongoose.connection.close();
            });
        });
      });
    });
  });
}
