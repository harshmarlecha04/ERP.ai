import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EMAIL_TEMPLATES: Record<string, { subject: (po: string) => string; body: (name: string, po: string, extra?: string) => string }> = {
  PO_CREATED: {
    subject: (po) => `Your Purchase Order has been received – ${po}`,
    body: (name, po) => `
      <p>Hi ${name},</p>
      <p>Your purchase order <strong>${po}</strong> has been successfully added to our system.</p>
      <p>We're currently reviewing and scheduling production. You will receive another update once scheduling is complete.</p>
      <p>Thank you,<br/>Pharmvista Operations</p>
    `,
  },
  SCHEDULED: {
    subject: (po) => `Your Order ${po} has been scheduled`,
    body: (name, po, scheduleDate) => `
      <p>Hi ${name},</p>
      <p>Your order <strong>${po}</strong> has now been scheduled for production.</p>
      ${scheduleDate ? `<p><strong>Scheduled Date:</strong> ${scheduleDate}</p>` : ''}
      <p>We'll notify you once production is completed.</p>
      <p>Thank you,<br/>Pharmvista Operations</p>
    `,
  },
  PRODUCTION_COMPLETE: {
    subject: (po) => `Production completed for Order ${po}`,
    body: (name, po) => `
      <p>Hi ${name},</p>
      <p>Production for your order <strong>${po}</strong> is now complete.</p>
      <p>Our team is preparing your shipment / pickup.</p>
      <p>You'll receive another update when the order is ready.</p>
      <p>Thank you,<br/>Pharmvista Operations</p>
    `,
  },
  READY_FOR_PICKUP: {
    subject: (po) => `Order ${po} is ready for pickup`,
    body: (name, po) => `
      <p>Hi ${name},</p>
      <p>Your order <strong>${po}</strong> is now ready for pickup.</p>
      <p>Please coordinate with our logistics team to arrange collection.</p>
      <p>Thank you,<br/>Pharmvista Operations</p>
    `,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Role check: only admin or production_manager may dispatch order emails
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', claimsData.claims.sub)
      .in('role', ['admin', 'production_manager']);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, event_type, schedule_date } = await req.json();

    if (!order_id || !event_type || !EMAIL_TEMPLATES[event_type]) {
      return new Response(JSON.stringify({ error: 'Invalid order_id or event_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize schedule_date to prevent HTML injection in email body
    const escapeHtml = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const safeScheduleDate = schedule_date ? escapeHtml(schedule_date).slice(0, 64) : undefined;

    // Use service role for DB operations
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch order + customer
    const { data: order, error: orderError } = await serviceClient
      .from('order_headers')
      .select('id, po_number, order_number, customer_id, customers(company_name, email, contact_person)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customer = (order as any).customers;
    const recipientEmail = customer?.email;
    const customerName = customer?.contact_person || customer?.company_name || 'Valued Customer';
    const poNumber = order.po_number || order.order_number;

    // If no email, log as skipped
    if (!recipientEmail) {
      await serviceClient.from('email_events').upsert({
        order_id,
        event_type,
        recipient_email: 'none',
        status: 'skipped',
        error_message: 'Customer email not configured',
      }, { onConflict: 'order_id,event_type,recipient_email' });

      return new Response(JSON.stringify({ status: 'skipped', reason: 'No customer email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicate
    const { data: existing } = await serviceClient
      .from('email_events')
      .select('id')
      .eq('order_id', order_id)
      .eq('event_type', event_type)
      .eq('recipient_email', recipientEmail)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build email
    const template = EMAIL_TEMPLATES[event_type];
    const subject = template.subject(poNumber);
    const bodyContent = template.body(escapeHtml(customerName), escapeHtml(poNumber), safeScheduleDate);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: #2563eb; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px;">Pharmvista Operations</h1>
            </div>
            <div style="padding: 24px;">
              ${bodyContent}
            </div>
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from Pharmvista Operations.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      await serviceClient.from('email_events').insert({
        order_id,
        event_type,
        recipient_email: recipientEmail,
        status: 'skipped',
        error_message: 'RESEND_API_KEY missing',
      });
      return new Response(JSON.stringify({ ok: false, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pharmvista Operations <onboarding@resend.dev>',
        to: [recipientEmail],
        subject,
        html: emailHtml,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendResult);
      await serviceClient.from('email_events').insert({
        order_id,
        event_type,
        recipient_email: recipientEmail,
        status: 'failed',
        error_message: resendResult?.message || JSON.stringify(resendResult),
      });
      return new Response(JSON.stringify({ status: 'failed', error: resendResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log success
    await serviceClient.from('email_events').insert({
      order_id,
      event_type,
      recipient_email: recipientEmail,
      status: 'sent',
    });

    console.log(`Email sent: ${event_type} for order ${poNumber} to ${recipientEmail}`);

    return new Response(JSON.stringify({ status: 'sent', emailId: resendResult.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-order-email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
