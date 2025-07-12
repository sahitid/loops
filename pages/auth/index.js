import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import AuthForm from '../../components/AuthForm';

export default function AuthPage() {
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                router.push('/');
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN') {
                    router.push('/');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [router]);

    return <AuthForm />;
} 