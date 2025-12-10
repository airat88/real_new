-- ============================================
-- SUPABASE DATABASE SETUP SCRIPT
-- Cyprus Real Estate Application
-- ============================================

-- Run this script in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

-- ============================================
-- 1. CREATE PROFILES TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('broker', 'client', 'admin')) DEFAULT 'client',
  avatar_url TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Brokers can view all profiles" ON public.profiles;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Policy: Brokers can view all client profiles
CREATE POLICY "Brokers can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'broker'
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR auth.uid() = id
  );

-- ============================================
-- 3. CREATE TRIGGER FUNCTION FOR AUTO PROFILE CREATION
-- ============================================

-- Drop function if exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    phone, 
    role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. CREATE UPDATED_AT TRIGGER
-- ============================================

-- Drop function if exists
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. SELECTIONS TABLE SETUP (if exists)
-- ============================================

-- Enable RLS for selections if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'selections') THEN
    ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Brokers can manage own selections" ON public.selections;
    DROP POLICY IF EXISTS "Anyone can view with token" ON public.selections;
    
    -- Brokers can manage their own selections
    CREATE POLICY "Brokers can manage own selections" 
      ON public.selections 
      FOR ALL 
      USING (
        broker_id = auth.uid() 
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'broker'
      );
    
    -- Anyone can view selection with valid token (for client swipe)
    CREATE POLICY "Anyone can view with token" 
      ON public.selections 
      FOR SELECT 
      USING (true);
  END IF;
END $$;

-- ============================================
-- 6. REACTIONS TABLE SETUP (if exists)
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reactions') THEN
    ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Anyone can insert reactions" ON public.reactions;
    DROP POLICY IF EXISTS "Brokers can view reactions" ON public.reactions;
    
    -- Anyone can insert reactions (clients swiping)
    CREATE POLICY "Anyone can insert reactions" 
      ON public.reactions 
      FOR INSERT 
      WITH CHECK (true);
    
    -- Brokers can view reactions for their selections
    CREATE POLICY "Brokers can view reactions" 
      ON public.reactions 
      FOR SELECT 
      USING (
        (SELECT broker_id FROM public.selections WHERE id = selection_id) = auth.uid()
        OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('broker', 'admin')
      );
  END IF;
END $$;

-- ============================================
-- 7. PROPERTIES TABLE SETUP (if exists)
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'properties') THEN
    ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Properties are viewable by everyone" ON public.properties;
    DROP POLICY IF EXISTS "Brokers can manage properties" ON public.properties;
    
    -- Everyone can view properties
    CREATE POLICY "Properties are viewable by everyone" 
      ON public.properties 
      FOR SELECT 
      USING (true);
    
    -- Brokers can manage properties
    CREATE POLICY "Brokers can manage properties" 
      ON public.properties 
      FOR ALL 
      USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('broker', 'admin')
      );
  END IF;
END $$;

-- ============================================
-- 8. FAVORITES TABLE SETUP (if exists)
-- ============================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'favorites') THEN
    ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
    
    -- Users can manage their own favorites
    CREATE POLICY "Users can manage own favorites" 
      ON public.favorites 
      FOR ALL 
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- 9. CREATE ADMIN USER (OPTIONAL)
-- ============================================

-- You can manually create an admin user through Supabase Auth UI
-- Then update their role:
-- 
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'admin@example.com';

-- ============================================
-- 10. GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant permissions for authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Grant select on all tables to authenticated users
DO $$ 
BEGIN
  -- Grant on existing tables
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
  
  -- Grant on sequences
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify setup:

-- Check if profiles table exists and has correct structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'selections', 'reactions', 'properties', 'favorites');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- ============================================
-- SUCCESS!
-- ============================================

-- If all queries run successfully, your database is ready!
-- 
-- Next steps:
-- 1. Test user registration at /src/broker/register.html
-- 2. Verify profile is created automatically
-- 3. Test login at /src/broker/login.html
-- 4. Check dashboard access
--
-- For troubleshooting, see docs/SUPABASE_AUTH_RU.md
