// Get Stripe key from environment variable
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'your-stripe-secret-key-here');

async function createProducts() {
  console.log('🚀 Creating InkWell subscription products in Stripe...\n');
  
  try {
    // Create InkWell Plus product
    console.log('Creating InkWell Plus product...');
    const plusProduct = await stripe.products.create({
      name: 'InkWell Plus',
      description: 'Unlimited AI-powered journal prompts, SMS notifications, and data export',
      metadata: {
        tier: 'plus'
      }
    });
    console.log(`✅ Product created: ${plusProduct.id}`);
    
    // Create Plus price ($6.99/month)
    const plusPrice = await stripe.prices.create({
      product: plusProduct.id,
      unit_amount: 699, // $6.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        tier: 'plus'
      }
    });
    console.log(`✅ Plus Price created: ${plusPrice.id} - $6.99/month\n`);
    
    // Create InkWell Connect product
    console.log('Creating InkWell Connect product...');
    const connectProduct = await stripe.products.create({
      name: 'InkWell Connect',
      description: 'Everything in Plus + practitioner connections with 4 included interactions per month',
      metadata: {
        tier: 'connect'
      }
    });
    console.log(`✅ Product created: ${connectProduct.id}`);
    
    // Create Connect price ($29.99/month)
    const connectPrice = await stripe.prices.create({
      product: connectProduct.id,
      unit_amount: 2999, // $29.99 in cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        tier: 'connect'
      }
    });
    console.log(`✅ Connect Price created: ${connectPrice.id} - $29.99/month\n`);
    
    // Print summary for config file
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 UPDATE YOUR subscription-config.js WITH THESE PRICE IDs:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('PLUS:');
    console.log(`  priceId: '${plusPrice.id}',\n`);
    console.log('CONNECT:');
    console.log(`  priceId: '${connectPrice.id}',\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error('Details:', error.raw);
    }
  }
}

createProducts();
