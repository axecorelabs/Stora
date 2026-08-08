import {
  Body,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

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
  baseUrl = 'https://ivma.ng',
}) => {
  const previewText = `New order #${order.orderNumber} from ${order.customerSnapshot.firstName} ${order.customerSnapshot.lastName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={headerHeading}>🎉 New Order Received!</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={paragraph}>Hi {storeName},</Text>
            <Text style={paragraph}>
              Great news! You have received a new order through your IVMA store.
            </Text>

            {/* Order Details Box */}
            <Section style={orderDetailsBox}>
              <Heading style={orderDetailsHeading}>Order Details</Heading>
              <table style={detailsTable}>
                <tbody>
                  <tr>
                    <td style={detailsLabel}>Order Number:</td>
                    <td style={detailsValue}>#{order.orderNumber}</td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>Customer:</td>
                    <td style={detailsValue}>
                      {order.customerSnapshot.firstName} {order.customerSnapshot.lastName}
                    </td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>Phone:</td>
                    <td style={detailsValue}>{order.customerSnapshot.phone}</td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>Total Items:</td>
                    <td style={detailsValue}>{order.storeItemCount}</td>
                  </tr>
                  <tr>
                    <td style={detailsLabel}>Order Total:</td>
                    <td style={detailsTotal}>₦{order.storeTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Items List */}
            <Heading style={sectionHeading}>Ordered Items:</Heading>
            <table style={itemsTable}>
              <thead>
                <tr style={itemsTableHeader}>
                  <th style={itemsTableHeaderCell}>Product</th>
                  <th style={itemsTableHeaderCellCenter}>Qty</th>
                  <th style={itemsTableHeaderCellRight}>Price</th>
                </tr>
              </thead>
              <tbody>
                {order.storeItems.map((item, index) => (
                  <tr key={index} style={itemsTableRow}>
                    <td style={itemsTableCell}>{item.productSnapshot.productName}</td>
                    <td style={itemsTableCellCenter}>{item.quantity}</td>
                    <td style={itemsTableCellRight}>₦{item.subtotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Shipping Address */}
            <Section style={addressBox}>
              <Heading style={addressHeading}>📍 Delivery Address</Heading>
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
                Phone: {order.shippingAddress.phone}
              </Text>
            </Section>

            {/* Customer Notes */}
            {order.customerNotes && (
              <Section style={notesBox}>
                <Heading style={notesHeading}>📝 Customer Notes:</Heading>
                <Text style={notesText}>{order.customerNotes}</Text>
              </Section>
            )}

            {/* Action Button */}
            <Section style={buttonContainer}>
              <Link
                style={button}
                href={`${baseUrl}/dashboard/orders/${order._id}`}
              >
                View Order Details
              </Link>
            </Section>

            {/* Next Steps */}
            <Section style={nextStepsBox}>
              <Text style={nextStepsText}>
                <strong>💡 Next Steps:</strong>
                <br />
                1. Contact the customer via WhatsApp to confirm the order
                <br />
                2. Prepare the items for delivery
                <br />
                3. Update the order status in your dashboard
                <br />
                4. Arrange delivery or pickup with the customer
              </Text>
            </Section>

            <Text style={paragraph}>
              Thank you for using IVMA Store to manage your business!
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Need help? Contact us at{' '}
              <Link href="mailto:support@ivmastore.com" style={footerLink}>
                support@ivmastore.com
              </Link>
            </Text>
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} IVMA Store. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default NewOrderNotification;

// Styles
const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  marginTop: '20px',
  marginBottom: '20px',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  maxWidth: '600px',
};

const header = {
  background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
  backgroundColor: '#0D9488',
  padding: '40px 30px',
  textAlign: 'center',
};

const headerHeading = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1.3',
};

const content = {
  padding: '40px 30px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#333333',
  margin: '0 0 20px',
};

const orderDetailsBox = {
  margin: '30px 0',
  padding: '20px',
  backgroundColor: '#F0FDFA',
  borderLeft: '4px solid #0D9488',
  borderRadius: '4px',
};

const orderDetailsHeading = {
  fontSize: '18px',
  color: '#0D9488',
  margin: '0 0 15px',
  fontWeight: 'bold',
};

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse',
};

const detailsLabel = {
  fontSize: '14px',
  color: '#666666',
  padding: '5px 0',
  width: '40%',
};

const detailsValue = {
  fontSize: '14px',
  color: '#333333',
  padding: '5px 0',
  fontWeight: '500',
};

const detailsTotal = {
  fontSize: '18px',
  color: '#0D9488',
  padding: '5px 0',
  fontWeight: 'bold',
};

const sectionHeading = {
  fontSize: '16px',
  color: '#333333',
  margin: '20px 0 15px',
  fontWeight: '600',
};

const itemsTable = {
  width: '100%',
  border: '1px solid #e5e5e5',
  borderRadius: '4px',
  borderCollapse: 'collapse',
  marginBottom: '20px',
};

const itemsTableHeader = {
  backgroundColor: '#f9f9f9',
};

const itemsTableHeaderCell = {
  textAlign: 'left',
  fontSize: '12px',
  color: '#666666',
  padding: '10px',
  fontWeight: '600',
};

const itemsTableHeaderCellCenter = {
  textAlign: 'center',
  fontSize: '12px',
  color: '#666666',
  padding: '10px',
  fontWeight: '600',
};

const itemsTableHeaderCellRight = {
  textAlign: 'right',
  fontSize: '12px',
  color: '#666666',
  padding: '10px',
  fontWeight: '600',
};

const itemsTableRow = {
  borderTop: '1px solid #e5e5e5',
};

const itemsTableCell = {
  fontSize: '14px',
  color: '#333333',
  padding: '10px',
};

const itemsTableCellCenter = {
  fontSize: '14px',
  color: '#333333',
  padding: '10px',
  textAlign: 'center',
};

const itemsTableCellRight = {
  fontSize: '14px',
  color: '#333333',
  padding: '10px',
  textAlign: 'right',
};

const addressBox = {
  margin: '30px 0',
  padding: '20px',
  backgroundColor: '#f9f9f9',
  borderRadius: '4px',
};

const addressHeading = {
  fontSize: '16px',
  color: '#333333',
  margin: '0 0 10px',
  fontWeight: '600',
};

const addressText = {
  fontSize: '14px',
  color: '#666666',
  lineHeight: '1.6',
  margin: '0',
};

const notesBox = {
  margin: '20px 0',
  padding: '15px',
  backgroundColor: '#FEF3C7',
  borderLeft: '4px solid #F59E0B',
  borderRadius: '4px',
};

const notesHeading = {
  fontSize: '14px',
  color: '#92400E',
  margin: '0 0 10px',
  fontWeight: '600',
};

const notesText = {
  fontSize: '14px',
  color: '#92400E',
  lineHeight: '1.6',
  margin: '0',
};

const buttonContainer = {
  margin: '30px 0',
  textAlign: 'center',
};

const button = {
  backgroundColor: '#0D9488',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '16px 40px',
};

const nextStepsBox = {
  margin: '30px 0',
  padding: '16px',
  backgroundColor: '#DBEAFE',
  borderLeft: '4px solid #3B82F6',
  borderRadius: '4px',
};

const nextStepsText = {
  fontSize: '14px',
  color: '#1E40AF',
  lineHeight: '1.6',
  margin: '0',
};

const footer = {
  backgroundColor: '#f5f5f5',
  padding: '30px',
  textAlign: 'center',
  borderTop: '1px solid #e5e5e5',
};

const footerText = {
  fontSize: '14px',
  color: '#666666',
  margin: '0 0 10px',
};

const footerLink = {
  color: '#0D9488',
  textDecoration: 'none',
};

const footerCopyright = {
  fontSize: '12px',
  color: '#999999',
  margin: '0',
};
