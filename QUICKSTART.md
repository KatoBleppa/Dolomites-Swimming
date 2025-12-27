# Quick Start Guide - Dolomites Swimming

## 🚀 Getting Started in 5 Minutes

### 1. Environment Variables
Copy the example environment file and add your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Set Up Database
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Open the SQL Editor
3. Copy and paste the content from `supabase-setup.sql`
4. Click "Run" to create tables and sample data

### 3. Install Dependencies (Already Done!)
```bash
npm install
```

### 4. Start Development Server
```bash
npm run dev
```

Visit: **http://localhost:5173**

## 📱 What You'll See

The app opens with a **Dashboard** containing four main sections:

- **🏆 Meets** - Swimming competitions and events
- **👥 Athletes** - Athlete profiles and information
- **💪 Trainings** - Training sessions and schedules
- **🔧 Tools** - Utilities like pace calculators and analytics

## 🔑 Where to Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in
2. Create a new project or select existing one
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

## ✅ Verification Checklist

- [ ] Environment variables are set in `.env`
- [ ] Database tables created in Supabase
- [ ] `npm install` completed successfully
- [ ] Development server running at `http://localhost:5173`
- [ ] Can see the dashboard with all four sections

## 🎨 Features

### Current Features
- Responsive dashboard layout
- Sidebar navigation
- Data fetching from Supabase
- Search functionality
- Beautiful UI with shadcn/ui components

### Ready to Extend
- Add authentication (Supabase Auth)
- Create/Edit/Delete operations
- Advanced filtering and sorting
- Charts and analytics
- PDF export functionality

## 🛠️ Tech Stack Summary

- **React 18** - UI Framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library
- **Supabase** - Backend & Database
- **React Router** - Navigation
- **Lucide React** - Icon library

## 📝 Next Steps

1. Customize the dashboard cards
2. Add create/edit forms for each section
3. Implement authentication
4. Add real-time subscriptions
5. Create detailed views for each entity
6. Add data visualization with charts

## 🐛 Troubleshooting

**Cannot connect to Supabase?**
- Check your `.env` file has correct credentials
- Verify your Supabase project is active
- Check browser console for specific errors

**TypeScript errors?**
- Restart the TypeScript server in VS Code
- Run `npm install` again
- Delete `node_modules` and reinstall

**Styles not loading?**
- Clear browser cache
- Restart dev server
- Check `index.css` is imported in `main.tsx`

## 📚 Documentation Links

- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)
- [React Router](https://reactrouter.com)

---

**Happy Coding! 🏊‍♂️**
