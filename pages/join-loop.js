import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import Layout from '../components/Layout';
import { ArrowLeft, Users, Key, AlertCircle, CheckCircle } from 'lucide-react';

export default function JoinLoop() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loopPreview, setLoopPreview] = useState(null);

    const handleInviteCodeChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setInviteCode(value);
        setError('');
        setSuccess('');
        setLoopPreview(null);
    };

    const handlePreview = async () => {
        if (!inviteCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Check if loop exists
            const { data: loop, error: loopError } = await supabase
                .from('loops')
                .select(`
          *,
          profiles!loops_created_by_fkey (
            full_name
          ),
          loop_members (
            id,
            profiles (
              full_name
            )
          )
        `)
                .eq('invite_code', inviteCode)
                .eq('is_active', true)
                .single();

            if (loopError) {
                if (loopError.code === 'PGRST116') {
                    throw new Error('Invalid invite code. Please check and try again.');
                }
                throw loopError;
            }

            // Check if user is already a member
            const { data: existingMember } = await supabase
                .from('loop_members')
                .select('id')
                .eq('loop_id', loop.id)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .single();

            if (existingMember) {
                setError('You are already a member of this loop');
                return;
            }

            setLoopPreview(loop);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinLoop = async () => {
        if (!loopPreview) return;

        setLoading(true);
        setError('');

        try {
            // Add user to loop
            const { error: memberError } = await supabase
                .from('loop_members')
                .insert({
                    loop_id: loopPreview.id,
                    user_id: user.id,
                    role: 'member'
                });

            if (memberError) throw memberError;

            setSuccess('Successfully joined the loop!');

            // Redirect to loop page after a short delay
            setTimeout(() => {
                router.push(`/loop/${loopPreview.id}`);
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getFrequencyText = (frequency, customDays) => {
        if (frequency === 'custom') {
            return `Every ${customDays} day${customDays > 1 ? 's' : ''}`;
        }
        return frequency.charAt(0).toUpperCase() + frequency.slice(1);
    };

    return (
        <Layout>
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">Join a Loop</h1>
                    <p className="text-gray-600">
                        Enter an invite code to join your friends' loop
                    </p>
                </div>

                {/* Form */}
                <div className="card p-8">
                    <div className="space-y-6">
                        {/* Invite Code Input */}
                        <div>
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Invite Code
                            </label>
                            <div className="flex space-x-3">
                                <div className="flex-1 relative">
                                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={handleInviteCodeChange}
                                        className="input-field pl-10 font-mono text-center"
                                        placeholder="ABC123XY"
                                        maxLength={8}
                                    />
                                </div>
                                <button
                                    onClick={handlePreview}
                                    disabled={loading || !inviteCode.trim()}
                                    className="btn-secondary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Checking...' : 'Preview'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Invite codes are 8 characters long and case-insensitive
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-200 rounded-lg">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="flex items-center space-x-2 p-3 bg-green-100 border border-green-200 rounded-lg">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700">{success}</span>
                            </div>
                        )}

                        {/* Loop Preview */}
                        {loopPreview && (
                            <div className="border-t pt-6">
                                <h3 className="font-semibold text-sage-900 mb-4">Loop Preview</h3>
                                <div className="bg-sage-50 rounded-lg p-4 space-y-3">
                                    <div>
                                        <h4 className="font-medium text-sage-900">{loopPreview.name}</h4>
                                        {loopPreview.description && (
                                            <p className="text-sm text-gray-600 mt-1">{loopPreview.description}</p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600">Created by:</span>
                                            <p className="font-medium text-sage-900">
                                                {loopPreview.profiles?.full_name || 'Unknown'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Members:</span>
                                            <p className="font-medium text-sage-900">
                                                {loopPreview.loop_members?.length || 0} people
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Frequency:</span>
                                            <p className="font-medium text-sage-900">
                                                {getFrequencyText(loopPreview.frequency, loopPreview.custom_frequency_days)}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Status:</span>
                                            <p className="font-medium text-green-600">Active</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <button
                                            onClick={handleJoinLoop}
                                            disabled={loading}
                                            className="w-full btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? 'Joining...' : 'Join This Loop'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="mt-8 p-6 bg-sage-50 rounded-lg border border-sage-200">
                    <h3 className="font-semibold text-sage-900 mb-2">How it works</h3>
                    <ul className="text-sm text-sage-700 space-y-1">
                        <li>• Ask a friend for their loop's invite code</li>
                        <li>• Enter the code above to preview the loop</li>
                        <li>• Join to start receiving update reminders</li>
                        <li>• Share your life moments with the group</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
} 