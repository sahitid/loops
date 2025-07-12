import { format } from 'date-fns';
import { Heart, Calendar, Users } from 'lucide-react';

export default function CompiledLoopView({ compiledLoop, loop, updates, members }) {
    const getUpdateAuthor = (userId) => {
        const member = members.find(m => m.user_id === userId);
        return member?.profiles?.full_name || 'Unknown';
    };

    const getUpdateAuthorInitials = (userId) => {
        const name = getUpdateAuthor(userId);
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-sage-200 rounded-full mb-6">
                    <Heart className="h-8 w-8 text-sage-600" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-sage-900 mb-4">
                    {compiledLoop.title}
                </h1>
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(compiledLoop.created_at), 'MMMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{updates.length} updates</span>
                    </div>
                </div>
            </div>

            {/* Loop Info */}
            <div className="card-cozy p-8 mb-8 text-center">
                <h2 className="text-2xl font-semibold text-sage-900 mb-2">{loop.name}</h2>
                {loop.description && (
                    <p className="text-gray-600 mb-4">{loop.description}</p>
                )}
                <p className="text-sm text-sage-700">
                    A collection of life updates from {members.length} friends
                </p>
            </div>

            {/* Updates */}
            <div className="space-y-12">
                {updates.map((update, index) => (
                    <article key={update.id} className="prose-cozy">
                        {/* Author Header */}
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="w-12 h-12 bg-sage-200 rounded-full flex items-center justify-center">
                                <span className="text-sage-700 font-medium text-sm">
                                    {getUpdateAuthorInitials(update.user_id)}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-sage-900 mb-1">
                                    {getUpdateAuthor(update.user_id)}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {format(new Date(update.submitted_at), 'MMMM dd, yyyy')}
                                </p>
                            </div>
                        </div>

                        {/* Update Content */}
                        <div className="bg-white rounded-2xl p-8 shadow-soft border border-warm-200">
                            {/* Images */}
                            {update.images && update.images.length > 0 && (
                                <div className="mb-6">
                                    {update.images.length === 1 ? (
                                        <img
                                            src={update.images[0]}
                                            alt="Update photo"
                                            className="w-full h-64 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className={`grid gap-3 ${update.images.length === 2 ? 'grid-cols-2' :
                                                update.images.length === 3 ? 'grid-cols-3' :
                                                    'grid-cols-2'
                                            }`}>
                                            {update.images.slice(0, 4).map((image, imgIndex) => (
                                                <div key={imgIndex} className="relative">
                                                    <img
                                                        src={image}
                                                        alt={`Update photo ${imgIndex + 1}`}
                                                        className="w-full h-32 object-cover rounded-lg"
                                                    />
                                                    {imgIndex === 3 && update.images.length > 4 && (
                                                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                                            <span className="text-white font-medium">
                                                                +{update.images.length - 4}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text Content */}
                            <div className="prose prose-lg max-w-none">
                                {update.content.split('\n').map((paragraph, pIndex) => (
                                    <p key={pIndex} className="text-gray-700 leading-relaxed">
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {/* Separator */}
                        {index < updates.length - 1 && (
                            <div className="flex items-center justify-center mt-12">
                                <div className="w-1 h-1 bg-sage-300 rounded-full"></div>
                                <div className="w-8 h-px bg-sage-300 mx-3"></div>
                                <div className="w-1 h-1 bg-sage-300 rounded-full"></div>
                            </div>
                        )}
                    </article>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-16 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-cream-200 rounded-full mb-4">
                    <Heart className="h-6 w-6 text-cream-700" />
                </div>
                <p className="text-gray-600">
                    Made with love by the {loop.name} loop
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    {format(new Date(compiledLoop.created_at), 'MMMM yyyy')}
                </p>
            </div>
        </div>
    );
} 