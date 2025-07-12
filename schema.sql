-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS (Row Level Security)
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loops table
CREATE TABLE IF NOT EXISTS public.loops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly', -- weekly, monthly, custom
  custom_frequency_days INTEGER, -- for custom frequency
  reminder_day INTEGER DEFAULT 1, -- 1=Monday, 2=Tuesday, etc.
  reminder_time TIME DEFAULT '09:00:00',
  next_reminder_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loop_members table
CREATE TABLE IF NOT EXISTS public.loop_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_id UUID REFERENCES public.loops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- admin, member
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(loop_id, user_id)
);

-- Create loop_cycles table (each reminder cycle)
CREATE TABLE IF NOT EXISTS public.loop_cycles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_id UUID REFERENCES public.loops(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  compilation_sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(loop_id, cycle_number)
);

-- Create updates table (member submissions)
CREATE TABLE IF NOT EXISTS public.updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_cycle_id UUID REFERENCES public.loop_cycles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  images TEXT[], -- array of image URLs
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_published BOOLEAN DEFAULT FALSE,
  UNIQUE(loop_cycle_id, user_id)
);

-- Create compiled_loops table (final newsletters)
CREATE TABLE IF NOT EXISTS public.compiled_loops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loop_cycle_id UUID REFERENCES public.loop_cycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- compiled content with all updates
  html_content TEXT, -- rendered HTML version
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Create email_logs table (track email deliveries)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID REFERENCES public.profiles(id),
  email_type TEXT NOT NULL, -- reminder, compilation
  loop_id UUID REFERENCES public.loops(id),
  loop_cycle_id UUID REFERENCES public.loop_cycles(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent', -- sent, failed, bounced
  error_message TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compiled_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Loops policies
CREATE POLICY "Users can view loops they are members of" ON public.loops
  FOR SELECT USING (
    id IN (
      SELECT loop_id FROM public.loop_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Users can create loops" ON public.loops
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Loop admins can update loops" ON public.loops
  FOR UPDATE USING (
    id IN (
      SELECT loop_id FROM public.loop_members 
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  );

-- Loop members policies
CREATE POLICY "Users can view loop members for their loops" ON public.loop_members
  FOR SELECT USING (
    loop_id IN (
      SELECT loop_id FROM public.loop_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "Users can join loops" ON public.loop_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave loops" ON public.loop_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Loop cycles policies
CREATE POLICY "Users can view cycles for their loops" ON public.loop_cycles
  FOR SELECT USING (
    loop_id IN (
      SELECT loop_id FROM public.loop_members 
      WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );

-- Updates policies
CREATE POLICY "Users can view updates for their loops" ON public.updates
  FOR SELECT USING (
    loop_cycle_id IN (
      SELECT lc.id FROM public.loop_cycles lc
      JOIN public.loop_members lm ON lc.loop_id = lm.loop_id
      WHERE lm.user_id = auth.uid() AND lm.is_active = TRUE
    )
  );

CREATE POLICY "Users can create their own updates" ON public.updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own updates" ON public.updates
  FOR UPDATE USING (auth.uid() = user_id);

-- Compiled loops policies
CREATE POLICY "Users can view compiled loops for their loops" ON public.compiled_loops
  FOR SELECT USING (
    loop_cycle_id IN (
      SELECT lc.id FROM public.loop_cycles lc
      JOIN public.loop_members lm ON lc.loop_id = lm.loop_id
      WHERE lm.user_id = auth.uid() AND lm.is_active = TRUE
    )
  );

-- Email logs policies
CREATE POLICY "Users can view their own email logs" ON public.email_logs
  FOR SELECT USING (auth.uid() = recipient_id);

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.loops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.loops WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loop_members_loop_id ON public.loop_members(loop_id);
CREATE INDEX IF NOT EXISTS idx_loop_members_user_id ON public.loop_members(user_id);
CREATE INDEX IF NOT EXISTS idx_loop_cycles_loop_id ON public.loop_cycles(loop_id);
CREATE INDEX IF NOT EXISTS idx_updates_loop_cycle_id ON public.updates(loop_cycle_id);
CREATE INDEX IF NOT EXISTS idx_updates_user_id ON public.updates(user_id);
CREATE INDEX IF NOT EXISTS idx_loops_invite_code ON public.loops(invite_code);
CREATE INDEX IF NOT EXISTS idx_loops_next_reminder_date ON public.loops(next_reminder_date); 