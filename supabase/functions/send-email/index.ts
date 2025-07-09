import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-timezone",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Configuración de Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Leer datos del request
    const { email_type, data, recipient_email, recipient_name } = await req.json();

    // Templates de email
    const emailTemplates: Record<string, { subject: string; html: string }> = {
      task_assigned: {
        subject: "Nueva tarea asignada - InverApp",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Nueva Tarea Asignada</h2>
            <p>Hola ${recipient_name},</p>
            <p>Se te ha asignado una nueva tarea en el sistema InverApp:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${data.task_name}</h3>
              <p><strong>Proyecto:</strong> ${data.project_name}</p>
              <p><strong>Cliente:</strong> ${data.client_name}</p>
              <p><strong>Reserva:</strong> ${data.reservation_number}</p>
              <p><strong>Departamento:</strong> ${data.apartment_number}</p>
            </div>
            <p>Por favor, accede al sistema para revisar los detalles completos.</p>
            <p>Saludos,<br>Equipo InverApp</p>
          </div>
        `,
      },
      task_completed: {
        subject: "Tarea completada - InverApp",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Tarea Completada</h2>
            <p>Hola ${recipient_name},</p>
            <p>La siguiente tarea ha sido marcada como completada:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${data.task_name}</h3>
              <p><strong>Proyecto:</strong> ${data.project_name}</p>
              <p><strong>Cliente:</strong> ${data.client_name}</p>
              <p><strong>Completada por:</strong> ${data.completed_by}</p>
            </div>
            <p>Saludos,<br>Equipo InverApp</p>
          </div>
        `,
      },
      reservation_created: {
        subject: "Nueva reserva creada - InverApp",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Nueva Reserva Creada</h2>
            <p>Hola ${recipient_name},</p>
            <p>Se ha creado una nueva reserva en el sistema:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Reserva ${data.reservation_number}</h3>
              <p><strong>Cliente:</strong> ${data.client_name}</p>
              <p><strong>Proyecto:</strong> ${data.project_name}</p>
              <p><strong>Departamento:</strong> ${data.apartment_number}</p>
              <p><strong>Valor:</strong> ${data.total_payment}</p>
            </div>
            <p>Saludos,<br>Equipo InverApp</p>
          </div>
        `,
      },
    };

    const template = emailTemplates[email_type];
    if (!template) {
      throw new Error(`Email template not found for type: ${email_type}`);
    }

    // Enviar email usando Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "InverApp <noreply@inverapp.com>",
        to: recipient_email,
        subject: template.subject,
        html: template.html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    // Log en la base de datos (opcional, ya lo hace el trigger)
    await supabase.from("email_logs").insert({
      email_type,
      recipient_email,
      recipient_name,
      data,
      sent_at: new Date().toISOString(),
      status: "sent",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}); 