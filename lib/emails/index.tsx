// React Email templates — type-safe HTML emails for every stage of the ride lifecycle.
// Rendered to HTML strings by `lib/email/mailer.ts` (via @react-email/render) and sent
// through Resend.
import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface BaseProps {
  customerName: string;
  bookingId?: string;
  pickupLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  dropoffLocation?: string;
  totalAmount?: number;
  paymentMethod?: string;
  transactionId?: string;
  completionDate?: string;
  cancellationReason?: string;
  refundInfo?: string;
}

// Reusable Email Layout with Disclaimer
const EmailLayout = ({ children, previewText }: { children: React.ReactNode; previewText: string }) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Body style={{ backgroundColor: '#f6f6f6', fontFamily: 'sans-serif' }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '0 auto', padding: '20px' }}>
        {children}

        <Hr style={{ margin: '30px 0' }} />

        {/* Footer */}
        <Text style={{ color: '#666666', fontSize: '12px', textAlign: 'center', lineHeight: '1.5' }}>
          Imperial Odyssey LLC • 678-478-3506<br />
          <Link href="https://phalotrans.com" style={{ color: '#3b82f6' }}>phalotrans.com</Link>
        </Text>

        {/* Disclaimer */}
        <Text style={{
          color: '#999999',
          fontSize: '11px',
          textAlign: 'center',
          marginTop: '15px',
          lineHeight: '1.4'
        }}>
          This is an automated message from Imperial Odyssey.
          Please do not reply to this email. For any questions or changes,
          please contact us at 678-478-3506 or visit{' '}
          <Link href="https://phalotrans.com" style={{ color: '#3b82f6' }}>phalotrans.com</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
);

// 1. Booking Received (pending manager review)
export const BookingReceivedEmail = (props: BaseProps) => (
  <EmailLayout previewText="We received your reservation request">
    <Heading style={{ color: '#1f2937' }}>📋 Reservation Received</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>
      Thank you for choosing <strong>Imperial Odyssey</strong>. We have received your reservation
      request and our team is reviewing it now.
    </Text>
    <Text>
      <strong>A confirmation email with full trip details will follow shortly</strong> once your
      reservation is approved by our manager.
    </Text>

    <Section>
      <Text><strong>Booking ID:</strong> #{props.bookingId}</Text>
      {props.pickupLocation && (
        <Text><strong>Pickup:</strong> {props.pickupLocation} on {props.pickupDate} at {props.pickupTime}</Text>
      )}
      {props.dropoffLocation && <Text><strong>Drop-off:</strong> {props.dropoffLocation}</Text>}
      {props.vehicleType && <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>}
      {props.totalAmount != null && <Text><strong>Estimated Total:</strong> ${props.totalAmount}</Text>}
    </Section>

    <Text>Questions? Call us at 678-478-3506.</Text>
  </EmailLayout>
);

// 2. Booking Confirmed (after manager approval)
export const BookingConfirmedEmail = (props: BaseProps) => (
  <EmailLayout previewText="Your reservation has been confirmed!">
    <Heading style={{ color: '#1f2937' }}>✅ Your Reservation is Confirmed!</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>
      Great news — your <strong>Imperial Odyssey</strong> reservation has been confirmed by our team.
    </Text>

    <Section>
      <Text><strong>Booking ID:</strong> #{props.bookingId}</Text>
      <Text><strong>Pickup:</strong> {props.pickupLocation} on {props.pickupDate} at {props.pickupTime}</Text>
      {props.dropoffLocation && <Text><strong>Drop-off:</strong> {props.dropoffLocation}</Text>}
      {props.vehicleType && <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>}
      {props.driverName && (
        <Text>
          <strong>Chauffeur:</strong> {props.driverName}
          {props.driverPhone ? ` (${props.driverPhone})` : ''}
        </Text>
      )}
      {props.totalAmount != null && <Text><strong>Total Amount:</strong> ${props.totalAmount}</Text>}
    </Section>

    <Text>We look forward to providing you with excellent service.</Text>
  </EmailLayout>
);

// 3. Driver dispatch notification
export const DriverDispatchEmail = (props: BaseProps & { passengerCount?: number; specialRequests?: string }) => (
  <EmailLayout previewText={`New dispatch — Booking #${props.bookingId}`}>
    <Heading style={{ color: '#1f2937' }}>🚗 New Trip Assignment</Heading>
    <Text>Hello{props.driverName ? ` ${props.driverName}` : ''},</Text>
    <Text>You have been assigned to the following reservation:</Text>

    <Section>
      <Text><strong>Booking ID:</strong> #{props.bookingId}</Text>
      <Text><strong>Customer:</strong> {props.customerName}</Text>
      <Text><strong>Pickup:</strong> {props.pickupLocation} on {props.pickupDate} at {props.pickupTime}</Text>
      {props.dropoffLocation && <Text><strong>Drop-off:</strong> {props.dropoffLocation}</Text>}
      {props.vehicleType && <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>}
      {props.passengerCount != null && <Text><strong>Passengers:</strong> {props.passengerCount}</Text>}
      {props.specialRequests && <Text><strong>Special requests:</strong> {props.specialRequests}</Text>}
      {props.totalAmount != null && <Text><strong>Total fare:</strong> ${props.totalAmount}</Text>}
    </Section>

    <Text>Please confirm you are available and proceed to the pickup location on time.</Text>
  </EmailLayout>
);

// 4. Chauffeur En Route
export const ChauffeurEnRouteEmail = (props: BaseProps) => (
  <EmailLayout previewText="Your driver is on the way!">
    <Heading style={{ color: '#eab308' }}>🚗 Chauffeur is En Route</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your driver is on the way to pick you up.</Text>

    {props.driverName && <Text><strong>Driver:</strong> {props.driverName} {props.driverPhone && `(${props.driverPhone})`}</Text>}
    <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>
    <Text><strong>Pickup:</strong> {props.pickupLocation} at {props.pickupTime}</Text>

    <Text>Please be ready. Safe travels!</Text>
  </EmailLayout>
);

// 5. Arrived at Pickup
export const ArrivedAtPickupEmail = (props: BaseProps) => (
  <EmailLayout previewText="Driver has arrived at pickup">
    <Heading style={{ color: '#10b981' }}>📍 Driver Has Arrived</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your driver has arrived at the pickup location.</Text>

    {props.driverName && <Text><strong>Driver:</strong> {props.driverName}</Text>}
    <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>

    <Text>Look for your driver and have a wonderful trip!</Text>
  </EmailLayout>
);

// 6. Passenger on Board
export const PassengerOnBoardEmail = (props: BaseProps) => (
  <EmailLayout previewText="You are now on board">
    <Heading style={{ color: '#3b82f6' }}>🧳 You Are On Board</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Great news! You are now on board and heading to your destination.</Text>

    {props.driverName && <Text><strong>Driver:</strong> {props.driverName}</Text>}
    <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>

    <Text>Sit back, relax, and enjoy the ride.</Text>
  </EmailLayout>
);

// 7. Arrived at Destination
export const ArrivedAtDestinationEmail = (props: BaseProps) => (
  <EmailLayout previewText="You have arrived at your destination">
    <Heading style={{ color: '#8b5cf6' }}>🏁 Arrived at Destination</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your driver has successfully arrived at your destination.</Text>
    <Text>Thank you for riding with Imperial Odyssey. We hope you had a pleasant journey.</Text>
  </EmailLayout>
);

// 8. Ride Completed + Payment Receipt
export const RideCompletedEmail = (props: BaseProps) => (
  <EmailLayout previewText="Ride Completed - Thank You!">
    <Heading style={{ color: '#10b981' }}>🎉 Ride Completed - Thank You!</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your ride has been successfully completed.</Text>

    <Section>
      <Text><strong>Booking ID:</strong> #{props.bookingId}</Text>
      <Text><strong>Date:</strong> {props.pickupDate}</Text>
      <Text><strong>From:</strong> {props.pickupLocation}</Text>
      {props.dropoffLocation && <Text><strong>To:</strong> {props.dropoffLocation}</Text>}
      <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>
      {props.driverName && <Text><strong>Driver:</strong> {props.driverName}</Text>}
    </Section>

    <Hr />

    <Heading as="h3">Payment Receipt</Heading>
    {props.totalAmount && <Text><strong>Total Charged:</strong> ${props.totalAmount}</Text>}
    {props.paymentMethod && <Text><strong>Payment Method:</strong> {props.paymentMethod}</Text>}
    {props.transactionId && <Text><strong>Transaction ID:</strong> {props.transactionId}</Text>}
    {props.completionDate && <Text><strong>Completed On:</strong> {props.completionDate}</Text>}

    <Text>Thank you for choosing <strong>Imperial Odyssey</strong>! We hope to serve you again soon.</Text>
  </EmailLayout>
);

// 9. Cancellation
export const CancellationEmail = (props: BaseProps) => (
  <EmailLayout previewText="Your reservation has been cancelled">
    <Heading style={{ color: '#ef4444' }}>❌ Reservation Cancelled</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your booking #{props.bookingId} has been cancelled.</Text>

    {props.cancellationReason && <Text><strong>Reason:</strong> {props.cancellationReason}</Text>}
    {props.refundInfo && <Text><strong>Refund Status:</strong> {props.refundInfo}</Text>}

    <Text>We hope to serve you again in the future.</Text>
  </EmailLayout>
);

// 10. Manual / itemized payment receipt
export type ManualReceiptLineItem = {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type ManualReceiptEmailProps = {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  receiptNumber: string
  receiptDateTime: string
  tripType?: 'one_way' | 'round_trip'
  customerName: string
  customerEmail?: string
  customerPhone?: string
  origin?: string
  destination?: string
  departureDateTime?: string
  returnDateTime?: string
  bookingTicketNumber?: string
  items: ManualReceiptLineItem[]
  subtotal: number
  taxLabel?: string
  taxAmount: number
  discountAmount: number
  otherFees: number
  otherFeesLabel?: string
  grandTotal: number
  paymentMethod?: string
  amountPaid: number
  paymentReference?: string
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '12px',
  color: '#6b7280',
  padding: '8px 6px',
  borderBottom: '1px solid #e5e7eb',
}
const tdStyle: React.CSSProperties = {
  fontSize: '13px',
  padding: '8px 6px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
}
const rowLabel: React.CSSProperties = { fontSize: '13px', color: '#4b5563', padding: '4px 0' }
const rowValue: React.CSSProperties = {
  fontSize: '13px',
  color: '#111827',
  padding: '4px 0',
  textAlign: 'right',
}

export const ManualReceiptEmail = (props: ManualReceiptEmailProps) => {
  const tripLabel =
    props.tripType === 'round_trip' ? 'Round Trip' : props.tripType === 'one_way' ? 'One-Way' : undefined
  const balance = Math.max(0, props.grandTotal - props.amountPaid)

  return (
    <EmailLayout previewText={`Payment receipt ${props.receiptNumber} from ${props.companyName}`}>
      <Heading style={{ color: '#1f2937', marginBottom: 4 }}>Payment Receipt</Heading>
      <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
        Receipt #{props.receiptNumber}
      </Text>

      {/* Company */}
      <Section style={{ marginTop: 16, marginBottom: 8 }}>
        <Text style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
          {props.companyName}
        </Text>
        {props.companyAddress && (
          <Text style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{props.companyAddress}</Text>
        )}
        <Text style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
          {[props.companyPhone, props.companyEmail, props.companyWebsite].filter(Boolean).join(' · ')}
        </Text>
      </Section>

      <Hr />

      {/* Receipt meta + customer */}
      <Section>
        <Text style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Date &amp; time:</strong> {props.receiptDateTime}
        </Text>
        {tripLabel && (
          <Text style={{ margin: '4px 0', fontSize: 13 }}>
            <strong>Trip type:</strong> {tripLabel}
          </Text>
        )}
        <Text style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Customer:</strong> {props.customerName}
        </Text>
        {(props.customerEmail || props.customerPhone) && (
          <Text style={{ margin: '4px 0', fontSize: 13, color: '#4b5563' }}>
            {[props.customerEmail, props.customerPhone].filter(Boolean).join(' · ')}
          </Text>
        )}
        {props.bookingTicketNumber && (
          <Text style={{ margin: '4px 0', fontSize: 13 }}>
            <strong>Booking / ticket #:</strong> {props.bookingTicketNumber}
          </Text>
        )}
      </Section>

      {/* Journey */}
      {(props.origin || props.destination || props.departureDateTime || props.returnDateTime) && (
        <>
          <Hr />
          <Heading as="h3" style={{ color: '#1f2937', fontSize: 15 }}>
            Journey details
          </Heading>
          {props.origin && (
            <Text style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>From:</strong> {props.origin}
            </Text>
          )}
          {props.destination && (
            <Text style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>To:</strong> {props.destination}
            </Text>
          )}
          {props.departureDateTime && (
            <Text style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>Departure:</strong> {props.departureDateTime}
            </Text>
          )}
          {props.returnDateTime && (
            <Text style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>Return:</strong> {props.returnDateTime}
            </Text>
          )}
        </>
      )}

      {/* Line items */}
      <Hr />
      <Heading as="h3" style={{ color: '#1f2937', fontSize: 15 }}>
        Items / services
      </Heading>
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Description</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 48 }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Unit</th>
            <th style={{ ...thStyle, textAlign: 'right', width: 88 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item, i) => (
            <tr key={i}>
              <td style={tdStyle}>{item.description}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{money(item.unitPrice)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <Section style={{ marginTop: 12 }}>
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={rowLabel}>Subtotal</td>
              <td style={rowValue}>{money(props.subtotal)}</td>
            </tr>
            {props.taxAmount > 0 && (
              <tr>
                <td style={rowLabel}>{props.taxLabel || 'Tax'}</td>
                <td style={rowValue}>{money(props.taxAmount)}</td>
              </tr>
            )}
            {props.discountAmount > 0 && (
              <tr>
                <td style={rowLabel}>Discount</td>
                <td style={rowValue}>-{money(props.discountAmount)}</td>
              </tr>
            )}
            {props.otherFees > 0 && (
              <tr>
                <td style={rowLabel}>{props.otherFeesLabel || 'Other fees'}</td>
                <td style={rowValue}>{money(props.otherFees)}</td>
              </tr>
            )}
            <tr>
              <td style={{ ...rowLabel, fontWeight: 700, fontSize: 14, paddingTop: 10 }}>Grand total</td>
              <td style={{ ...rowValue, fontWeight: 700, fontSize: 14, paddingTop: 10 }}>
                {money(props.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Hr />

      {/* Payment */}
      <Heading as="h3" style={{ color: '#1f2937', fontSize: 15 }}>
        Payment
      </Heading>
      {props.paymentMethod && (
        <Text style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Method:</strong> {props.paymentMethod}
        </Text>
      )}
      <Text style={{ margin: '4px 0', fontSize: 13 }}>
        <strong>Amount paid:</strong> {money(props.amountPaid)}
      </Text>
      {balance > 0.009 && (
        <Text style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Balance due:</strong> {money(balance)}
        </Text>
      )}
      {props.paymentReference && (
        <Text style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Payment reference:</strong> {props.paymentReference}
        </Text>
      )}

      <Text style={{ marginTop: 24 }}>
        Thank you for choosing <strong>{props.companyName}</strong>. We appreciate your business.
      </Text>
    </EmailLayout>
  )
}
