import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import Layout from '../../../components/Layout';
import {
    ArrowLeft,
    Upload,
    X,
    Image as ImageIcon,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export default function SubmitUpdate() {
    const { user } = useAuth();
    const router = useRouter();
    const { id } = router.query;

    const [loop, setLoop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [content, setContent] = useState('');
    const [images, setImages] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);

    useEffect(() => {
        if (id && user) {
            fetchLoop();
        }
    }, [id, user]);

    const fetchLoop = async () => {
        try {
            // Check if user is a member of this loop
            const { data, error } = await supabase
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

            if (error) {
                if (error.code === 'PGRST116') {
                    setError('Loop not found or you do not have access');
                } else {
                    throw error;
                }
                return;
            }

            setLoop(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const uploadImage = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `loop-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('loops-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('loops-images')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const handleImageUpload = async (acceptedFiles) => {
        if (images.length + acceptedFiles.length > 5) {
            setError('You can only upload up to 5 images');
            return;
        }

        setUploadingImages(true);
        setError('');

        try {
            const uploadPromises = acceptedFiles.map(uploadImage);
            const imageUrls = await Promise.all(uploadPromises);

            setImages(prev => [...prev, ...imageUrls]);
        } catch (err) {
            setError('Failed to upload images. Please try again.');
        } finally {
            setUploadingImages(false);
        }
    };

    const removeImage = (indexToRemove) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: handleImageUpload,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
        },
        maxFiles: 5,
        disabled: uploadingImages || images.length >= 5
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!content.trim()) {
            setError('Please write something to share');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // Get or create current loop cycle
            const { data: cycle, error: cycleError } = await supabase
                .from('loop_cycles')
                .select('*')
                .eq('loop_id', id)
                .eq('status', 'active')
                .single();

            let cycleId;
            if (cycleError && cycleError.code === 'PGRST116') {
                // Create new cycle
                const { data: newCycle, error: newCycleError } = await supabase
                    .from('loop_cycles')
                    .insert({
                        loop_id: id,
                        cycle_number: 1,
                        start_date: new Date().toISOString(),
                        status: 'active'
                    })
                    .select()
                    .single();

                if (newCycleError) throw newCycleError;
                cycleId = newCycle.id;
            } else if (cycleError) {
                throw cycleError;
            } else {
                cycleId = cycle.id;
            }

            // Check if user already submitted for this cycle
            const { data: existingUpdate } = await supabase
                .from('updates')
                .select('id')
                .eq('loop_cycle_id', cycleId)
                .eq('user_id', user.id)
                .single();

            if (existingUpdate) {
                // Update existing submission
                const { error: updateError } = await supabase
                    .from('updates')
                    .update({
                        content: content.trim(),
                        images: images,
                        submitted_at: new Date().toISOString()
                    })
                    .eq('id', existingUpdate.id);

                if (updateError) throw updateError;
            } else {
                // Create new submission
                const { error: insertError } = await supabase
                    .from('updates')
                    .insert({
                        loop_cycle_id: cycleId,
                        user_id: user.id,
                        content: content.trim(),
                        images: images
                    });

                if (insertError) throw insertError;
            }

            setSuccess('Your update has been submitted successfully!');

            // Redirect back to loop after a short delay
            setTimeout(() => {
                router.push(`/loop/${id}`);
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
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

    if (error && !loop) {
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
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push(`/loop/${id}`)}
                        className="flex items-center space-x-2 text-sage-600 hover:text-sage-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Loop</span>
                    </button>
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">Share Your Update</h1>
                    <p className="text-gray-600">
                        Tell your friends what's been happening in your life
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="card p-8">
                        {/* Content Input */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                What's been going on in your life?
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows="6"
                                className="input-field resize-none"
                                placeholder="Share your thoughts, experiences, achievements, or just what's on your mind..."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {content.length}/2000 characters
                            </p>
                        </div>

                        {/* Image Upload */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-sage-700 mb-2">
                                Add Photos (optional)
                            </label>

                            {/* Dropzone */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive
                                        ? 'border-sage-400 bg-sage-50'
                                        : 'border-gray-300 hover:border-sage-400'
                                    } ${uploadingImages || images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <input {...getInputProps()} />
                                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">
                                    {uploadingImages
                                        ? 'Uploading...'
                                        : isDragActive
                                            ? 'Drop images here'
                                            : 'Drag & drop images here, or click to select'
                                    }
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Up to 5 images • JPG, PNG, GIF, WebP
                                </p>
                            </div>

                            {/* Image Preview */}
                            {images.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {images.map((image, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={image}
                                                alt={`Upload ${index + 1}`}
                                                className="w-full h-24 object-cover rounded-lg"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center space-x-2 p-3 bg-red-100 border border-red-200 rounded-lg mb-6">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {/* Success */}
                        {success && (
                            <div className="flex items-center space-x-2 p-3 bg-green-100 border border-green-200 rounded-lg mb-6">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700">{success}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting || uploadingImages || !content.trim()}
                            className="w-full btn-primary py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : 'Submit Update'}
                        </button>
                    </div>
                </form>

                {/* Tips */}
                <div className="mt-8 p-6 bg-sage-50 rounded-lg border border-sage-200">
                    <h3 className="font-semibold text-sage-900 mb-2">Tips for great updates</h3>
                    <ul className="text-sm text-sage-700 space-y-1">
                        <li>• Share what's genuinely meaningful to you</li>
                        <li>• Include photos to make your update more engaging</li>
                        <li>• Ask questions to spark conversation</li>
                        <li>• Be authentic - your friends want to know the real you</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
} 