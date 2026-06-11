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
          Phalo Transportation LLC • 678-478-3506<br />
          <Link href="https://www.phalotrans.com" style={{ color: '#3b82f6' }}>www.phalotrans.com</Link>
        </Text>

        {/* Disclaimer */}
        <Text style={{
          color: '#999999',
          fontSize: '11px',
          textAlign: 'center',
          marginTop: '15px',
          lineHeight: '1.4'
        }}>
          This is an automated message from Phalo Transportation.
          Please do not reply to this email. For any questions or changes,
          please contact us at 678-478-3506 or visit{' '}
          <Link href="https://www.phalotrans.com" style={{ color: '#3b82f6' }}>www.phalotrans.com</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
);

// 1. Booking Confirmed
export const BookingConfirmedEmail = (props: BaseProps) => (
  <EmailLayout previewText="Your reservation has been confirmed!">
    <Heading style={{ color: '#1f2937' }}>✅ Your Reservation is Confirmed!</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Thank you for choosing <strong>Phalo Transportation</strong>. Your booking has been successfully confirmed.</Text>

    <Section>
      <Text><strong>Booking ID:</strong> #{props.bookingId}</Text>
      <Text><strong>Pickup:</strong> {props.pickupLocation} on {props.pickupDate} at {props.pickupTime}</Text>
      <Text><strong>Vehicle:</strong> {props.vehicleType}</Text>
      {props.totalAmount && <Text><strong>Total Amount:</strong> ${props.totalAmount}</Text>}
    </Section>

    <Text>We look forward to providing you with excellent service.</Text>
  </EmailLayout>
);

// 2. Chauffeur En Route
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

// 3. Arrived at Pickup
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

// 4. Passenger on Board
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

// 5. Arrived at Destination
export const ArrivedAtDestinationEmail = (props: BaseProps) => (
  <EmailLayout previewText="You have arrived at your destination">
    <Heading style={{ color: '#8b5cf6' }}>🏁 Arrived at Destination</Heading>
    <Text>Dear {props.customerName},</Text>
    <Text>Your driver has successfully arrived at your destination.</Text>
    <Text>Thank you for riding with Phalo Transportation. We hope you had a pleasant journey.</Text>
  </EmailLayout>
);

// 6. Ride Completed + Payment Receipt
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

    <Text>Thank you for choosing <strong>Phalo Transportation</strong>! We hope to serve you again soon.</Text>
  </EmailLayout>
);

// 7. Cancellation
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
