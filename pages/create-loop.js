import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import Layout from '../components/Layout';
import { ArrowLeft, Users, Calendar, Clock, AlertCircle } from 'lucide-react';

export default function CreateLoop() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        frequency: 'weekly',
        customFrequencyDays: '',
        reminderDay: '1',
        reminderTime: '09:00'
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const generateInviteCode = () => {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    };

    const calculateNextReminder = () => {
        const now = new Date();
        const nextReminder = new Date(now);

        if (formData.frequency === 'weekly') {
            const targetDay = parseInt(formData.reminderDay);
            const currentDay = now.getDay();
            const daysUntilTarget = (targetDay - currentDay + 7) % 7;
            if (daysUntilTarget === 0) {
                nextReminder.setDate(now.getDate() + 7);
            } else {
                nextReminder.setDate(now.getDate() + daysUntilTarget);
            }
        } else if (formData.frequency === 'monthly') {
            nextReminder.setMonth(now.getMonth() + 1);
            nextReminder.setDate(1);
        } else if (formData.frequency === 'custom') {
            const customDays = parseInt(formData.customFrequencyDays);
            nextReminder.setDate(now.getDate() + customDays);
        }

        const [hours, minutes] = formData.reminderTime.split(':');
        nextReminder.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        return nextReminder;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Validate form
            if (!formData.name.trim()) {
                throw new Error('Loop name is required');
            }
            if (formData.frequency === 'custom' && (!formData.customFrequencyDays || formData.customFrequencyDays < 1)) {
                throw new Error('Custom frequency must be at least 1 day');
            }

            const inviteCode = generateInviteCode();
            const nextReminderDate = calculateNextReminder();

            // Create loop
            const { data: loop, error: loopError } = await supabase
                .from('loops')
                .insert({
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    created_by: user.id,
                    invite_code: inviteCode,
                    frequency: formData.frequency,
                    custom_frequency_days: formData.frequency === 'custom' ? parseInt(formData.customFrequencyDays) : null,
                    reminder_day: formData.frequency === 'weekly' ? parseInt(formData.reminderDay) : null,
                    reminder_time: formData.reminderTime,
                    next_reminder_date: nextReminderDate.toISOString()
                })
                .select()
                .single();

            if (loopError) throw loopError;

            // Add creator as admin member
            const { error: memberError } = await supabase
                .from('loop_members')
                .insert({
                    loop_id: loop.id,
                    user_id: user.id,
                    role: 'admin'
                });

            if (memberError) throw memberError;

            // Redirect to loop page
            router.push(`/loop/${loop.id}`);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">Create a New Loop</h1>
                    <p className="text-gray-600">
                        Start a private space for friends to share life updates
                    </p>
                </div>

                {/* Form */}
                <div className="card p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Loop Name */}
                        <div>
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Loop Name *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="e.g., College Friends, Family Updates"
                                required
                            />
                        </div>

                        {/* Description */}
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
                                placeholder="What's this loop about? (optional)"
                            />
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Update Frequency
                            </label>
                            <div className="space-y-3">
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="radio"
                                        name="frequency"
                                        value="weekly"
                                        checked={formData.frequency === 'weekly'}
                                        onChange={handleInputChange}
                                        className="text-sage-600"
                                    />
                                    <div>
                                        <span className="font-medium">Weekly</span>
                                        <p className="text-sm text-gray-600">Perfect for close friends</p>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="radio"
                                        name="frequency"
                                        value="monthly"
                                        checked={formData.frequency === 'monthly'}
                                        onChange={handleInputChange}
                                        className="text-sage-600"
                                    />
                                    <div>
                                        <span className="font-medium">Monthly</span>
                                        <p className="text-sm text-gray-600">Great for family updates</p>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3">
                                    <input
                                        type="radio"
                                        name="frequency"
                                        value="custom"
                                        checked={formData.frequency === 'custom'}
                                        onChange={handleInputChange}
                                        className="text-sage-600"
                                    />
                                    <div>
                                        <span className="font-medium">Custom</span>
                                        <p className="text-sm text-gray-600">Set your own schedule</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Custom Frequency */}
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
                                    placeholder="Number of days"
                                />
                            </div>
                        )}

                        {/* Reminder Day (for weekly) */}
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

                        {/* Reminder Time */}
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

                        {/* Error */}
                        {error && (
                            <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-200 rounded-lg">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating Loop...' : 'Create Loop'}
                        </button>
                    </form>
                </div>

                {/* Info */}
                <div className="mt-8 p-6 bg-sage-50 rounded-lg border border-sage-200">
                    <h3 className="font-semibold text-sage-900 mb-2">What happens next?</h3>
                    <ul className="text-sm text-sage-700 space-y-1">
                        <li>• You'll get a unique invite code to share with friends</li>
                        <li>• Everyone will receive email reminders to submit updates</li>
                        <li>• After submissions, we'll compile them into a beautiful newsletter</li>
                        <li>• You can adjust settings anytime as the loop admin</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
} 