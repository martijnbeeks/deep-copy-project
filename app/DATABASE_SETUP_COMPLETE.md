# Complete Database Setup

This script sets up the entire database with all tables, data, and injectable templates for the AI Copy Writing application.

## What Gets Created

### Database Tables
- **users** - User accounts and profiles
- **templates** - Regular HTML templates
- **jobs** - Copy writing jobs and their status
- **results** - Generated HTML results with metadata
- **injectable_templates** - Dynamic templates for content injection
- **admin_users** - Admin dashboard authentication

### Initial Data
- **Admin user**: username `admin`, password `admin123`
- **Sample templates** for testing
- **Injectable templates** from `swipe_templates/` folder:
  - **Listicle templates**: blissy.html, javycoffee.html, hike.html
  - **Advertorial templates**: bugmd.html, bunion.html, footpads.html, example_with_placeholders.html

### Database Indexes
- Performance indexes on frequently queried columns
- Foreign key indexes for joins

## Setup Instructions

### 1. Create Environment File
Create `.env.local` with your Render database credentials:

```env
DB_HOST=dpg-d3o918hr0fns73c0jngg-a.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=ai_copy_writing
DB_USER=ai_copy_writing_user
DB_PASSWORD=LTjtMvcmwM8adLvDvzNbOaeGQ1wrtNAw

DEEPCOPY_CLIENT_ID=5mbatc7uv35hr23qip437s2ai5
DEEPCOPY_CLIENT_SECRET=1msm19oltu7241134t5vujtldr4uvum7hvn6cj7n1s3tg1ar02k5
```

**Note**: The setup script now includes these credentials as defaults, so you can run it immediately without creating `.env.local`.

### 2. Run Setup Script

**Windows:**
```bash
scripts/setup-database.bat
```

**Mac/Linux:**
```bash
chmod +x scripts/setup-database.sh
scripts/setup-database.sh
```

**Manual:**
```bash
node scripts/setup-complete-database.js
```

## Verification

After setup, verify everything works:

1. **Admin Dashboard**: Go to `/admin` and login with `admin`/`admin123`
2. **Create Job**: Test creating a listicle or advertorial job
3. **View Results**: Check the results page for template injection
4. **Template Management**: Verify injectable templates are loaded

## Troubleshooting

### Database Connection Issues
- Verify your Render database credentials
- Check if the database is accessible from your IP
- Ensure the database is running and not paused

### Template Loading Issues
- Check that `swipe_templates/` folder exists
- Verify HTML files are readable
- Check console logs for specific errors

### Permission Issues
- Ensure the database user has CREATE, INSERT, UPDATE permissions
- Check if tables already exist (script handles conflicts gracefully)

## What's Included

The script automatically:
- ✅ Creates all required tables
- ✅ Sets up proper indexes
- ✅ Inserts admin user
- ✅ Loads injectable templates from swipe_templates/
- ✅ Handles conflicts gracefully (won't duplicate data)
- ✅ Provides detailed logging
- ✅ Verifies setup completion

## Next Steps

After successful setup:
1. Test the admin dashboard
2. Create a test job
3. Verify template injection works
4. Check results display correctly
5. Push your changes to production
