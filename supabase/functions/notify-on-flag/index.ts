// Supabase Edge Function: notify-on-flag (Deno)
// Deploy:  supabase functions deploy notify-on-flag
// Secrets: supabase secrets set TWILIO_SID=... TWILIO_TOKEN=... TWILIO_FROM=... RESEND_KEY=...
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  const { patientId, biomarker, latest, unit, personalMean, flag, doctorEmail } = await req
    .json();

  if (!['sudden', 'drift'].includes(flag)) return new Response('no notification needed');

  const { data: patient } = await supabase
    .from('patients')
    .select('name, phone, email')
    .eq('id', patientId)
    .single();

  const flagWord = flag === 'sudden' ? 'a sudden change' : 'a gradual drift';
  const message = `DriftCheck: ${biomarker} shows ${flagWord} — latest ${latest} ${unit} vs your average ${personalMean} ${unit}. Please talk to your doctor. This is not a diagnosis.`;

  // 1) Twilio SMS — patient (most reliable channel in India, works on feature phones)
  if (patient?.phone) {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_SID')}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' +
            btoa(`${Deno.env.get('TWILIO_SID')}:${Deno.env.get('TWILIO_TOKEN')}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: Deno.env.get('TWILIO_FROM') ?? '',
          To: patient.phone,
          Body: message,
        }),
      }
    );
  }

  // 2) Resend email — doctor (pre-flagged summary at each visit / digest)
  if (doctorEmail) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DriftCheck <alerts@driftcheck.app>',
        to: [doctorEmail],
        subject: `DriftCheck: ${biomarker} — ${flagWord}`,
        html: `<p>${message.replaceAll('\n', '<br/>')}</p><p>Full trend summary available when the patient shares it.</p>`,
      }),
    });
  }

  return new Response('notified');
});