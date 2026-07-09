import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InventoryAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details: {
    raw_material_id: string;
    material_code: string;
    material_name: string;
    supplier?: string;
    current_quantity_kg: number;
    min_quantity_kg: number;
    reorder_quantity_kg: number;
    message: string;
  };
  created_at: string;
}

interface User {
  id: string;
  email: string;
  full_name?: string;
  roles: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication - require valid JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Create a client with the user's JWT to verify they're authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    });

    // Verify the user is authenticated and has appropriate role
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin or production_manager role
    const { data: userRoles, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'production_manager']);

    if (roleError || !userRoles || userRoles.length === 0) {
      console.error("User does not have required role:", user.email);
      return new Response(JSON.stringify({ error: "Forbidden - requires admin or production_manager role" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authorized user ${user.email} with roles:`, userRoles.map(r => r.role));

    // Use service role for sending emails (needs to read all users and alerts)
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    // Get unacknowledged critical and high severity alerts
    const { data: alerts, error: alertsError } = await supabaseClient
      .from('security_alerts')
      .select('*')
      .eq('alert_type', 'low_inventory')
      .eq('acknowledged', false)
      .in('severity', ['critical', 'high'])
      .order('created_at', { ascending: false });

    if (alertsError) throw alertsError;

    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ message: 'No critical alerts to send' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get users with procurement and admin roles
    const { data: roleData, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select(`
        user_id,
        role,
        profiles!inner(email, full_name)
      `)
      .in('role', ['admin', 'production_manager']);

    if (rolesError) throw rolesError;

    // Group users by role and prepare recipient list
    const recipients = new Set<string>();
    const usersByRole: Record<string, User[]> = {};

    roleData?.forEach((userRole: any) => {
      const userInfo: User = {
        id: userRole.user_id,
        email: userRole.profiles.email,
        full_name: userRole.profiles.full_name,
        roles: [userRole.role]
      };

      recipients.add(userInfo.email);
      
      if (!usersByRole[userRole.role]) {
        usersByRole[userRole.role] = [];
      }
      usersByRole[userRole.role].push(userInfo);
    });

    if (recipients.size === 0) {
      console.log('No recipients found for inventory alerts');
      return new Response(JSON.stringify({ message: 'No recipients configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group alerts by severity
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const highAlerts = alerts.filter(alert => alert.severity === 'high');

    // Generate email content
    const generateEmailContent = (alertList: InventoryAlert[]) => {
      const alertsList = alertList.map(alert => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: 600;">${alert.details.material_code}</td>
          <td style="padding: 12px;">${alert.details.material_name}</td>
          <td style="padding: 12px; color: ${alert.severity === 'critical' ? '#dc2626' : '#ea580c'};">
            ${alert.details.current_quantity_kg.toFixed(2)} kg
          </td>
          <td style="padding: 12px;">${alert.details.min_quantity_kg.toFixed(2)} kg</td>
          <td style="padding: 12px;">${alert.details.supplier || 'N/A'}</td>
          <td style="padding: 12px;">
            <span style="
              background: ${alert.severity === 'critical' ? '#fef2f2' : '#fff7ed'};
              color: ${alert.severity === 'critical' ? '#dc2626' : '#ea580c'};
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            ">
              ${alert.severity}
            </span>
          </td>
        </tr>
      `).join('');

      return alertsList;
    };

    const emailSubject = criticalAlerts.length > 0 
      ? `🚨 CRITICAL Inventory Alert - ${criticalAlerts.length} material(s) critically low`
      : `⚠️ Low Inventory Alert - ${alerts.length} material(s) below minimum`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Inventory Alert</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background: ${criticalAlerts.length > 0 ? '#dc2626' : '#ea580c'}; color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">
                ${criticalAlerts.length > 0 ? '🚨 CRITICAL' : '⚠️'} Inventory Alert
              </h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">
                ${alerts.length} material(s) require immediate attention
              </p>
            </div>
            
            <div style="padding: 24px;">
              ${criticalAlerts.length > 0 ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 12px 0; color: #dc2626; font-size: 18px;">
                    Critical Materials (${criticalAlerts.length})
                  </h3>
                  <p style="margin: 0; color: #991b1b;">
                    These materials are at critically low levels (&lt;10% of minimum threshold) and require immediate action.
                  </p>
                </div>
              ` : ''}
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Code</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Material</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Current Stock</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Minimum</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Supplier</th>
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateEmailContent(alerts)}
                </tbody>
              </table>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin-top: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #374151;">Recommended Actions:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280;">
                  <li>Review and create purchase orders for affected materials</li>
                  <li>Contact suppliers to expedite delivery if possible</li>
                  <li>Consider adjusting production schedules if necessary</li>
                  <li>Acknowledge alerts in the system after taking action</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <a href="${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'vercel.app') || 'https://your-app.com'}/inventory" 
                   style="
                     background: #2563eb;
                     color: white;
                     padding: 12px 24px;
                     text-decoration: none;
                     border-radius: 6px;
                     font-weight: 600;
                     display: inline-block;
                   ">
                  View Inventory Dashboard
                </a>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #6b7280; font-size: 14px;">
              <p style="margin: 0;">
                This is an automated alert from your Inventory Management System
              </p>
              <p style="margin: 4px 0 0 0;">
                Generated on ${new Date().toLocaleString()} by ${user.email}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to all recipients
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Inventory System <inventory@your-company.com>',
      to: Array.from(recipients),
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailError) throw emailError;

    console.log(`Sent inventory alert email to ${recipients.size} recipients:`, emailResult);

    return new Response(JSON.stringify({
      success: true,
      message: `Inventory alerts sent to ${recipients.size} recipients`,
      emailId: emailResult.id,
      alertCount: alerts.length,
      criticalCount: criticalAlerts.length,
      highCount: highAlerts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-inventory-alerts function:', error?.stack || error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
