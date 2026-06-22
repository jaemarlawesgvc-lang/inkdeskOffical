// ---------------------------------------------------------------------------
// Shared layout wrapper — dark theme, responsive, Inkquire branding
// ---------------------------------------------------------------------------

function layout(content: string, artistEmail?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Inkquire</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#171717;border-radius:12px;overflow:hidden;">
<!-- Header -->
<tr><td style="padding:24px 32px;border-bottom:1px solid #262626;">
<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Inkquire</span>
</td></tr>
<!-- Content -->
<tr><td style="padding:32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 32px;border-top:1px solid #262626;text-align:center;">
<p style="margin:0;font-size:12px;color:#737373;line-height:1.5;">
&copy; ${new Date().getFullYear()} Inkquire. All rights reserved.<br />
You received this email because of a booking on Inkquire.
</p>
${artistEmail ? `<p style="margin:8px 0 0;font-size:12px;color:#525252;line-height:1.5;">Having a problem? <a href="mailto:${artistEmail}" style="color:#a3a3a3;text-decoration:underline;">Contact your artist</a></p>` : ''}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`)
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  return ` at ${timeStr}`
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Template data interfaces
// ---------------------------------------------------------------------------

export interface BookingEmailData {
  clientName: string
  artistName: string
  bookingDate: string
  bookingTime: string | null
  depositAmount: number | null
  depositPaid: boolean
  description: string | null
  studioName: string | null
  studioAddress: string | null
  dashboardUrl: string
  statusUrl: string | null
  consentFormUrl: string | null
  aftercareGuideUrl: string | null
  artistEmail: string | null
}

// ---------------------------------------------------------------------------
// 1. Booking Confirmation — to client
// ---------------------------------------------------------------------------

export function bookingConfirmationTemplate(data: BookingEmailData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.bookingDate)
  const timeDisplay = formatTime(data.bookingTime)

  const depositLine = data.depositPaid && data.depositAmount
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Deposit paid</td>
       <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">&pound;${data.depositAmount.toFixed(2)}</td></tr>`
    : ''

  const locationLine = data.studioAddress
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Location</td>
       <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${esc(data.studioAddress)}</td></tr>`
    : ''

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Booking confirmed</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, your appointment with <strong style="color:#ffffff;">${esc(data.artistName)}</strong> is confirmed.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:24px;">
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Date</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${dateDisplay}${timeDisplay}</td></tr>
${depositLine}
${locationLine}
</table>
<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">What to bring</h2>
<ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#a3a3a3;line-height:1.8;">
<li>Photo ID</li>
<li>Reference images (if any)</li>
<li>Comfortable clothing for the tattoo area</li>
<li>A snack and water for longer sessions</li>
</ul>
<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">Cancellation policy</h2>
<p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.5;">
  Please contact your artist at least 48 hours before your appointment if you need to cancel or reschedule.
  Late cancellations may forfeit the deposit.
</p>
${data.consentFormUrl ? `<p style="margin:0 0 16px;font-size:14px;color:#a3a3a3;line-height:1.5;">Please complete your consent form online before your appointment — it takes about two minutes.</p><a href="${data.consentFormUrl}" style="display:inline-block;margin:0 0 24px;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Fill out consent form</a>` : ''}
${data.statusUrl ? `<a href="${data.statusUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View booking status</a>` : ''}`

  return {
    subject: `Your booking with ${data.artistName} is confirmed`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 2. Artist Notification — to artist
// ---------------------------------------------------------------------------

export function artistNotificationTemplate(data: BookingEmailData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.bookingDate)
  const timeDisplay = formatTime(data.bookingTime)

  const depositLine = data.depositPaid && data.depositAmount
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Deposit</td>
       <td style="padding:8px 0;color:#22c55e;font-size:14px;text-align:right;">&pound;${data.depositAmount.toFixed(2)} paid</td></tr>`
    : data.depositAmount
      ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Deposit</td>
         <td style="padding:8px 0;color:#f59e0b;font-size:14px;text-align:right;">Pending</td></tr>`
      : ''

  const descriptionLine = data.description
    ? `<div style="margin-top:16px;padding:16px;background-color:#262626;border-radius:8px;">
       <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.5px;">Description</p>
       <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">${esc(data.description)}</p>
       </div>`
    : ''

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">New booking</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  You have a new booking from <strong style="color:#ffffff;">${esc(data.clientName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:16px;">
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Client</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${esc(data.clientName)}</td></tr>
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Date</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${dateDisplay}${timeDisplay}</td></tr>
${depositLine}
</table>
${descriptionLine}
<div style="margin-top:24px;">
<a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View in dashboard</a>
</div>`

  return {
    subject: `New booking from ${data.clientName}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 3. 48-Hour Reminder — to client
// ---------------------------------------------------------------------------

export function reminder48hTemplate(data: BookingEmailData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.bookingDate)
  const timeDisplay = formatTime(data.bookingTime)

  const locationLine = data.studioAddress
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Location</td>
       <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${esc(data.studioAddress)}</td></tr>`
    : ''

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Your appointment is tomorrow</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, just a reminder about your appointment with <strong style="color:#ffffff;">${esc(data.artistName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:24px;">
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Date</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${dateDisplay}${timeDisplay}</td></tr>
${locationLine}
</table>
<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">Preparation tips</h2>
<ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#a3a3a3;line-height:1.8;">
<li>Get a good night&rsquo;s sleep</li>
<li>Eat a full meal before your session</li>
<li>Stay hydrated — drink plenty of water</li>
<li>Avoid alcohol for 24 hours before your appointment</li>
<li>Moisturise the area (but not on the day)</li>
<li>Wear comfortable, loose-fitting clothing</li>
</ul>
<p style="margin:0;font-size:14px;color:#a3a3a3;line-height:1.5;">
  Need to cancel or reschedule? Please contact your artist as soon as possible.
</p>`

  return {
    subject: `Your tattoo appointment is tomorrow — ${data.artistName}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 4. 7-Day Reminder — to client (sent one week before the appointment)
// ---------------------------------------------------------------------------

export function reminder7dayTemplate(data: BookingEmailData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.bookingDate)
  const timeDisplay = formatTime(data.bookingTime)

  const locationLine = data.studioAddress
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Location</td>
       <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${esc(data.studioAddress)}</td></tr>`
    : ''

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Your appointment is in one week</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, your appointment with <strong style="color:#ffffff;">${esc(data.artistName)}</strong> is coming up.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:24px;">
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Date</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${dateDisplay}${timeDisplay}</td></tr>
${locationLine}
</table>
<p style="margin:0;font-size:14px;color:#a3a3a3;line-height:1.5;">
  Need to cancel or reschedule? Please contact your artist as soon as possible so the slot can be offered to someone else.
</p>
${data.statusUrl ? `<a href="${data.statusUrl}" style="display:inline-block;margin-top:24px;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View booking status</a>` : ''}`

  return {
    subject: `Your appointment with ${data.artistName} is in one week`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 5. Deposit Receipt — to client (sent on payment_intent.succeeded)
// ---------------------------------------------------------------------------

export interface DepositReceiptData {
  clientName: string
  artistName: string
  bookingDate: string
  bookingTime: string | null
  depositAmount: number
  paymentDate: string
  cardLast4: string | null
  artistEmail: string | null
}

export function depositReceiptTemplate(data: DepositReceiptData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.bookingDate)
  const timeDisplay = formatTime(data.bookingTime)
  const paidOn = new Date(data.paymentDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const cardLine = data.cardLast4
    ? `<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Card</td>
       <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">&bull;&bull;&bull;&bull; ${esc(data.cardLast4)}</td></tr>`
    : ''

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Deposit receipt</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, this confirms your deposit payment for your appointment with <strong style="color:#ffffff;">${esc(data.artistName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:24px;">
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Amount paid</td>
    <td style="padding:8px 0;color:#22c55e;font-size:14px;text-align:right;">&pound;${data.depositAmount.toFixed(2)}</td></tr>
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Payment date</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${paidOn}</td></tr>
${cardLine}
<tr><td style="padding:8px 0;color:#a3a3a3;font-size:14px;">Appointment</td>
    <td style="padding:8px 0;color:#ffffff;font-size:14px;text-align:right;">${dateDisplay}${timeDisplay}</td></tr>
</table>
<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">Cancellation policy</h2>
<p style="margin:0;font-size:14px;color:#a3a3a3;line-height:1.5;">
  Please contact your artist at least 48 hours before your appointment if you need to cancel or reschedule.
  Late cancellations may forfeit the deposit.
</p>`

  return {
    subject: `Deposit receipt — ${data.artistName}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 6. Review Request — to client (sent 24h after a booking is completed)
// ---------------------------------------------------------------------------

export interface ReviewRequestData {
  clientName: string
  artistName: string
  reviewUrl: string
  artistEmail: string | null
}

export function reviewRequestTemplate(data: ReviewRequestData): {
  subject: string
  html: string
} {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">How was your experience?</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, we hope you&rsquo;re loving your new tattoo from <strong style="color:#ffffff;">${esc(data.artistName)}</strong>.
  Would you mind leaving a quick review? It really helps other clients find great artists.
</p>
<a href="${data.reviewUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Leave a review</a>
<p style="margin:24px 0 0;font-size:12px;color:#525252;line-height:1.5;">
  This link expires in 14 days.
</p>`

  return {
    subject: `How was your session with ${data.artistName}?`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 7. Cancellation Opening — to waitlisted/pending clients
// ---------------------------------------------------------------------------

export interface CancellationOpeningData {
  clientName: string
  artistName: string
  openingDate: string
  bookingUrl: string
  artistEmail: string | null
}

export function cancellationOpeningTemplate(data: CancellationOpeningData): {
  subject: string
  html: string
} {
  const dateDisplay = formatDate(data.openingDate)

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">An opening just appeared</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, an opening has appeared with <strong style="color:#ffffff;">${esc(data.artistName)}</strong> on
  <strong style="color:#ffffff;">${dateDisplay}</strong>. Book now before it&rsquo;s taken.
</p>
<a href="${data.bookingUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Book this slot</a>`

  return {
    subject: `An opening with ${data.artistName} on ${dateDisplay}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 8. Aftercare — to client (sent 24h after appointment)
// ---------------------------------------------------------------------------

export function aftercareTemplate(data: BookingEmailData): {
  subject: string
  html: string
} {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Aftercare instructions</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, here are the aftercare instructions from <strong style="color:#ffffff;">${esc(data.artistName)}</strong> to help your new tattoo heal properly.
</p>

<h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#ffffff;">Healing stages</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
<tr><td style="padding:12px 16px;background-color:#262626;border-radius:8px 8px 0 0;border-bottom:1px solid #333;">
  <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Days 1–3</p>
  <p style="margin:0;font-size:13px;color:#a3a3a3;">Redness, slight swelling, and oozing are normal. Keep the area clean and moisturised.</p>
</td></tr>
<tr><td style="padding:12px 16px;background-color:#262626;border-bottom:1px solid #333;">
  <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Days 4–14</p>
  <p style="margin:0;font-size:13px;color:#a3a3a3;">The tattoo will start to peel and flake. This is normal — do not pick or scratch it.</p>
</td></tr>
<tr><td style="padding:12px 16px;background-color:#262626;border-radius:0 0 8px 8px;">
  <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#ffffff;">Weeks 2–4</p>
  <p style="margin:0;font-size:13px;color:#a3a3a3;">The outer layer heals. The tattoo may look slightly dull — this is temporary. Full healing takes 4–6 weeks.</p>
</td></tr>
</table>

<h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#22c55e;">Do</h2>
<ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#a3a3a3;line-height:1.8;">
<li>Wash gently with lukewarm water and fragrance-free soap</li>
<li>Pat dry with a clean paper towel — never rub</li>
<li>Apply a thin layer of fragrance-free moisturiser 2–3 times daily</li>
<li>Wear loose, breathable clothing over the tattoo</li>
<li>Keep it out of direct sunlight</li>
</ul>

<h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#ef4444;">Don&rsquo;t</h2>
<ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#a3a3a3;line-height:1.8;">
<li>Submerge in water (baths, pools, hot tubs) for 2–4 weeks</li>
<li>Pick, scratch, or peel flaking skin</li>
<li>Apply petroleum jelly or products with fragrances</li>
<li>Expose to direct sunlight or tanning beds</li>
<li>Exercise intensely for the first 48 hours</li>
</ul>

<h2 style="margin:0 0 8px;font-size:15px;font-weight:600;color:#ffffff;">When to contact your artist</h2>
<p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.5;">
  If you notice excessive redness, swelling, pus, or a rash that lasts more than a few days,
  reach out to your artist or consult a healthcare professional. Minor issues during healing are
  normal, but it&rsquo;s always better to check.
</p>
${data.aftercareGuideUrl ? `<a href="${data.aftercareGuideUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Download printable aftercare guide</a>` : ''}`

  return {
    subject: `Aftercare instructions from ${data.artistName}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 9. New Message — to artist (client messaged) or client (artist replied)
// ---------------------------------------------------------------------------

export interface NewMessageNotificationData {
  recipientName: string
  senderName: string
  messagePreview: string
  conversationUrl: string
  artistEmail: string | null
}

export function newMessageNotificationTemplate(data: NewMessageNotificationData): {
  subject: string
  html: string
} {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">New message from ${esc(data.senderName)}</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.recipientName)}, you have a new message on Inkquire.
</p>
<div style="margin-bottom:24px;padding:16px;background-color:#262626;border-radius:8px;border-left:3px solid #404040;">
  <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;white-space:pre-wrap;">${esc(data.messagePreview)}</p>
</div>
<a href="${data.conversationUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Reply</a>`

  return {
    subject: `New message from ${data.senderName}`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 9b. Conversation Invite — to client (artist started a new conversation)
// ---------------------------------------------------------------------------

export interface ConversationInviteData {
  clientName: string
  artistName: string
  conversationUrl: string
  artistEmail: string | null
}

export function conversationInviteTemplate(data: ConversationInviteData): {
  subject: string
  html: string
} {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">You have a new conversation</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  Hi ${esc(data.clientName)}, <strong style="color:#ffffff;">${esc(data.artistName)}</strong> started a conversation with you on Inkquire.
  Use the link below to view and reply to messages.
</p>
<a href="${data.conversationUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Open conversation</a>
<p style="margin:24px 0 0;font-size:12px;color:#525252;line-height:1.5;">
  Save this link — you&rsquo;ll need it to view and reply to this conversation later.
</p>`

  return {
    subject: `${data.artistName} started a conversation with you`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}

// ---------------------------------------------------------------------------
// 10. Consent Form Submitted — to artist
// ---------------------------------------------------------------------------

export interface ConsentFormSubmittedData {
  artistName: string
  clientName: string
  tattooDescription: string
  dashboardUrl: string
  artistEmail: string | null
}

export function consentFormSubmittedTemplate(data: ConsentFormSubmittedData): {
  subject: string
  html: string
} {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Consent form received</h1>
<p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
  <strong style="color:#ffffff;">${esc(data.clientName)}</strong> has completed and signed their consent form online.
</p>
<div style="margin-bottom:24px;padding:16px;background-color:#262626;border-radius:8px;">
  <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.5px;">Tattoo description</p>
  <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">${esc(data.tattooDescription)}</p>
</div>
<a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View signed form</a>`

  return {
    subject: `${data.clientName} signed their consent form`,
    html: layout(content, data.artistEmail ?? undefined),
  }
}
