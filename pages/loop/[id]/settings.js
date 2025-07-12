import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import Layout from '../../../components/Layout';
import {
    ArrowLeft,
    Edit3,
    Users,
    Mail,
    Settings,
    Trash2,
    UserX,
    Crown,
    AlertCircle,
    CheckCircle,
    Play,
    Pause
} from 'lucide-react';

export default function LoopSettings() {
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    const [loop, setLoop] = useState(null);
    const [members, setMembers] = useState([]);
    const [emailLogs, setEmailLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [updating, setUpdating] = useState(false);
    const [userRole, setUserRole] = useState('member');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        frequency: 'weekly',
        customFrequencyDays: '',
        reminderDay: '1',
        reminderTime: '09:00',
        isActive: true
    });

    useEffect(() => {
        if (id && user) {
            fetchLoopDetails();
        }
    }, [id, user]);

    const fetchLoopDetails = async () => {
        try {
            // Check if user is an admin of this loop
            const { data: loopData, error: loopError } = await supabase
                .from('loops')
                .select(`
          *,
          loop_members!inner (
            id,
            role,
            user_id
          )
        `)
                .eq('id', id)
                .eq('loop_members.user_id', user.id)
                .eq('loop_members.is_active', true)
                .single();

            if (loopError) {
                if (loopError.code === 'PGRST116') {
                    setError('Loop not found or you do not have access');
                } else {
                    throw loopError;
                }
                return;
            }

            const userMember = loopData.loop_members.find(m => m.user_id === user.id);
            setUserRole(userMember?.role || 'member');

            if (userMember?.role !== 'admin') {
                setError('You do not have admin access to this loop');
                return;
            }

            // Fetch all members
            const { data: membersData, error: membersError } = await supabase
                .from('loop_members')
                .select(`
          *,
          profiles (
            full_name,
            email,
            avatar_url
          )
        `)
                .eq('loop_id', id)
                .eq('is_active', true)
                .order('joined_at', { ascending: true });

            if (membersError) throw membersError;

            // Fetch recent email logs
            const { data: emailData, error: emailError } = await supabase
                .from('email_logs')
                .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
                .eq('loop_id', id)
                .order('sent_at', { ascending: false })
                .limit(20);

            if (emailError) throw emailError;

            setLoop(loopData);
            setMembers(membersData || []);
            setEmailLogs(emailData || []);

            // Set form data
            setFormData({
                name: loopData.name,
                description: loopData.description || '',
                frequency: loopData.frequency,
                customFrequencyDays: loopData.custom_frequency_days || '',
                reminderDay: loopData.reminder_day?.toString() || '1',
                reminderTime: loopData.reminder_time || '09:00',
                isActive: loopData.is_active
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleUpdateLoop = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setError('');
        setSuccess('');

        try {
            const { error } = await supabase
                .from('loops')
                .update({
                    name: formData.name,
                    description: formData.description,
                    frequency: formData.frequency,
                    custom_frequency_days: formData.frequency === 'custom' ? parseInt(formData.customFrequencyDays) : null,
                    reminder_day: formData.frequency === 'weekly' ? parseInt(formData.reminderDay) : null,
                    reminder_time: formData.reminderTime,
                    is_active: formData.isActive
                })
                .eq('id', id);

            if (error) throw error;

            setSuccess('Loop settings updated successfully!');
            setLoop(prev => ({ ...prev, ...formData }));
        } catch (err) {
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleRemoveMember = async (memberId, memberName) => {
        if (!confirm(`Are you sure you want to remove ${memberName} from this loop?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('loop_members')
                .update({ is_active: false })
                .eq('id', memberId);

            if (error) throw error;

            setMembers(prev => prev.filter(m => m.id !== memberId));
            setSuccess(`${memberName} has been removed from the loop`);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleMakeAdmin = async (memberId, memberName) => {
        if (!confirm(`Are you sure you want to make ${memberName} an admin?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('loop_members')
                .update({ role: 'admin' })
                .eq('id', memberId);

            if (error) throw error;

            setMembers(prev => prev.map(m =>
                m.id === memberId ? { ...m, role: 'admin' } : m
            ));
            setSuccess(`${memberName} is now an admin`);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSendTestReminder = async () => {
        setUpdating(true);
        try {
            const response = await fetch('/api/send-reminders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ loopId: id, test: true })
            });

            if (!response.ok) throw new Error('Failed to send test reminder');

            setSuccess('Test reminder sent successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setUpdating(false);
        }
    };

    const dayOptions = [
        { value: '1', label: 'Monday' },
        { value: '2', label: 'Tuesday' },
        { value: '3', label: 'Wednesday' },
        { value: '4', label: 'Thursday' },
        { value: '5', label: 'Friday' },
        { value: '6', label: 'Saturday' },
        { value: '0', label: 'Sunday' },
    ];

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
                </div>
            </Layout>
        );
    }

    if (error && !loop) {
        return (
            <Layout>
                <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <button
                            onClick={() => router.push(`/loop/${id}`)}
                            className="btn-primary"
                        >
                            Back to Loop
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
                        onClick={() => router.push(`/loop/${id}`)}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Loop</span>
                    </button>
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">Loop Settings</h1>
                    <p className="text-gray-600">Manage {loop?.name} settings and members</p>
                </div>

                {/* Tabs */}
                <div className="border-b border-warm-200 mb-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'general'
                                    ? 'border-sage-500 text-sage-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            General
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
                            onClick={() => setActiveTab('emails')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'emails'
                                    ? 'border-sage-500 text-sage-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Email Logs
                        </button>
                    </nav>
                </div>

                {/* Messages */}
                {error && (
                    <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-200 rounded-lg mb-6">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-700">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="flex items-center space-x-2 p-3 bg-green-100 border border-green-200 rounded-lg mb-6">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">{success}</span>
                    </div>
                )}

                {/* Tab Content */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        {/* Loop Status */}
                        <div className="card p-6">
                            <h3 className="text-lg font-semibold text-sage-900 mb-4">Loop Status</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600">
                                        Loop is currently {loop?.is_active ? 'active' : 'paused'}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {loop?.is_active ? (
                                        <Pause className="h-5 w-5 text-orange-500" />
                                    ) : (
                                        <Play className="h-5 w-5 text-green-500" />
                                    )}
                                    <span className={`px-2 py-1 text-xs rounded-full ${loop?.is_active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-orange-100 text-orange-800'
                                        }`}>
                                        {loop?.is_active ? 'Active' : 'Paused'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* General Settings Form */}
                        <div className="card p-6">
                            <h3 className="text-lg font-semibold text-sage-900 mb-4">General Settings</h3>
                            <form onSubmit={handleUpdateLoop} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Loop Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="input-field"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        rows="3"
                                        className="input-field resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Update Frequency
                                    </label>
                                    <div className="space-y-2">
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="radio"
                                                name="frequency"
                                                value="weekly"
                                                checked={formData.frequency === 'weekly'}
                                                onChange={handleInputChange}
                                                className="text-sage-600"
                                            />
                                            <span>Weekly</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="radio"
                                                name="frequency"
                                                value="monthly"
                                                checked={formData.frequency === 'monthly'}
                                                onChange={handleInputChange}
                                                className="text-sage-600"
                                            />
                                            <span>Monthly</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="radio"
                                                name="frequency"
                                                value="custom"
                                                checked={formData.frequency === 'custom'}
                                                onChange={handleInputChange}
                                                className="text-sage-600"
                                            />
                                            <span>Custom</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.frequency === 'custom' && (
                                    <div>
                                        <label className="block text-sm font-medium text-sage-700 mb-2">
                                            Every how many days?
                                        </label>
                                        <input
                                            type="number"
                                            name="customFrequencyDays"
                                            value={formData.customFrequencyDays}
                                            onChange={handleInputChange}
                                            min="1"
                                            max="365"
                                            className="input-field"
                                        />
                                    </div>
                                )}

                                {formData.frequency === 'weekly' && (
                                    <div>
                                        <label className="block text-sm font-medium text-sage-700 mb-2">
                                            Reminder Day
                                        </label>
                                        <select
                                            name="reminderDay"
                                            value={formData.reminderDay}
                                            onChange={handleInputChange}
                                            className="input-field"
                                        >
                                            {dayOptions.map(day => (
                                                <option key={day.value} value={day.value}>
                                                    {day.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Reminder Time
                                    </label>
                                    <input
                                        type="time"
                                        name="reminderTime"
                                        value={formData.reminderTime}
                                        onChange={handleInputChange}
                                        className="input-field"
                                    />
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleInputChange}
                                        className="text-sage-600"
                                    />
                                    <label className="text-sm text-sage-700">
                                        Loop is active (members will receive reminders)
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updating ? 'Updating...' : 'Update Settings'}
                                </button>
                            </form>
                        </div>

                        {/* Quick Actions */}
                        <div className="card p-6">
                            <h3 className="text-lg font-semibold text-sage-900 mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={handleSendTestReminder}
                                    disabled={updating}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Send Test Reminder
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="space-y-4">
                        {members.map((member) => (
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
                                            {member.profiles?.email}
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

                                    {member.user_id !== user.id && (
                                        <div className="flex items-center space-x-1">
                                            {member.role === 'member' && (
                                                <button
                                                    onClick={() => handleMakeAdmin(member.id, member.profiles?.full_name)}
                                                    className="p-1 text-sage-600 hover:text-sage-700"
                                                    title="Make admin"
                                                >
                                                    <Crown className="h-4 w-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRemoveMember(member.id, member.profiles?.full_name)}
                                                className="p-1 text-red-600 hover:text-red-700"
                                                title="Remove member"
                                            >
                                                <UserX className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'emails' && (
                    <div className="space-y-4">
                        {emailLogs.length === 0 ? (
                            <div className="text-center py-8">
                                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">No email logs yet</p>
                            </div>
                        ) : (
                            emailLogs.map((log) => (
                                <div key={log.id} className="card p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <span className="font-medium text-sage-900">
                                                {log.email_type === 'reminder' ? 'Reminder' : 'Compilation'}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${log.status === 'sent'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {log.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>To: {log.profiles?.full_name} ({log.profiles?.email})</p>
                                        <p>Sent: {new Date(log.sent_at).toLocaleString()}</p>
                                        {log.error_message && (
                                            <p className="text-red-600 mt-1">Error: {log.error_message}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
} 