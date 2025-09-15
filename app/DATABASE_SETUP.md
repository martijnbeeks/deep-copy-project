# Database Setup Guide

This guide contains all the commands needed to set up the  database in PostgreSQL.

## Prerequisites

- PostgreSQL installed and running
- Access to a PostgreSQL database server

## 1. Create Database

```sql
CREATE DATABASE ai_copywriting;
```

## 2. Connect to Database

```bash
psql -h localhost -U postgres -d ai_copywriting
```

## 3. Create Tables

Run the following SQL commands to create all required tables:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    html_content TEXT NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    brand_info TEXT NOT NULL,
    sales_page_url TEXT,
    template_id UUID REFERENCES templates(id),
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    execution_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Results table
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    html_content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_results_job_id ON results(job_id);
CREATE INDEX idx_templates_category ON templates(category);
```

## 4. Insert Demo User

```sql
INSERT INTO users (email, name, password_hash) VALUES 
('demo@example.com', 'Demo User', '$2b$10$example_hash_here');
```

## 5. Insert Default Templates

```sql
-- E-commerce Product Page
INSERT INTO templates (name, description, html_content, category) VALUES 
('E-commerce Product Page', 'Professional product page template for e-commerce websites', '<!DOCTYPE html><html><head><title>Product Page</title></head><body><h1>Product Name</h1><p>Product description here...</p></body></html>', 'E-commerce');

-- SaaS Landing Page
INSERT INTO templates (name, description, html_content, category) VALUES 
('SaaS Landing Page', 'Modern landing page template for SaaS products', '<!DOCTYPE html><html><head><title>SaaS Landing</title></head><body><h1>Your SaaS Product</h1><p>Transform your business with our solution...</p></body></html>', 'SaaS');

-- Lead Magnet Landing
INSERT INTO templates (name, description, html_content, category) VALUES 
('Lead Magnet Landing', 'High-converting landing page for lead magnets', '<!DOCTYPE html><html><head><title>Lead Magnet</title></head><body><h1>Get Your Free Guide</h1><p>Download our exclusive guide...</p></body></html>', 'Marketing');
```

## 6. Insert Swipe Templates (Optional)

If you have HTML files in a `swipe_templates` folder, you can use this Node.js script:

```javascript
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getCategoryFromFilename(filename) {
  const name = filename.toLowerCase();
  if (name.includes('kingsloot') || name.includes('loot')) {
    return 'Gaming';
  } else if (name.includes('petlab') || name.includes('pet')) {
    return 'Pet Care';
  } else if (name.includes('javvycoffe') || name.includes('coffee')) {
    return 'Food & Beverage';
  } else if (name.includes('brunchescrunches') || name.includes('brunch')) {
    return 'Food & Beverage';
  } else {
    return 'General';
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_copywriting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'MyNewStrongP@ssw0rd!',
});

async function insertSwipeTemplates() {
  try {
    console.log('🚀 Starting swipe templates insertion...');
    const templatesDir = path.join(process.cwd(), 'swipe_templates');
    const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.html'));
    console.log('📁 Found', files.length, 'HTML files:', files);

    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      const title = file.replace('.html', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const description = `Professional ${title} template for marketing campaigns`;
      const category = getCategoryFromFilename(file);

      console.log(`📝 Inserting template: ${title} (Category: ${category})`);
      const result = await pool.query(
        'INSERT INTO templates (name, description, html_content, category) VALUES ($1, $2, $3, $4) RETURNING id',
        [title, description, htmlContent, category]
      );
      console.log(`✅ Inserted template with ID: ${result.rows[0].id}`);
    }
    console.log('🎉 All swipe templates inserted successfully!');
  } catch (error) {
    console.error('❌ Error inserting swipe templates:', error);
  } finally {
    await pool.end();
  }
}

insertSwipeTemplates();
```

Save this as `insert-swipe-templates.js` and run:
```bash
node insert-swipe-templates.js
```

## 7. Environment Variables

Create a `.env.local` file in your project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_copywriting
DB_USER=postgres
DB_PASSWORD=MyNewStrongP@ssw0rd!
```

## 8. Verify Setup

Check that all tables were created:

```sql
\dt
```

Check templates:

```sql
SELECT name, category FROM templates ORDER BY name;
```

Check users:

```sql
SELECT email, name FROM users;
```

## Troubleshooting

- **Connection issues**: Ensure PostgreSQL is running and credentials are correct
- **Permission errors**: Make sure the user has CREATE DATABASE privileges
- **Template insertion fails**: Check that HTML files exist in `swipe_templates` folder
- **Foreign key errors**: Ensure users are created before jobs, and jobs before results

## Database Schema Overview

```
users (id, email, name, password_hash, created_at, updated_at)
  ↓
jobs (id, user_id, title, brand_info, sales_page_url, template_id, status, progress, execution_id, created_at, updated_at)
  ↓
results (id, job_id, html_content, metadata, created_at, updated_at)

templates (id, name, description, html_content, category, created_at, updated_at)
```

This setup provides a complete foundation for the AI Copywriting application with user management, job tracking, template storage, and result generation.
