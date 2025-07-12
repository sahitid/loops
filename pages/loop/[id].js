import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/useAuth';
import Layout from '../../components/Layout';
import {
    ArrowLeft,
    Users,
    Calendar,
    Clock,
    Settings,
    Copy,
    Plus,
    Edit3,
    Eye,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function LoopDetail() {
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    const [loop, setLoop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [copied, setCopied] = useState(false);
    const [userRole, setUserRole] = useState('member');

    useEffect(() => {
        if (id && user) {
            fetchLoop();
        }
    }, [id, user]);

    const fetchLoop = async () => {
        try {
            const { data, error } = await supabase
                .from('loops')
                .select(`
          *,
          profiles!loops_created_by_fkey (
            full_name,
            avatar_url
          ),
          loop_members!inner (
            id,
            role,
            user_id,
            joined_at,
            is_active,
            profiles (
              full_name,
              avatar_url
            )
          )
        `)
                .eq('id', id)
                .eq('loop_members.user_id', user.id)
                .eq('loop_members.is_active', true)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    setError('Loop not found or you do not have access');
                } else {
                    throw error;
                }
                return;
            }

            // Get user's role in this loop
            const userMember = data.loop_members.find(member => member.user_id === user.id);
            setUserRole(userMember?.role || 'member');

            // Get all loop members
            const { data: allMembers, error: membersError } = await supabase
                .from('loop_members')
                .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
                .eq('loop_id', id)
                .eq('is_active', true)
                .order('joined_at', { ascending: true });

            if (membersError) throw membersError;

            setLoop({ ...data, all_members: allMembers });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyInviteCode = async () => {
        try {
            await navigator.clipboard.writeText(loop.invite_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const getFrequencyText = (frequency, customDays) => {
        if (frequency === 'custom') {
            return `Every ${customDays} day${customDays > 1 ? 's' : ''}`;
        }
        return frequency.charAt(0).toUpperCase() + frequency.slice(1);
    };

    const getNextReminderText = (nextReminderDate) => {
        if (!nextReminderDate) return 'Not scheduled';
        try {
            return format(new Date(nextReminderDate), 'PPP');
        } catch {
            return 'Not scheduled';
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="btn-primary"
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Dashboard</span>
                    </button>

                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-sage-900 mb-2">{loop.name}</h1>
                            {loop.description && (
                                <p className="text-gray-600 text-lg mb-4">{loop.description}</p>
                            )}
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <div className="flex items-center space-x-1">
                                    <Users className="h-4 w-4" />
                                    <span>{loop.all_members?.length || 0} members</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>{getFrequencyText(loop.frequency, loop.custom_frequency_days)}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Clock className="h-4 w-4" />
                                    <span>Next: {getNextReminderText(loop.next_reminder_date)}</span>
                                </div>
                            </div>
                        </div>

                        {userRole === 'admin' && (
                            <button
                                onClick={() => router.push(`/loop/${loop.id}/settings`)}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <Settings className="h-4 w-4" />
                                <span>Settings</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-warm-200 mb-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                                    ? 'border-sage-500 text-sage-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('members')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'members'
                                    ? 'border-sage-500 text-sage-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Members
                        </button>
                        <button
                            onClick={() => setActiveTab('updates')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'updates'
                                    ? 'border-sage-500 text-sage-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Updates
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="card p-6 text-center">
                                <div className="w-12 h-12 bg-sage-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Edit3 className="h-6 w-6 text-sage-600" />
                                </div>
                                <h3 className="font-semibold text-sage-900 mb-2">Submit Update</h3>
                                <p className="text-sm text-gray-600 mb-4">Share your latest life moments</p>
                                <button
                                    onClick={() => router.push(`/loop/${loop.id}/submit`)}
                                    className="btn-primary w-full"
                                >
                                    Submit Update
                                </button>
                            </div>

                            <div className="card p-6 text-center">
                                <div className="w-12 h-12 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Eye className="h-6 w-6 text-cream-700" />
                                </div>
                                <h3 className="font-semibold text-sage-900 mb-2">Past Loops</h3>
                                <p className="text-sm text-gray-600 mb-4">Browse previous compilations</p>
                                <button
                                    onClick={() => router.push(`/loop/${loop.id}/archive`)}
                                    className="btn-secondary w-full"
                                >
                                    View Archive
                                </button>
                            </div>

                            <div className="card p-6 text-center">
                                <div className="w-12 h-12 bg-warm-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="h-6 w-6 text-warm-700" />
                                </div>
                                <h3 className="font-semibold text-sage-900 mb-2">Invite Friends</h3>
                                <p className="text-sm text-gray-600 mb-4">Share the invite code</p>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={loop.invite_code}
                                        readOnly
                                        className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-200 rounded text-center"
                                    />
                                    <button
                                        onClick={copyInviteCode}
                                        className="p-2 text-sage-600 hover:text-sage-700"
                                    >
                                        {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Loop Stats */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-sage-900 mb-4">Loop Statistics</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold text-sage-900">
                                        {loop.all_members?.length || 0}
                                    </div>
                                    <div className="text-sm text-gray-600">Members</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-sage-900">0</div>
                                    <div className="text-sm text-gray-600">Completed Loops</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-sage-900">
                                        {format(new Date(loop.created_at), 'MMM yyyy')}
                                    </div>
                                    <div className="text-sm text-gray-600">Created</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-sage-900">
                                        {loop.is_active ? 'Active' : 'Inactive'}
                                    </div>
                                    <div className="text-sm text-gray-600">Status</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-4">
                        {loop.all_members?.map((member) => (
                            <div key={member.id} className="card p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-sage-200 rounded-full flex items-center justify-center">
                                        {member.profiles?.avatar_url ? (
                                            <img
                                                src={member.profiles.avatar_url}
                                                alt={member.profiles.full_name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <Users className="h-5 w-5 text-sage-600" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sage-900">
                                            {member.profiles?.full_name || 'Unknown User'}
                                        </h4>
                                        <p className="text-sm text-gray-600">
                                            Joined {format(new Date(member.joined_at), 'MMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${member.role === 'admin'
                                            ? 'bg-sage-100 text-sage-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {member.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'updates' && (
                    <div className="text-center py-12">
                        <div className="max-w-md mx-auto">
                            <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Edit3 className="h-8 w-8 text-cream-700" />
                            </div>
                            <h3 className="text-xl font-semibold text-sage-900 mb-4">
                                No updates yet
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Updates will appear here after members submit their life moments
                            </p>
                            <button
                                onClick={() => router.push(`/loop/${loop.id}/submit`)}
                                className="btn-primary"
                            >
                                Submit First Update
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
} 