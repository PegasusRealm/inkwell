// Get Stripe key from environment variable
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'your-stripe-secret-key-here');

async function checkStripeProducts() {
  console.log('🔍 Checking Stripe products and prices...\n');
  
  try {
    // List all products
    const products = await stripe.products.list({ limit: 100 });
    
    console.log(`Found ${products.data.length} products:\n`);
    
    for (const product of products.data) {
      console.log(`📦 Product: ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Active: ${product.active}`);
      
      // Get prices for this product
      const prices = await stripe.prices.list({ 
        product: product.id,
        limit: 10
      });
      
      if (prices.data.length > 0) {
        console.log(`   💰 Prices:`);
        for (const price of prices.data) {
          const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : 'Free';
          const interval = price.recurring ? `/${price.recurring.interval}` : '';
          console.log(`      - ${price.id}: ${amount}${interval} (${price.active ? 'active' : 'inactive'})`);
        }
      }
      console.log('');
    }
    
    // Also list all prices directly
    console.log('\n📊 All prices in account:');
    const allPrices = await stripe.prices.list({ limit: 100 });
    for (const price of allPrices.data) {
      const amount = price.unit_amount ? `$${(price.unit_amount / 100).toFixed(2)}` : 'Free';
      const interval = price.recurring ? `/${price.recurring.interval}` : '';
      console.log(`   ${price.id}: ${amount}${interval} - Product: ${price.product} (${price.active ? 'active' : 'inactive'})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStripeProducts();
