import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import Layout from '../components/Layout';
import { Plus, Users, Calendar, Clock, ArrowRight, Heart } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [loops, setLoops] = useState([]);
  const [loopsLoading, setLoopsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserLoops();
    }
  }, [user]);

  const fetchUserLoops = async () => {
    try {
      const { data, error } = await supabase
        .from('loops')
        .select(`
          *,
          loop_members!inner (
            id,
            role,
            user_id,
            profiles (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('loop_members.user_id', user.id)
        .eq('loop_members.is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoops(data || []);
    } catch (error) {
      console.error('Error fetching loops:', error);
    } finally {
      setLoopsLoading(false);
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
      return format(new Date(nextReminderDate), 'MMM dd, yyyy');
    } catch {
      return 'Not scheduled';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-sage-900 mb-2">
            Welcome back to your loops
          </h1>
          <p className="text-gray-600 text-lg">
            Stay connected with your closest friends through shared moments
          </p>
        </div>

        {/* Empty state */}
        {!loopsLoading && loops.length === 0 && (
          <div className="text-center py-12">
            <div className="card-cozy p-12 max-w-md mx-auto">
              <div className="w-16 h-16 bg-sage-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="h-8 w-8 text-sage-600" />
              </div>
              <h3 className="text-xl font-semibold text-sage-900 mb-4">
                Start your first loop
              </h3>
              <p className="text-gray-600 mb-6">
                Create a private space to share life updates with your friends,
                or join an existing loop with an invite code.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/create-loop')}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Your First Loop</span>
                </button>
                <button
                  onClick={() => router.push('/join-loop')}
                  className="w-full btn-secondary flex items-center justify-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Join with Invite Code</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loopsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        )}

        {/* Loops grid */}
        {!loopsLoading && loops.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {loops.map((loop) => (
                <div key={loop.id} className="card hover:shadow-cozy transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-sage-900 mb-2">
                          {loop.name}
                        </h3>
                        {loop.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {loop.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 text-gray-500">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">{loop.loop_members?.length || 0}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{getFrequencyText(loop.frequency, loop.custom_frequency_days)}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>Next: {getNextReminderText(loop.next_reminder_date)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/loop/${loop.id}`)}
                      className="w-full btn-secondary flex items-center justify-center space-x-2 hover:bg-sage-100"
                    >
                      <span>View Loop</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/create-loop')}
                className="btn-primary flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Loop</span>
              </button>
              <button
                onClick={() => router.push('/join-loop')}
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>Join with Invite Code</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
