import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function AuthForm() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        },
                    },
                });
                if (error) throw error;
                setMessage('Check your email for the confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setMessage('');
        setFullName('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-warm-50 to-sage-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-sage-900 mb-2">Welcome to Loops</h1>
                    <p className="text-gray-600">Share life updates with your closest friends</p>
                </div>

                <div className="card p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold text-sage-900 mb-2">
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </h2>
                        <p className="text-gray-600 text-sm">
                            {isSignUp
                                ? 'Join the cozy corner of the internet'
                                : 'Welcome back to your loops'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-sage-700 mb-2">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="input-field pl-10"
                                        placeholder="Your full name"
                                        required={isSignUp}
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-field pl-10"
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field pl-10 pr-10"
                                    placeholder="Your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.includes('Check your email')
                                    ? 'bg-sage-100 text-sage-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 text-sm">
                            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="text-sage-600 hover:text-sage-700 font-medium"
                            >
                                {isSignUp ? 'Sign In' : 'Sign Up'}
                            </button>
                        </p>
                    </div>
                </div>

                <div className="mt-8 text-center text-xs text-gray-500">
                    <p>A cozy space for friends to share life's moments</p>
                </div>
            </div>
        </div>
    );
} 