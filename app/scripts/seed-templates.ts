import { query } from '../lib/db/connection'

const sampleTemplates = [
  {
    name: 'E-commerce Product Page',
    description: 'High-converting product page template for e-commerce',
    category: 'ecommerce',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PRODUCT_NAME}} - Premium Quality</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 60px 0; text-align: center; }
        .hero h1 { font-size: 3em; margin: 0 0 20px 0; }
        .hero p { font-size: 1.2em; margin: 0 0 30px 0; }
        .cta-button { background: #ff6b6b; color: white; padding: 15px 40px; border: none; border-radius: 50px; font-size: 1.1em; cursor: pointer; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin: 60px 0; }
        .feature { text-align: center; padding: 30px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .testimonial { background: white; padding: 40px; border-radius: 10px; margin: 40px 0; text-align: center; }
        .testimonial blockquote { font-size: 1.3em; font-style: italic; margin: 0 0 20px 0; }
        .testimonial cite { color: #666; }
    </style>
</head>
<body>
    <div class="hero">
        <div class="container">
            <h1>{{PRODUCT_NAME}}</h1>
            <p>{{PRODUCT_DESCRIPTION}}</p>
            <button class="cta-button">Shop Now - {{PRICE}}</button>
        </div>
    </div>
    
    <div class="container">
        <div class="features">
            <div class="feature">
                <h3>Premium Quality</h3>
                <p>Made with the finest materials and attention to detail</p>
            </div>
            <div class="feature">
                <h3>Fast Shipping</h3>
                <p>Free shipping on orders over $50. Delivered in 2-3 business days</p>
            </div>
            <div class="feature">
                <h3>30-Day Guarantee</h3>
                <p>Not satisfied? Return it within 30 days for a full refund</p>
            </div>
        </div>
        
        <div class="testimonial">
            <blockquote>"This product exceeded my expectations. The quality is outstanding and the customer service is top-notch!"</blockquote>
            <cite>- Sarah M., Verified Customer</cite>
        </div>
    </div>
</body>
</html>`
  },
  {
    name: 'SaaS Landing Page',
    description: 'Professional landing page for SaaS products',
    category: 'saas',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PRODUCT_NAME}} - The Future of {{INDUSTRY}}</title>
    <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .header { background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: fixed; width: 100%; top: 0; z-index: 1000; }
        .nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
        .logo { font-size: 1.5rem; font-weight: bold; color: #2563eb; }
        .nav-links { display: flex; gap: 2rem; }
        .nav-links a { text-decoration: none; color: #374151; }
        .hero { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 120px 0 80px; text-align: center; }
        .hero h1 { font-size: 3.5rem; margin: 0 0 1rem 0; font-weight: 700; }
        .hero p { font-size: 1.25rem; margin: 0 0 2rem 0; opacity: 0.9; }
        .cta-button { background: #10b981; color: white; padding: 1rem 2rem; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer; }
        .features { padding: 80px 0; background: #f9fafb; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; }
        .feature-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .feature-icon { width: 60px; height: 60px; background: #dbeafe; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
        .pricing { padding: 80px 0; text-align: center; }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-top: 3rem; }
        .pricing-card { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 2rem; position: relative; }
        .pricing-card.featured { border-color: #3b82f6; transform: scale(1.05); }
        .price { font-size: 3rem; font-weight: 700; color: #1f2937; margin: 1rem 0; }
        .cta-section { background: #1f2937; color: white; padding: 80px 0; text-align: center; }
    </style>
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="nav">
                <div class="logo">{{PRODUCT_NAME}}</div>
                <div class="nav-links">
                    <a href="#features">Features</a>
                    <a href="#pricing">Pricing</a>
                    <a href="#contact">Contact</a>
                </div>
            </nav>
        </div>
    </header>

    <section class="hero">
        <div class="container">
            <h1>Transform Your {{INDUSTRY}} with {{PRODUCT_NAME}}</h1>
            <p>Join thousands of companies already using our platform to streamline their workflow and boost productivity</p>
            <button class="cta-button">Start Free Trial</button>
        </div>
    </section>

    <section class="features" id="features">
        <div class="container">
            <h2 style="text-align: center; font-size: 2.5rem; margin-bottom: 3rem;">Why Choose {{PRODUCT_NAME}}?</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3>Lightning Fast</h3>
                    <p>Experience blazing-fast performance with our optimized infrastructure</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔒</div>
                    <h3>Secure & Reliable</h3>
                    <p>Enterprise-grade security with 99.9% uptime guarantee</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <h3>Advanced Analytics</h3>
                    <p>Get deep insights into your data with our powerful analytics dashboard</p>
                </div>
            </div>
        </div>
    </section>

    <section class="pricing" id="pricing">
        <div class="container">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem;">Simple, Transparent Pricing</h2>
            <p style="font-size: 1.2rem; color: #6b7280;">Choose the plan that's right for your business</p>
            <div class="pricing-grid">
                <div class="pricing-card">
                    <h3>Starter</h3>
                    <div class="price">$29<small>/mo</small></div>
                    <ul style="list-style: none; padding: 0; text-align: left;">
                        <li>✓ Up to 5 users</li>
                        <li>✓ Basic features</li>
                        <li>✓ Email support</li>
                    </ul>
                    <button class="cta-button" style="width: 100%; margin-top: 2rem;">Get Started</button>
                </div>
                <div class="pricing-card featured">
                    <h3>Professional</h3>
                    <div class="price">$99<small>/mo</small></div>
                    <ul style="list-style: none; padding: 0; text-align: left;">
                        <li>✓ Up to 25 users</li>
                        <li>✓ All features</li>
                        <li>✓ Priority support</li>
                        <li>✓ Advanced analytics</li>
                    </ul>
                    <button class="cta-button" style="width: 100%; margin-top: 2rem;">Get Started</button>
                </div>
                <div class="pricing-card">
                    <h3>Enterprise</h3>
                    <div class="price">$299<small>/mo</small></div>
                    <ul style="list-style: none; padding: 0; text-align: left;">
                        <li>✓ Unlimited users</li>
                        <li>✓ Custom features</li>
                        <li>✓ 24/7 support</li>
                        <li>✓ Custom integrations</li>
                    </ul>
                    <button class="cta-button" style="width: 100%; margin-top: 2rem;">Contact Sales</button>
                </div>
            </div>
        </div>
    </section>

    <section class="cta-section">
        <div class="container">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem;">Ready to Get Started?</h2>
            <p style="font-size: 1.2rem; margin-bottom: 2rem;">Join thousands of satisfied customers today</p>
            <button class="cta-button" style="background: #10b981;">Start Your Free Trial</button>
        </div>
    </section>
</body>
</html>`
  },
  {
    name: 'Lead Magnet Landing',
    description: 'High-converting landing page for lead magnets and freebies',
    category: 'lead-magnet',
    html_content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Get Your Free {{LEAD_MAGNET}} - {{COMPANY_NAME}}</title>
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 2rem; font-weight: bold; color: #1e40af; margin-bottom: 10px; }
        .main-content { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .hero-title { font-size: 2.5rem; color: #1e293b; margin-bottom: 20px; text-align: center; }
        .hero-subtitle { font-size: 1.2rem; color: #64748b; margin-bottom: 30px; text-align: center; }
        .benefits { background: #f1f5f9; padding: 30px; border-radius: 8px; margin: 30px 0; }
        .benefits h3 { color: #1e40af; margin-bottom: 20px; }
        .benefits ul { list-style: none; padding: 0; }
        .benefits li { padding: 8px 0; position: relative; padding-left: 30px; }
        .benefits li:before { content: "✓"; color: #10b981; font-weight: bold; position: absolute; left: 0; }
        .form-container { background: #1e40af; color: white; padding: 30px; border-radius: 8px; margin: 30px 0; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
        .form-group input { width: 100%; padding: 12px; border: none; border-radius: 4px; font-size: 16px; }
        .submit-btn { background: #10b981; color: white; padding: 15px 30px; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; }
        .testimonial { background: #f8fafc; padding: 30px; border-radius: 8px; margin: 30px 0; text-align: center; }
        .testimonial blockquote { font-size: 1.1rem; font-style: italic; margin: 0 0 15px 0; }
        .testimonial cite { color: #64748b; }
        .guarantee { text-align: center; margin: 30px 0; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{COMPANY_NAME}}</div>
        </div>

        <div class="main-content">
            <h1 class="hero-title">Get Your Free {{LEAD_MAGNET}} Today!</h1>
            <p class="hero-subtitle">Join {{NUMBER_OF_USERS}}+ professionals who have already downloaded this valuable resource</p>

            <div class="benefits">
                <h3>What You'll Get:</h3>
                <ul>
                    <li>Comprehensive guide to {{TOPIC}}</li>
                    <li>Step-by-step implementation strategies</li>
                    <li>Real-world examples and case studies</li>
                    <li>Exclusive tips from industry experts</li>
                    <li>Bonus resources worth $100</li>
                </ul>
            </div>

            <div class="form-container">
                <h3 style="margin-top: 0; text-align: center;">Download Your Free Copy</h3>
                <form>
                    <div class="form-group">
                        <label for="name">Full Name</label>
                        <input type="text" id="name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email Address</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="company">Company (Optional)</label>
                        <input type="text" id="company" name="company">
                    </div>
                    <button type="submit" class="submit-btn">Download Now - It's Free!</button>
                </form>
            </div>

            <div class="testimonial">
                <blockquote>"This {{LEAD_MAGNET}} completely changed how I approach {{TOPIC}}. The insights are invaluable and the examples are spot-on. Highly recommended!"</blockquote>
                <cite>- {{TESTIMONIAL_NAME}}, {{TESTIMONIAL_TITLE}}</cite>
            </div>

            <div class="guarantee">
                <p><strong>100% Free</strong> • No spam • Unsubscribe anytime</p>
            </div>
        </div>
    </div>
</body>
</html>`
  }
]

async function seedTemplates() {
  try {
    console.log('Seeding templates...')
    
    for (const template of sampleTemplates) {
      await query(
        'INSERT INTO templates (name, description, html_content, category) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [template.name, template.description, template.html_content, template.category]
      )
      console.log(`✓ Seeded template: ${template.name}`)
    }
    
    console.log('Templates seeded successfully!')
  } catch (error) {
    console.error('Error seeding templates:', error)
  }
}

// Run if called directly
if (require.main === module) {
  seedTemplates().then(() => process.exit(0))
}

export { seedTemplates }
