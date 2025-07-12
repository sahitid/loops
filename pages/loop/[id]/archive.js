import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import Layout from '../../../components/Layout';
import {
    ArrowLeft,
    Calendar,
    Users,
    Eye,
    Archive,
    FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function LoopArchive() {
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    const [loop, setLoop] = useState(null);
    const [compiledLoops, setCompiledLoops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id && user) {
            fetchLoopAndArchive();
        }
    }, [id, user]);

    const fetchLoopAndArchive = async () => {
        try {
            // Check if user is a member of this loop
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

            // Fetch compiled loops
            const { data: compiledData, error: compiledError } = await supabase
                .from('compiled_loops')
                .select(`
          *,
          loop_cycles (
            id,
            cycle_number,
            start_date,
            end_date,
            updates (
              id,
              user_id,
              content,
              images,
              submitted_at,
              profiles (
                full_name
              )
            )
          )
        `)
                .eq('loop_cycles.loop_id', id)
                .order('created_at', { ascending: false });

            if (compiledError) throw compiledError;

            setLoop(loopData);
            setCompiledLoops(compiledData || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getPreviewText = (content) => {
        if (!content || !content.content) return '';

        // Get first update's content as preview
        const firstUpdate = content.content.updates?.[0];
        if (firstUpdate && firstUpdate.content) {
            return firstUpdate.content.length > 100
                ? firstUpdate.content.substring(0, 100) + '...'
                : firstUpdate.content;
        }
        return '';
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
                        <Archive className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push(`/loop/${id}`)}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Loop</span>
                    </button>
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">
                        {loop.name} Archive
                    </h1>
                    <p className="text-gray-600">
                        Browse through all the compiled newsletters from this loop
                    </p>
                </div>

                {/* Empty State */}
                {compiledLoops.length === 0 && (
                    <div className="text-center py-12">
                        <div className="max-w-md mx-auto">
                            <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Archive className="h-8 w-8 text-cream-700" />
                            </div>
                            <h3 className="text-xl font-semibold text-sage-900 mb-4">
                                No compiled loops yet
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Compiled newsletters will appear here after members submit their updates
                                and the loop cycle is completed.
                            </p>
                            <button
                                onClick={() => router.push(`/loop/${id}/submit`)}
                                className="btn-primary"
                            >
                                Submit Your First Update
                            </button>
                        </div>
                    </div>
                )}

                {/* Archive Grid */}
                {compiledLoops.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {compiledLoops.map((compiled) => (
                            <div key={compiled.id} className="card hover:shadow-cozy transition-shadow">
                                {/* Preview Image */}
                                <div className="h-48 bg-gradient-to-br from-sage-100 to-cream-100 rounded-t-2xl flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-soft">
                                            <FileText className="h-8 w-8 text-sage-600" />
                                        </div>
                                        <p className="text-sage-700 font-medium">
                                            Cycle #{compiled.loop_cycles?.cycle_number || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <h3 className="text-lg font-semibold text-sage-900 mb-2">
                                        {compiled.title}
                                    </h3>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <Calendar className="h-4 w-4" />
                                            <span>{format(new Date(compiled.created_at), 'MMM dd, yyyy')}</span>
                                        </div>
                                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                                            <Users className="h-4 w-4" />
                                            <span>{compiled.loop_cycles?.updates?.length || 0} updates</span>
                                        </div>
                                    </div>

                                    {/* Preview Text */}
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                                        {getPreviewText(compiled) || 'A beautiful collection of life updates from your friends.'}
                                    </p>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => router.push(`/loop/${id}/compiled/${compiled.id}`)}
                                        className="w-full btn-secondary flex items-center justify-center space-x-2"
                                    >
                                        <Eye className="h-4 w-4" />
                                        <span>View Newsletter</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Stats */}
                {compiledLoops.length > 0 && (
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="card p-6 text-center">
                            <div className="text-2xl font-bold text-sage-900 mb-2">
                                {compiledLoops.length}
                            </div>
                            <div className="text-sm text-gray-600">Compiled Loops</div>
                        </div>
                        <div className="card p-6 text-center">
                            <div className="text-2xl font-bold text-sage-900 mb-2">
                                {compiledLoops.reduce((total, comp) => total + (comp.loop_cycles?.updates?.length || 0), 0)}
                            </div>
                            <div className="text-sm text-gray-600">Total Updates</div>
                        </div>
                        <div className="card p-6 text-center">
                            <div className="text-2xl font-bold text-sage-900 mb-2">
                                {compiledLoops.length > 0 ? format(new Date(compiledLoops[compiledLoops.length - 1].created_at), 'MMM yyyy') : 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">First Loop</div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
} 