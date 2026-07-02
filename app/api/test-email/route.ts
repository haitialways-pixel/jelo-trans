// app/api/test-email/route.ts
import {
  getMailSetupHint,
  isMailConfigured,
  isResendSandboxMode,
  resolveFromHeader,
  sendMail,
} from '@/lib/email/mailer'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testEmail = searchParams.get('to') || 'delivered@resend.dev'
  const kind = searchParams.get('kind') === 'dispatch' ? 'dispatch' : 'customer'

  try {
    const from = resolveFromHeader({ fromKind: kind })
    const result = await sendMail({
      to: testEmail,
      fromKind: kind,
      subject: `🧪 Imperial Odyssey - Test Email (${kind})`,
      html: `
        <h2>Test Email Successful ✅</h2>
        <p>Kind: <strong>${kind}</strong></p>
        <p>From: <strong>${from}</strong></p>
        <p>If you're reading this, your Resend integration is working properly!</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
      `,
      text: `Test Email Successful ✅\nKind: ${kind}\nFrom: ${from}\nTime: ${new Date().toLocaleString()}`,
    })

    return NextResponse.json({
      success: result.sent,
      message: result.sent
        ? `Test email sent to ${testEmail}`
        : 'Failed to send email',
      configured: isMailConfigured(),
      kind,
      from,
      customerFrom: resolveFromHeader({ fromKind: 'customer' }),
      dispatchFrom: resolveFromHeader({ fromKind: 'dispatch' }),
      sandboxMode: isResendSandboxMode(),
      setupHint: getMailSetupHint(),
      details: result,
    })
  } catch (error: unknown) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      customerFrom: resolveFromHeader({ fromKind: 'customer' }),
      dispatchFrom: resolveFromHeader({ fromKind: 'dispatch' }),
      sandboxMode: isResendSandboxMode(),
      setupHint: getMailSetupHint(),
    }, { status: 500 })
  }
}