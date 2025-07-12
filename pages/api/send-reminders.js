import { supabase } from '../../lib/supabase';
import { sendReminderEmail } from '../../lib/email';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Get all active loops that need reminders
        const now = new Date();
        const { data: loopsToRemind, error: loopsError } = await supabase
            .from('loops')
            .select(`
        *,
        loop_members (
          id,
          user_id,
          profiles (
            email,
            full_name
          )
        )
      `)
            .eq('is_active', true)
            .lte('next_reminder_date', now.toISOString());

        if (loopsError) throw loopsError;

        const results = [];

        for (const loop of loopsToRemind) {
            try {
                // Get or create active cycle for this loop
                let { data: cycle, error: cycleError } = await supabase
                    .from('loop_cycles')
                    .select('*')
                    .eq('loop_id', loop.id)
                    .eq('status', 'active')
                    .single();

                if (cycleError && cycleError.code === 'PGRST116') {
                    // Create new cycle
                    const cycleNumber = await getNextCycleNumber(loop.id);
                    const { data: newCycle, error: newCycleError } = await supabase
                        .from('loop_cycles')
                        .insert({
                            loop_id: loop.id,
                            cycle_number: cycleNumber,
                            start_date: now.toISOString(),
                            status: 'active'
                        })
                        .select()
                        .single();

                    if (newCycleError) throw newCycleError;
                    cycle = newCycle;
                } else if (cycleError) {
                    throw cycleError;
                }

                // Send reminder emails to all active members
                const emailPromises = loop.loop_members
                    .filter(member => member.profiles)
                    .map(async (member) => {
                        try {
                            const emailResult = await sendReminderEmail(
                                member.profiles,
                                loop,
                                { cycleId: cycle.id }
                            );

                            // Log the email
                            await supabase
                                .from('email_logs')
                                .insert({
                                    recipient_id: member.user_id,
                                    email_type: 'reminder',
                                    loop_id: loop.id,
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
                            console.error(`Failed to send reminder to ${member.profiles.email}:`, error);
                            return {
                                recipient: member.profiles.email,
                                success: false,
                                error: error.message
                            };
                        }
                    });

                const emailResults = await Promise.all(emailPromises);

                // Update loop's next reminder date
                const nextReminderDate = calculateNextReminderDate(loop);
                await supabase
                    .from('loops')
                    .update({
                        next_reminder_date: nextReminderDate.toISOString()
                    })
                    .eq('id', loop.id);

                // Mark cycle as reminder sent
                await supabase
                    .from('loop_cycles')
                    .update({
                        reminder_sent_at: now.toISOString()
                    })
                    .eq('id', cycle.id);

                results.push({
                    loopId: loop.id,
                    loopName: loop.name,
                    cycleId: cycle.id,
                    emailResults,
                    nextReminderDate: nextReminderDate.toISOString()
                });

            } catch (error) {
                console.error(`Error processing loop ${loop.id}:`, error);
                results.push({
                    loopId: loop.id,
                    loopName: loop.name,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            message: 'Reminders processed',
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Error in send-reminders:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

async function getNextCycleNumber(loopId) {
    const { data, error } = await supabase
        .from('loop_cycles')
        .select('cycle_number')
        .eq('loop_id', loopId)
        .order('cycle_number', { ascending: false })
        .limit(1);

    if (error) throw error;

    return data.length > 0 ? data[0].cycle_number + 1 : 1;
}

function calculateNextReminderDate(loop) {
    const now = new Date();
    const nextReminder = new Date(now);

    if (loop.frequency === 'weekly') {
        const targetDay = loop.reminder_day || 1;
        const currentDay = now.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        if (daysUntilTarget === 0) {
            nextReminder.setDate(now.getDate() + 7);
        } else {
            nextReminder.setDate(now.getDate() + daysUntilTarget);
        }
    } else if (loop.frequency === 'monthly') {
        nextReminder.setMonth(now.getMonth() + 1);
        nextReminder.setDate(1);
    } else if (loop.frequency === 'custom') {
        const customDays = loop.custom_frequency_days || 7;
        nextReminder.setDate(now.getDate() + customDays);
    }

    // Set the time
    const [hours, minutes] = (loop.reminder_time || '09:00').split(':');
    nextReminder.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    return nextReminder;
} 