// app/api/test-email/route.ts
import { getMailFromAddress, getMailSetupHint, isMailConfigured, isResendSandboxMode, sendMail } from '@/lib/email/mailer'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testEmail = searchParams.get('to') || 'delivered@resend.dev'

  try {
    const result = await sendMail({
      to: testEmail,
      subject: '🧪 Phalo Transportation - Test Email',
      html: `
        <h2>Test Email Successful ✅</h2>
        <p>If you're reading this, your Resend integration is working properly!</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
      `,
      text: `Test Email Successful ✅\nTime: ${new Date().toLocaleString()}`,
    })

    return NextResponse.json({
      success: result.sent,
      message: result.sent
        ? `Test email sent to ${testEmail}`
        : 'Failed to send email',
      configured: isMailConfigured(),
      from: getMailFromAddress(),
      sandboxMode: isResendSandboxMode(),
      setupHint: getMailSetupHint(),
      details: result,
    })
  } catch (error: unknown) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      from: getMailFromAddress(),
      sandboxMode: isResendSandboxMode(),
      setupHint: getMailSetupHint(),
    }, { status: 500 })
  }
}