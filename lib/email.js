import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReminderEmail = async (recipient, loop, reminderData) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Loops <no-reply@loops.app>',
            to: recipient.email,
            subject: `💌 Time to share your update with ${loop.name}`,
            html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fdfcfb;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3c463a; font-size: 28px; margin-bottom: 10px;">Time for your Loop update!</h1>
            <p style="color: #6b7280; font-size: 16px;">Share what's been happening in your life</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08); margin-bottom: 30px;">
            <h2 style="color: #3c463a; font-size: 20px; margin-bottom: 15px;">${loop.name}</h2>
            ${loop.description ? `<p style="color: #6b7280; margin-bottom: 20px;">${loop.description}</p>` : ''}
            
            <div style="background: #f7f9f6; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h3 style="color: #3c463a; font-size: 16px; margin-bottom: 10px;">What to share:</h3>
              <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li>What's been happening in your life lately?</li>
                <li>Any exciting news or achievements?</li>
                <li>Photos from recent adventures or everyday moments</li>
                <li>Questions for your friends</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.NEXTAUTH_URL}/loop/${loop.id}/submit" 
                 style="display: inline-block; background: #708369; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Submit Your Update
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #9ca3af; font-size: 14px;">
            <p>This is a reminder from your ${loop.name} loop</p>
            <p>Made with 💝 by Loops</p>
          </div>
        </div>
      `,
        });

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error sending reminder email:', error);
        return { success: false, error: error.message };
    }
};

export const sendCompilationEmail = async (recipient, loop, compiledLoop) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Loops <no-reply@loops.app>',
            to: recipient.email,
            subject: `📖 Your ${loop.name} newsletter is ready!`,
            html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fdfcfb;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3c463a; font-size: 28px; margin-bottom: 10px;">Your newsletter is ready! 📖</h1>
            <p style="color: #6b7280; font-size: 16px;">A beautiful compilation of everyone's updates</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08); margin-bottom: 30px;">
            <h2 style="color: #3c463a; font-size: 20px; margin-bottom: 15px;">${compiledLoop.title}</h2>
            <p style="color: #6b7280; margin-bottom: 20px;">
              We've compiled all the wonderful updates from your ${loop.name} loop into a beautiful newsletter.
            </p>
            
            <div style="background: #f6ebdb; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h3 style="color: #9a6d40; font-size: 16px; margin-bottom: 10px;">What's inside:</h3>
              <ul style="color: #9a6d40; margin: 0; padding-left: 20px;">
                <li>Life updates from all your friends</li>
                <li>Beautiful photos and memories</li>
                <li>Stories and moments you won't want to miss</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.NEXTAUTH_URL}/loop/${loop.id}/compiled/${compiledLoop.id}" 
                 style="display: inline-block; background: #708369; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Read Your Newsletter
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #9ca3af; font-size: 14px;">
            <p>This newsletter was created from your ${loop.name} loop</p>
            <p>Made with 💝 by Loops</p>
          </div>
        </div>
      `,
        });

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error sending compilation email:', error);
        return { success: false, error: error.message };
    }
};

export const sendWelcomeEmail = async (recipient, loop) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Loops <no-reply@loops.app>',
            to: recipient.email,
            subject: `🎉 Welcome to ${loop.name}!`,
            html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fdfcfb;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3c463a; font-size: 28px; margin-bottom: 10px;">Welcome to ${loop.name}! 🎉</h1>
            <p style="color: #6b7280; font-size: 16px;">You're now part of this cozy friend group</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08); margin-bottom: 30px;">
            <h2 style="color: #3c463a; font-size: 20px; margin-bottom: 15px;">What is ${loop.name}?</h2>
            ${loop.description ? `<p style="color: #6b7280; margin-bottom: 20px;">${loop.description}</p>` : ''}
            
            <div style="background: #eef2ec; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h3 style="color: #3c463a; font-size: 16px; margin-bottom: 10px;">How it works:</h3>
              <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                <li>You'll get email reminders to share life updates</li>
                <li>After everyone submits, we compile them into a beautiful newsletter</li>
                <li>You'll receive the newsletter to read everyone's updates</li>
                <li>It's like having a private magazine made by your friends!</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.NEXTAUTH_URL}/loop/${loop.id}" 
                 style="display: inline-block; background: #708369; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Visit Your Loop
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #9ca3af; font-size: 14px;">
            <p>You joined the ${loop.name} loop</p>
            <p>Made with 💝 by Loops</p>
          </div>
        </div>
      `,
        });

        if (error) {
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return { success: false, error: error.message };
    }
}; 