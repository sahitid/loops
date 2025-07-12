import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial user
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setLoading(false);
        };

        getUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user || null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    return { user, loading };
} 