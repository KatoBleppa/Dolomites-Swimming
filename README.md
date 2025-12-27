# Dolomites Swimming

A modern dashboard application for managing swimming meets, athletes, trainings, and tools built with React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Features

- 📊 **Dashboard**: Overview with quick access to all modules
- 🏆 **Meets**: Manage swimming meets and competitions
- 👥 **Athletes**: View and manage athlete profiles
- 💪 **Trainings**: Track training sessions and progress
- 🔧 **Tools**: Access training and management tools

## Tech Stack

- **Framework**: Vite + React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database**: Supabase
- **Routing**: React Router v6
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

3. Add your Supabase credentials to `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Create Database Tables

Run these SQL commands in your Supabase SQL editor:

```sql
-- Meets table
CREATE TABLE meets (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Athletes table
CREATE TABLE athletes (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  team TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trainings table
CREATE TABLE trainings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  duration INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE meets ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your needs)
CREATE POLICY "Enable read access for all users" ON meets FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON athletes FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON trainings FOR SELECT USING (true);
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   └── Sidebar.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── pages/
│   ├── Dashboard.tsx
│   ├── Meets.tsx
│   ├── Athletes.tsx
│   ├── Trainings.tsx
│   └── Tools.tsx
├── App.tsx
├── main.tsx
└── index.css
```

## Customization

### Adding More UI Components

To add more shadcn/ui components, you can manually create them in `src/components/ui/` following the shadcn/ui documentation.

### Supabase Configuration

The Supabase client is configured in `src/lib/supabase.ts`. You can modify this file to add additional configuration options.

### Styling

The application uses Tailwind CSS with custom design tokens defined in `tailwind.config.js`. You can customize colors, spacing, and other design tokens there.

## License

MIT
