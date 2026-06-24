const INTERNAL_TO = process.env.SOL_INTERNAL_TO;
const FROM = process.env.RESEND_FROM || 'Shape of Love <onboarding@resend.dev>';
const REPLY_TO = process.env.SOL_REPLY_TO || INTERNAL_TO;
const RESEND_KEY = process.env.RESEND_API;

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPayload(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return req.body;
}

function plainReceipt(payload) {
  const p = payload.profile || {};
  const seeking = Array.isArray(p.seeking) ? p.seeking.join(', ') : (p.seeking || '');
  return [
    'SOL intake received',
    '',
    `Confirmation code: ${payload.confirmationCode || 'SOL-—'}`,
    '',
    `Name: ${p.fullName || ''}`,
    `Email: ${p.email || ''}`,
    `Region: ${p.city || ''}`,
    `Age: ${p.age || ''}`,
    `Facebook: ${p.facebook || ''}`,
    `Listed as: ${p.identity || ''}`,
    `Match field: ${seeking}`,
    `Match field note: ${p.seekingCustom || ''}`,
    `Preferred age range: ${p.ageMin || 'open'}–${p.ageMax || 'open'}`,
    `Relationship intent: ${p.relationshipIntent || ''}`,
    '',
    'Intent profile:',
    payload.profileText || '—',
    '',
    'Facebook group:',
    'https://www.facebook.com/groups/2457591164715976',
    '',
    'Love has a shape.'
  ].join('\n');
}

function htmlReceipt(payload, internal = false) {
  const p = payload.profile || {};
  const seeking = Array.isArray(p.seeking) ? p.seeking.join(', ') : (p.seeking || '');
  const rows = [
    ['Confirmation code', payload.confirmationCode || 'SOL-—'],
    ['Name', p.fullName || ''],
    ['Email', p.email || ''],
    ['Region', p.city || ''],
    ['Age', p.age || ''],
    ['Facebook', p.facebook || ''],
    ['Listed as', p.identity || ''],
    ['Match field', seeking],
    ['Match field note', p.seekingCustom || ''],
    ['Preferred age range', `${p.ageMin || 'open'}–${p.ageMax || 'open'}`],
    ['Relationship intent', p.relationshipIntent || ''],
  ];

  const table = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eadfce;color:#7b6f61;font-size:13px;">${esc(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eadfce;color:#171410;font-size:14px;">${esc(value)}</td>
    </tr>`).join('');

  const heading = internal ? 'New SOL intake' : 'Your SOL intent receipt';

  return `<!doctype html>
  <html>
  <body style="margin:0;background:#f6f0e7;font-family:Inter,Arial,sans-serif;color:#171410;">
    <div style="max-width:720px;margin:0 auto;padding:32px 18px;">
      <div style="background:#fffaf3;border:1px solid #eadfce;border-radius:24px;padding:28px;">
        <div style="font-family:Georgia,serif;font-size:46px;letter-spacing:.03em;color:#171410;margin-bottom:4px;">SOL</div>
        <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#a66f13;margin-bottom:24px;">Love has a shape</div>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;line-height:1.05;margin:0 0 18px;">${heading}</h1>
        <p style="margin:0 0 22px;color:#5f554a;line-height:1.5;">Use this confirmation code for the Facebook group membership question.</p>
        <div style="display:inline-block;border:1px solid #cfa35a;background:#f7edda;border-radius:999px;padding:10px 14px;font-family:ui-monospace,Menlo,monospace;color:#2e6648;margin-bottom:22px;">
          ${esc(payload.confirmationCode || 'SOL-—')}
        </div>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 26px;background:#fff;border:1px solid #eadfce;border-radius:18px;overflow:hidden;">
          ${table}
        </table>
        <h2 style="font-size:15px;letter-spacing:.16em;text-transform:uppercase;color:#7b6f61;margin:0 0 10px;">Intent profile</h2>
        <div style="white-space:pre-wrap;background:#fff;border:1px solid #eadfce;border-radius:18px;padding:18px;line-height:1.55;color:#171410;">${esc(payload.profileText || '—')}</div>
        <p style="margin:24px 0 0;color:#5f554a;">Facebook group: <a href="https://www.facebook.com/groups/2457591164715976" style="color:#2e6648;">Open group</a></p>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendResendEmail({ to, replyTo, subject, html, text }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      html,
      text,
    }),
  });

  const raw = await resp.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }

  if (!resp.ok) {
    const message = data?.message || data?.error || data?.name || raw || `Resend HTTP ${resp.status}`;
    const error = new Error(message);
    error.status = resp.status;
    error.resend = data;
    throw error;
  }

  return data;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!RESEND_KEY) {
      return res.status(500).json({ ok: false, step: 'config', error: 'Missing RESEND_API server environment variable.' });
    }

    if (!INTERNAL_TO || !INTERNAL_TO.includes('@')) {
      return res.status(500).json({ ok: false, step: 'config', error: 'Missing SOL_INTERNAL_TO server environment variable.' });
    }

    const payload = getPayload(req);
    const applicantEmail = String(payload?.profile?.email || '').trim();

    if (!applicantEmail || !applicantEmail.includes('@')) {
      return res.status(400).json({ ok: false, step: 'validate', error: 'Missing applicant email.' });
    }

    const internal = await sendResendEmail({
      to: INTERNAL_TO,
      replyTo: applicantEmail,
      subject: `SOL intake received — ${payload.confirmationCode || 'no-code'}`,
      html: htmlReceipt(payload, true),
      text: plainReceipt(payload),
    }).catch((error) => {
      error.step = 'send-internal';
      throw error;
    });

    let applicant = null;
    let applicantSkipped = false;
    let applicantWarning = null;

    try {
      applicant = await sendResendEmail({
        to: applicantEmail,
        replyTo: REPLY_TO,
        subject: `Your SOL intent receipt — ${payload.confirmationCode || 'SOL'}`,
        html: htmlReceipt(payload, false),
        text: plainReceipt(payload),
      });
    } catch (error) {
      const message = String(error?.message || '');
      const isResendSandboxLimit =
        error?.status === 403 &&
        (message.includes('only send testing emails') || message.includes('verify a domain'));

      if (!isResendSandboxLimit) {
        error.step = 'send-applicant';
        throw error;
      }

      applicantSkipped = true;
      applicantWarning = 'Applicant receipt skipped until a sending domain is verified in Resend.';
      console.warn('Applicant receipt skipped by Resend sandbox restriction', {
        applicantEmail,
        message,
        status: error?.status,
      });
    }

    return res.status(200).json({
      ok: true,
      internalId: internal?.id || null,
      applicantId: applicant?.id || null,
      applicantSkipped,
      warning: applicantWarning,
    });
  } catch (error) {
    console.error('SOL submit-intake failed', {
      step: error?.step || 'unhandled',
      message: error?.message,
      status: error?.status,
      resend: error?.resend,
    });

    return res.status(error?.status ? 502 : 500).json({
      ok: false,
      step: error?.step || 'unhandled',
      error: error?.message || 'Submit intake failed',
      resendStatus: error?.status || null,
      resend: error?.resend || null,
    });
  }
};
