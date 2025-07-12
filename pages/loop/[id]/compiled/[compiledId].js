import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../lib/useAuth';
import Layout from '../../../../components/Layout';
import CompiledLoopView from '../../../../components/CompiledLoopView';
import { ArrowLeft, AlertCircle, Share2, Download, Mail } from 'lucide-react';

export default function CompiledLoopPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { id, compiledId } = router.query;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [compiledLoop, setCompiledLoop] = useState(null);
    const [loop, setLoop] = useState(null);
    const [updates, setUpdates] = useState([]);
    const [members, setMembers] = useState([]);

    useEffect(() => {
        if (id && compiledId && user) {
            fetchCompiledLoop();
        }
    }, [id, compiledId, user]);

    const fetchCompiledLoop = async () => {
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

            // Fetch the compiled loop
            const { data: compiledData, error: compiledError } = await supabase
                .from('compiled_loops')
                .select(`
          *,
          loop_cycles (
            id,
            cycle_number,
            start_date,
            end_date,
            loop_id
          )
        `)
                .eq('id', compiledId)
                .single();

            if (compiledError) {
                if (compiledError.code === 'PGRST116') {
                    setError('Compiled loop not found');
                } else {
                    throw compiledError;
                }
                return;
            }

            // Verify the compiled loop belongs to this loop
            if (compiledData.loop_cycles?.loop_id !== id) {
                setError('Compiled loop does not belong to this loop');
                return;
            }

            // Fetch updates for this cycle
            const { data: updatesData, error: updatesError } = await supabase
                .from('updates')
                .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
                .eq('loop_cycle_id', compiledData.loop_cycles.id)
                .order('submitted_at', { ascending: true });

            if (updatesError) throw updatesError;

            // Fetch all loop members
            const { data: membersData, error: membersError } = await supabase
                .from('loop_members')
                .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
                .eq('loop_id', id)
                .eq('is_active', true);

            if (membersError) throw membersError;

            setLoop(loopData);
            setCompiledLoop(compiledData);
            setUpdates(updatesData || []);
            setMembers(membersData || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: compiledLoop.title,
                    text: `Check out this beautiful newsletter from ${loop.name}`,
                    url: window.location.href,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            // Fallback to copying URL
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
            } catch (err) {
                console.error('Error copying to clipboard:', err);
            }
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
            {/* Navigation */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push(`/loop/${id}/archive`)}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Archive</span>
                    </button>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleShare}
                            className="btn-secondary flex items-center space-x-2"
                        >
                            <Share2 className="h-4 w-4" />
                            <span>Share</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="btn-secondary flex items-center space-x-2"
                        >
                            <Download className="h-4 w-4" />
                            <span>Print</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Compiled Loop Content */}
            <div className="print:shadow-none">
                <CompiledLoopView
                    compiledLoop={compiledLoop}
                    loop={loop}
                    updates={updates}
                    members={members}
                />
            </div>

            {/* Back to Loop Button */}
            <div className="max-w-4xl mx-auto mt-12 text-center print:hidden">
                <button
                    onClick={() => router.push(`/loop/${id}`)}
                    className="btn-primary"
                >
                    Back to Loop
                </button>
            </div>
        </Layout>
    );
} 