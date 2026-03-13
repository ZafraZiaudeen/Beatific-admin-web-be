import nodemailer from 'nodemailer'


interface SendOpts {
  to?: string       
  subject: string
  text: string
  html?: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT) || 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export const emailService = {
  async send(opts: SendOpts): Promise<void> {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || ''
    const to   = opts.to || from

    if (!from || !to) {
      console.warn('[Email] SMTP not configured — skipping email:', opts.subject)
      return
    }

    const transporter = getTransporter()
    if (!transporter) {
      console.warn('[Email] SMTP not configured — skipping email:', opts.subject)
      return
    }

    try {
      await transporter.sendMail({
        from,
        to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      })
      console.log(`[Email] Sent: "${opts.subject}" → ${to}`)
    } catch (err: any) {
      console.error(`[Email] Failed to send "${opts.subject}":`, err.message)
      throw err
    }
  },
}
