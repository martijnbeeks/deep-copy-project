# Database Setup Guide

## Option 1: Using Docker (Recommended)

This is the easiest way to get PostgreSQL running locally:

```bash
# Run PostgreSQL in Docker
docker run --name ai-copywriting-db \
  -e POSTGRES_DB=ai_copywriting \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Check if it's running
docker ps
```

## Option 2: Local PostgreSQL Installation

If you have PostgreSQL installed locally:

1. **Start PostgreSQL service**
2. **Create the database:**
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres

   -- Create database
   CREATE DATABASE ai_copywriting;

   -- Create user (optional, or use existing postgres user)
   CREATE USER ai_user WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE ai_copywriting TO ai_user;
   ```

## Option 3: Using Supabase (Cloud)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection details from Settings > Database
4. Update your `.env.local` file with the Supabase credentials

## Environment Variables

Create a `.env.local` file in your project root:

```env
# For local Docker/PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_copywriting
DB_USER=postgres
DB_PASSWORD=password

# For Supabase (replace with your actual values)
# DB_HOST=db.your-project-ref.supabase.co
# DB_PORT=5432
# DB_NAME=postgres
# DB_USER=postgres
# DB_PASSWORD=your-password
# DB_SSL=true

NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

## Running the Setup

Once your database is running:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up the database schema and seed data:**
   ```bash
   npm run setup-db
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Troubleshooting

### Connection Issues
- Make sure PostgreSQL is running
- Check if the port 5432 is available
- Verify your credentials in `.env.local`

### Permission Issues
- Make sure your database user has CREATE privileges
- For local PostgreSQL, you might need to run as superuser

### Docker Issues
- Make sure Docker is running
- Check if the container is running: `docker ps`
- View logs: `docker logs ai-copywriting-db`
