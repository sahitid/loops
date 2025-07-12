import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to get the current user
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

// Helper function to sign out
export const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
} 