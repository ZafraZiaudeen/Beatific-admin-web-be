interface SendOpts {
  to?: string
  subject: string
  text: string
  html?: string
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || ''
  return { apiKey, from }
}

export const emailService = {
  async send(opts: SendOpts): Promise<void> {
    const { apiKey, from } = getResendConfig()
    const to   = opts.to || from

    if (!from || !to) {
      console.warn('[Email] Resend not configured — missing from/to, skipping email:', opts.subject)
      return
    }

    if (!apiKey) {
      console.warn('[Email] Resend not configured — missing RESEND_API_KEY, skipping email:', opts.subject)
      return
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        }),
      })

      if (!response.ok) {
        const details = await response.text()
        throw new Error(`Resend returned ${response.status}: ${details}`)
      }

      console.log(`[Email] Sent: "${opts.subject}" → ${to}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Email] Failed to send "${opts.subject}":`, message)
      throw err
    }
  },

  async sendVerificationCode(to: string, code: string, type: 'forgot_password'): Promise<void> {
    const subject = 'Beatific Admin — Password Reset Code'
    const heading = 'Reset your password'
    const description = 'We received a request to reset your admin password. Enter this code to proceed.'

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #FAFAF9;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #E7E5E4;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #1C1917; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; color: white; font-size: 20px; font-weight: bold; font-style: italic; text-align: center;">B</div>
          </div>
          <h1 style="text-align: center; font-size: 20px; color: #1C1917; margin: 0 0 8px;">${heading}</h1>
          <p style="text-align: center; font-size: 14px; color: #78716C; margin: 0 0 28px;">${description}</p>
          <div style="text-align: center; background: #F5F5F4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1C1917; font-family: monospace;">${code}</span>
          </div>
          <p style="text-align: center; font-size: 12px; color: #A8A29E; margin: 0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `

    const text = `${heading}\n\nYour password reset code is: ${code}\n\n${description}\n\nThis code expires in 10 minutes.`

    await this.send({ to, subject, text, html })
  },
}
