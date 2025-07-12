import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase, signOut } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { Plus, User, Settings, LogOut, Menu, X } from 'lucide-react';

export default function Layout({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/auth');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-warm-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-warm-50">
            {/* Navigation */}
            <nav className="bg-white shadow-soft border-b border-warm-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-sage-900">Loops</h1>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-4">
                            <button
                                onClick={() => router.push('/create-loop')}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create Loop</span>
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="flex items-center space-x-2 text-sage-700 hover:text-sage-900 p-2 rounded-lg hover:bg-sage-50"
                                >
                                    <div className="w-8 h-8 bg-sage-200 rounded-full flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">
                                        {profile?.full_name || 'User'}
                                    </span>
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-cozy border border-warm-200 z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    router.push('/profile');
                                                    setIsMenuOpen(false);
                                                }}
                                                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-sage-50"
                                            >
                                                <Settings className="h-4 w-4" />
                                                <span>Profile Settings</span>
                                            </button>
                                            <button
                                                onClick={handleSignOut}
                                                className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <LogOut className="h-4 w-4" />
                                                <span>Sign Out</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="text-sage-700 hover:text-sage-900 p-2"
                            >
                                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="md:hidden bg-white border-t border-warm-200">
                        <div className="px-4 py-2 space-y-2">
                            <button
                                onClick={() => {
                                    router.push('/create-loop');
                                    setIsMenuOpen(false);
                                }}
                                className="w-full btn-primary flex items-center justify-center space-x-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Create Loop</span>
                            </button>

                            <div className="border-t border-warm-200 pt-2">
                                <div className="flex items-center space-x-2 px-2 py-2">
                                    <div className="w-8 h-8 bg-sage-200 rounded-full flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-sage-700">
                                        {profile?.full_name || 'User'}
                                    </span>
                                </div>

                                <button
                                    onClick={() => {
                                        router.push('/profile');
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-sage-50"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Profile Settings</span>
                                </button>

                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            {/* Click outside to close menu */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}
        </div>
    );
} 