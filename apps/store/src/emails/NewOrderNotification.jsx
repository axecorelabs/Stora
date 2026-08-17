import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  brand,
  gold,
  main,
  container,
  header,
  eyebrow,
  headerHeading,
  content,
  paragraph,
  label,
  button,
  footer,
  footerText,
  footerLink,
  footerCopyright,
} from './shared/brand';

export const NewOrderNotification = ({
  storeName = 'Your Store',
  storeEmail = 'store@example.com',
  order = {
    orderNumber: '12345',
    customerSnapshot: {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+234 803 123 4567',
    },
    shippingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      city: 'Lagos',
      state: 'Lagos State',
      phone: '+234 803 123 4567',
      street: '123 Main Street',
    },
    storeItems: [
      {
        productSnapshot: { productName: 'Sample Product' },
        quantity: 2,
        subtotal: 5000,
      },
    ],
    storeTotal: 5000,
    storeItemCount: 2,
    customerNotes: '',
    _id: '123',
  },
  baseUrl = 'https://app.stora.com.ng',
}) => {
  const previewText = `New order #${order.orderNumber} from ${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName} -- ${formatNaira(order.storeTotal)}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrow}>STORA</Text>
            <Heading style={headerHeading}>New order received</Heading>
          </Section>

          <Section style={content}>
            <Text style={paragraph}>
              Hi {storeName}, you have a new order through your Stora store.
            </Text>

            {/* Order summary -- one card, not several competing boxes */}
            <Section style={summaryCard}>
              <table style={summaryTable}>
                <tbody>
                  <SummaryRow label="Order" value={`#${order.orderNumber}`} />
                  <SummaryRow
                    label="Customer"
                    value={`${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}`}
                  />
                  <SummaryRow label="Phone" value={order.customerSnapshot.phone} />
                  <SummaryRow
                    label="Items"
                    value={`${order.storeItemCount} ${order.storeItemCount === 1 ? 'item' : 'items'}`}
                  />
                  <tr>
                    <td style={summaryTotalLabel}>Total</td>
                    <td style={summaryTotalValue}>{formatNaira(order.storeTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Items */}
            <table style={itemsTable}>
              <thead>
                <tr>
                  <th style={cell({ align: 'left', header: true })}>Product</th>
                  <th style={cell({ align: 'center', header: true })}>Qty</th>
                  <th style={cell({ align: 'right', header: true })}>Price</th>
                </tr>
              </thead>
              <tbody>
                {order.storeItems.map((item, index) => (
                  <tr key={index} style={itemsRow}>
                    <td style={cell({ align: 'left' })}>{item.productSnapshot.productName}</td>
                    <td style={cell({ align: 'center' })}>{item.quantity}</td>
                    <td style={cell({ align: 'right' })}>{formatNaira(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Delivery address -- a labeled block, not a second heavy box */}
            <Section style={addressSection}>
              <Text style={label}>Delivery address</Text>
              <Text style={addressText}>
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                <br />
                {order.shippingAddress.street && (
                  <>
                    {order.shippingAddress.street}
                    <br />
                  </>
                )}
                {order.shippingAddress.city}, {order.shippingAddress.state}
                <br />
                {order.shippingAddress.phone}
              </Text>
            </Section>

            {order.customerNotes && (
              <Section style={notesBox}>
                <Text style={notesLabel}>Note from the customer</Text>
                <Text style={notesText}>{order.customerNotes}</Text>
              </Section>
            )}

            <Section style={buttonContainer}>
              <Link style={button} href={`${baseUrl}/dashboard/orders/${order._id}`}>
                View order
              </Link>
            </Section>

            <Section style={nextSteps}>
              <Text style={label}>Next steps</Text>
              <Text style={nextStepsText}>
                1. Confirm the order with the customer via WhatsApp
                <br />
                2. Prepare the items
                <br />
                3. Update the order status in your dashboard
                <br />
                4. Arrange delivery or pickup
              </Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Need help? {' '}
              <Link href="mailto:support@stora.com.ng" style={footerLink}>
                support@stora.com.ng
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} Stora. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default NewOrderNotification;

const formatNaira = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG')}`;

function SummaryRow({ label: rowLabel, value }) {
  return (
    <tr>
      <td style={summaryLabel}>{rowLabel}</td>
      <td style={summaryValue}>{value}</td>
    </tr>
  );
}

// One shared cell style instead of six near-duplicate objects (header/body
// x left/center/right) that only ever differed by textAlign and weight.
function cell({ align, header: isHeader = false }) {
  return {
    textAlign: align,
    fontSize: isHeader ? '12px' : '14px',
    color: isHeader ? brand[400] : brand[900],
    fontWeight: isHeader ? '600' : '400',
    padding: '10px',
    borderBottom: `1px solid ${brand[100]}`,
  };
}

// Template-specific styles -- shell/header/footer/button/label come from
// ./shared/brand, reused across every email in this app.
const summaryCard = {
  margin: '0 0 24px',
  padding: '18px 20px',
  backgroundColor: brand[50],
  borderLeft: `3px solid ${brand[600]}`,
  borderRadius: '6px',
};

const summaryTable = {
  width: '100%',
  borderCollapse: 'collapse',
};

const summaryLabel = {
  fontSize: '13px',
  color: brand[400],
  padding: '4px 0',
  width: '40%',
};

const summaryValue = {
  fontSize: '13px',
  color: brand[900],
  padding: '4px 0',
  fontWeight: '500',
};

const summaryTotalLabel = {
  fontSize: '15px',
  color: brand[900],
  fontWeight: '700',
  padding: '10px 0 0',
  borderTop: `1px solid ${brand[100]}`,
};

const summaryTotalValue = {
  fontSize: '17px',
  color: brand[800],
  fontWeight: '700',
  padding: '10px 0 0',
  textAlign: 'right',
  borderTop: `1px solid ${brand[100]}`,
};

const itemsTable = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: '24px',
};

const itemsRow = {
  borderTop: `1px solid ${brand[100]}`,
};

const addressSection = {
  margin: '0 0 24px',
};

const addressText = {
  fontSize: '14px',
  color: brand[900],
  lineHeight: '1.6',
  margin: '0',
};

const notesBox = {
  margin: '0 0 24px',
  padding: '14px 16px',
  backgroundColor: '#FAF7F0',
  borderLeft: `3px solid ${gold[400]}`,
  borderRadius: '6px',
};

const notesLabel = {
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: gold[700],
  margin: '0 0 6px',
};

const notesText = {
  fontSize: '14px',
  color: '#5C4A26',
  lineHeight: '1.6',
  margin: '0',
};

// Wider bottom margin than the shared default -- this template has a
// "Next steps" section after the button, which needs more breathing room
// than templates where the button is the last thing on the page.
const buttonContainer = {
  margin: '0 0 28px',
  textAlign: 'center',
};

const nextSteps = {
  margin: '0 0 8px',
};

const nextStepsText = {
  fontSize: '14px',
  color: brand[900],
  lineHeight: '1.9',
  margin: '0',
};
