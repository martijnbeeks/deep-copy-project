# Database Setup Guide

This guide covers setting up the database for both **local development** and **production deployment** (including Render, Railway, Supabase, etc.).

## 🚀 Quick Start

### For Local Development
```bash
# Set your environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ai_copywriting
export DB_USER=postgres
export DB_PASSWORD=your_password

# Run complete setup (creates everything from scratch)
node scripts/complete-database-setup.js
```

### For Production/Cloud Databases
```bash
# Set your cloud database credentials
export DB_HOST=your-cloud-host.com
export DB_PORT=5432
export DB_NAME=your_database_name
export DB_USER=your_username
export DB_PASSWORD=your_password
export NODE_ENV=production

# Run complete setup
node scripts/complete-database-setup.js
```

### For Existing Databases (Migration Only)
```bash
# Run migration to add new fields to existing database
node scripts/complete-database-setup.js migrate
```

## 📋 Environment Variables

Create a `.env.local` file with your database credentials:

```env
# Database Configuration
DB_HOST=localhost                    # or your cloud host
DB_PORT=5432                        # PostgreSQL port
DB_NAME=ai_copywriting              # your database name
DB_USER=postgres                    # your username
DB_PASSWORD=your_password           # your password

# DeepCopy API Configuration
DEEPCOPY_CLIENT_ID=your_client_id
DEEPCOPY_CLIENT_SECRET=your_client_secret
```

## 🏗️ Database Setup Options

### 1. Complete Setup (Fresh Database)
Creates all tables, indexes, demo data, and templates from scratch.

```bash
node scripts/complete-database-setup.js
```

**What it does:**
- ✅ Creates all tables (users, jobs, templates, results)
- ✅ Adds indexes for performance
- ✅ Inserts demo user (`demo@example.com` / `demo123`)
- ✅ Inserts default templates
- ✅ Inserts swipe templates from `/swipe_templates` folder
- ✅ Includes new fields: `advertorial_type`, `persona`, `age_range`, `gender`

### 2. Migration Only (Existing Database)
Adds new fields to existing database without affecting existing data.

```bash
node scripts/complete-database-setup.js migrate
```

**What it does:**
- ✅ Adds new columns to `jobs` table:
  - `advertorial_type` (VARCHAR(50), NOT NULL, default: 'Listicle')
  - `persona` (TEXT, optional)
  - `age_range` (VARCHAR(50), optional)
  - `gender` (VARCHAR(20), optional)
- ✅ Updates existing records with default values
- ✅ Safe to run multiple times (idempotent)

## 🌐 Cloud Database Support

The setup script automatically detects and configures SSL for these cloud providers:

- **Render** (`*.render.com`)
- **Railway** (`*.railway.app`)
- **Supabase** (`*.supabase.co`)
- **AWS RDS** (`*.amazonaws.com`)
- **Any production environment** (`NODE_ENV=production`)

### Render Database Example
```bash
export DB_HOST=dpg-abc123-def456-pooler.us-east-1.aws.neon.tech
export DB_PORT=5432
export DB_NAME=ai_copywriting_prod
export DB_USER=ai_copywriting_user
export DB_PASSWORD=your_render_password
export NODE_ENV=production

node scripts/complete-database-setup.js
```

### Railway Database Example
```bash
export DB_HOST=containers-us-west-123.railway.app
export DB_PORT=5432
export DB_NAME=railway
export DB_USER=postgres
export DB_PASSWORD=your_railway_password
export NODE_ENV=production

node scripts/complete-database-setup.js
```

## 🔧 Troubleshooting

### Connection Issues
```bash
❌ Connection refused
💡 Check your database credentials and network access
```

**Solutions:**
- Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
- Ensure database server is running
- Check firewall/network access
- For cloud databases, verify connection string

### Authentication Issues
```bash
❌ Authentication failed
💡 Check your username and password
```

**Solutions:**
- Verify `DB_USER` and `DB_PASSWORD`
- Check if user has proper permissions
- Ensure password doesn't contain special characters that need escaping

### Database Not Found
```bash
❌ Database does not exist
💡 Create the database first
```

**Solutions:**
- Create the database manually: `CREATE DATABASE ai_copywriting;`
- Or update `DB_NAME` to an existing database

### Column Already Exists (Migration)
```bash
ℹ️ Columns already exist, migration not needed
```

**This is normal!** The migration is idempotent and safe to run multiple times.

## 📊 Database Schema

### Jobs Table (Updated)
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    brand_info TEXT NOT NULL,
    sales_page_url TEXT,
    template_id UUID REFERENCES templates(id),
    advertorial_type VARCHAR(50) NOT NULL DEFAULT 'Listicle',  -- NEW
    persona TEXT,                                               -- NEW
    age_range VARCHAR(50),                                      -- NEW
    gender VARCHAR(20),                                         -- NEW
    execution_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Other Tables
- `users` - User accounts and authentication
- `templates` - Available content templates
- `results` - Generated content results

## 🎯 Next Steps After Setup

1. **Start your application:**
   ```bash
   npm run dev
   ```

2. **Login with demo account:**
   - Email: `demo@example.com`
   - Password: `demo123`

3. **Test the new form fields:**
   - Go to `/create`
   - Fill out the form with new fields:
     - Advertorial Type (required)
     - Persona (optional)
     - Age Range (optional)
     - Gender (optional)

4. **Deploy to production:**
   - Set environment variables in your hosting platform
   - Run migration: `node scripts/complete-database-setup.js migrate`
   - Deploy your application

## 🔄 API Integration

The application now supports the updated DeepCopy API with:

- **New Input Fields:**
  - `advertorial_type` (required): "Listicle" or "Advertorial"
  - `persona` (optional): Target audience description
  - `age_range` (optional): Age range for targeting
  - `gender` (optional): Gender targeting

- **New Output Format:**
  - JSON data instead of HTML files
  - Frontend template injection for rendering
  - Separate templates for Listicle and Advertorial content

## 📞 Support

If you encounter issues:

1. Check the error messages above
2. Verify your environment variables
3. Ensure database connectivity
4. Check the application logs for detailed error information

The setup script provides detailed error messages and suggestions for common issues.
