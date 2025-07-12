import { supabase } from '../../lib/supabase';
import { sendCompilationEmail } from '../../lib/email';
import { format } from 'date-fns';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Get all active cycles that are ready for compilation
        const now = new Date();
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(now.getDate() - 3);

        const { data: cyclesToCompile, error: cyclesError } = await supabase
            .from('loop_cycles')
            .select(`
        *,
        loops (
          *,
          loop_members (
            id,
            user_id,
            profiles (
              email,
              full_name
            )
          )
        ),
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
      `)
            .eq('status', 'active')
            .lte('reminder_sent_at', threeDaysAgo.toISOString())
            .is('compilation_sent_at', null);

        if (cyclesError) throw cyclesError;

        const results = [];

        for (const cycle of cyclesToCompile) {
            try {
                // Check if we have enough updates (at least 50% of members)
                const totalMembers = cycle.loops.loop_members.length;
                const submittedUpdates = cycle.updates.length;
                const participationRate = totalMembers > 0 ? (submittedUpdates / totalMembers) : 0;

                // Skip if less than 50% participation and it's been less than a week
                const daysSinceReminder = Math.floor((now - new Date(cycle.reminder_sent_at)) / (1000 * 60 * 60 * 24));
                if (participationRate < 0.5 && daysSinceReminder < 7) {
                    continue;
                }

                // Skip if no updates at all
                if (submittedUpdates === 0) {
                    continue;
                }

                // Generate compilation title
                const compilationTitle = generateCompilationTitle(cycle.loops, cycle.cycle_number);

                // Create compiled loop content
                const compiledContent = {
                    loop: cycle.loops,
                    cycle: cycle,
                    updates: cycle.updates,
                    metadata: {
                        totalMembers,
                        submittedUpdates,
                        participationRate,
                        compiledAt: now.toISOString()
                    }
                };

                // Generate HTML content (simplified for now)
                const htmlContent = generateHTMLContent(compiledContent);

                // Create compiled loop record
                const { data: compiledLoop, error: compiledError } = await supabase
                    .from('compiled_loops')
                    .insert({
                        loop_cycle_id: cycle.id,
                        title: compilationTitle,
                        content: compiledContent,
                        html_content: htmlContent,
                        published_at: now.toISOString()
                    })
                    .select()
                    .single();

                if (compiledError) throw compiledError;

                // Send compilation emails to all members
                const emailPromises = cycle.loops.loop_members
                    .filter(member => member.profiles)
                    .map(async (member) => {
                        try {
                            const emailResult = await sendCompilationEmail(
                                member.profiles,
                                cycle.loops,
                                compiledLoop
                            );

                            // Log the email
                            await supabase
                                .from('email_logs')
                                .insert({
                                    recipient_id: member.user_id,
                                    email_type: 'compilation',
                                    loop_id: cycle.loops.id,
                                    loop_cycle_id: cycle.id,
                                    status: emailResult.success ? 'sent' : 'failed',
                                    error_message: emailResult.error || null
                                });

                            return {
                                recipient: member.profiles.email,
                                success: emailResult.success,
                                error: emailResult.error
                            };
                        } catch (error) {
                            console.error(`Failed to send compilation to ${member.profiles.email}:`, error);
                            return {
                                recipient: member.profiles.email,
                                success: false,
                                error: error.message
                            };
                        }
                    });

                const emailResults = await Promise.all(emailPromises);

                // Mark cycle as completed
                await supabase
                    .from('loop_cycles')
                    .update({
                        status: 'completed',
                        end_date: now.toISOString(),
                        compilation_sent_at: now.toISOString()
                    })
                    .eq('id', cycle.id);

                results.push({
                    loopId: cycle.loops.id,
                    loopName: cycle.loops.name,
                    cycleId: cycle.id,
                    compiledLoopId: compiledLoop.id,
                    compilationTitle,
                    participationRate,
                    emailResults
                });

            } catch (error) {
                console.error(`Error processing cycle ${cycle.id}:`, error);
                results.push({
                    loopId: cycle.loops?.id,
                    loopName: cycle.loops?.name,
                    cycleId: cycle.id,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            message: 'Compilations processed',
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Error in compile-loops:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

function generateCompilationTitle(loop, cycleNumber) {
    const now = new Date();
    const monthYear = format(now, 'MMMM yyyy');

    if (loop.frequency === 'weekly') {
        const weekOf = format(now, 'MMMM dd');
        return `${loop.name} - Week of ${weekOf}`;
    } else if (loop.frequency === 'monthly') {
        return `${loop.name} - ${monthYear}`;
    } else {
        return `${loop.name} - Update #${cycleNumber}`;
    }
}

function generateHTMLContent(compiledContent) {
    const { loop, cycle, updates } = compiledContent;

    // This is a simplified HTML generation
    // In a real app, you might want to use a proper template engine
    return `
    <html>
      <head>
        <title>${loop.name} Newsletter</title>
        <style>
          body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 40px; }
          .update { margin-bottom: 40px; padding: 20px; background: #f9f9f9; border-radius: 10px; }
          .author { font-weight: bold; color: #333; margin-bottom: 10px; }
          .content { line-height: 1.6; }
          .images { margin-top: 15px; }
          .images img { max-width: 100%; height: auto; border-radius: 5px; margin: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${loop.name}</h1>
          <p>${loop.description || ''}</p>
          <p><em>Cycle #${cycle.cycle_number} - ${format(new Date(), 'MMMM dd, yyyy')}</em></p>
        </div>
        
        ${updates.map(update => `
          <div class="update">
            <div class="author">${update.profiles.full_name}</div>
            <div class="content">${update.content.replace(/\n/g, '<br>')}</div>
            ${update.images && update.images.length > 0 ? `
              <div class="images">
                ${update.images.map(img => `<img src="${img}" alt="Update image">`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
        
        <div style="text-align: center; margin-top: 40px; color: #666;">
          <p>Made with 💝 by Loops</p>
        </div>
      </body>
    </html>
  `;
} 