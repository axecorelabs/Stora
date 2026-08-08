import { formatDateTime } from './formatters.js';

export const generateReceiptPDF = async (orderData, saleData, storeName = 'IVMA Store', storeLogoUrl = null, brandingColors = null) => {
  try {
    const { jsPDF } = await import('jspdf');
    const QRCode = (await import('qrcode')).default;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    const pageWidth = 80;
    const pageHeight = 150;
    const margin = 4;
    const contentMargin = 6;
    
    // Extract branding colors (default to teal if not provided)
    const primaryColor = brandingColors?.primaryColor || '#0D9488';
    const secondaryColor = brandingColors?.secondaryColor || '#F3F4F6';
    
    // Convert hex to RGB for PDF
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 13, g: 148, b: 136 }; // Default teal
    };
    
    const primaryRgb = hexToRgb(primaryColor);
    const secondaryRgb = hexToRgb(secondaryColor);
    
    // Add watermark background with brand color
    const addWatermark = () => {
      doc.setGState(new doc.GState({ opacity: 0.05 })); // Very light
      doc.setFontSize(40);
      doc.setFont('courier', 'bold');
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      
      doc.text('IVMA', pageWidth / 2, 40, { align: 'center', angle: -45 });
      doc.text('IVMA', pageWidth / 2, 80, { align: 'center', angle: -45 });
      doc.text('IVMA', pageWidth / 2, 120, { align: 'center', angle: -45 });
      
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setTextColor(0, 0, 0);
    };
    
    // Add dashed border
    const addDashedBorder = () => {
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.setLineDash([2, 2], 0);
      
      const borderMargin = 2;
      const borderWidth = pageWidth - (borderMargin * 2);
      const borderHeight = pageHeight - (borderMargin * 2);
      
      doc.rect(borderMargin, borderMargin, borderWidth, borderHeight);
      doc.setLineDash([], 0);
    };
    
    // Add decorative corner elements with brand color
    // const addCornerDecorations = () => {
    //   doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    //   doc.setLineWidth(0.5);
      
    //   const cornerSize = 5;
    //   const cornerMargin = 3;
      
    //   // Top-left
    //   doc.line(cornerMargin, cornerMargin + cornerSize, cornerMargin, cornerMargin);
    //   doc.line(cornerMargin, cornerMargin, cornerMargin + cornerSize, cornerMargin);
      
    //   // Top-right
    //   doc.line(pageWidth - cornerMargin - cornerSize, cornerMargin, pageWidth - cornerMargin, cornerMargin);
    //   doc.line(pageWidth - cornerMargin, cornerMargin, pageWidth - cornerMargin, cornerMargin + cornerSize);
      
    //   // Bottom-left
    //   doc.line(cornerMargin, pageHeight - cornerMargin - cornerSize, cornerMargin, pageHeight - cornerMargin);
    //   doc.line(cornerMargin, pageHeight - cornerMargin, cornerMargin + cornerSize, pageHeight - cornerMargin);
      
    //   // Bottom-right
    //   doc.line(pageWidth - cornerMargin - cornerSize, pageHeight - cornerMargin, pageWidth - cornerMargin, pageHeight - cornerMargin);
    //   doc.line(pageWidth - cornerMargin, pageHeight - cornerMargin, pageWidth - cornerMargin, pageHeight - cornerMargin - cornerSize);
      
    //   doc.setDrawColor(0, 0, 0);
    // };

    addWatermark();
    addDashedBorder();
    // addCornerDecorations();

    doc.setFont('courier', 'normal');
    
    let yPosition = 10;
    const lineHeight = 3.5;
    
    // Helper functions
    const addCenteredText = (text, fontSize = 10, isBold = false, color = null) => {
      doc.setFontSize(fontSize);
      if (isBold) doc.setFont('courier', 'bold');
      else doc.setFont('courier', 'normal');
      
      if (color) {
        const rgb = hexToRgb(color);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
      }
      
      const textWidth = doc.getTextWidth(text);
      const x = (pageWidth - textWidth) / 2;
      doc.text(text, Math.max(contentMargin, x), yPosition);
      
      if (color) {
        doc.setTextColor(0, 0, 0); // Reset to black
      }
      
      yPosition += lineHeight;
    };

    const addLeftRightText = (leftText, rightText, fontSize = 8) => {
      doc.setFontSize(fontSize);
      doc.setFont('courier', 'normal');
      
      const rightTextWidth = doc.getTextWidth(rightText);
      const rightX = pageWidth - contentMargin - rightTextWidth;
      
      const maxLeftWidth = rightX - contentMargin - 3;
      
      let displayLeftText = leftText;
      let leftTextWidth = doc.getTextWidth(displayLeftText);
      
      while (leftTextWidth > maxLeftWidth && displayLeftText.length > 8) {
        displayLeftText = displayLeftText.slice(0, -5) + '...';
        leftTextWidth = doc.getTextWidth(displayLeftText);
      }
      
      doc.text(displayLeftText, contentMargin, yPosition);
      doc.text(rightText, rightX, yPosition);
      yPosition += lineHeight;
    };

    const addSeparatorLine = (style = 'solid', color = null) => {
      yPosition += 1;
      doc.setLineWidth(0.1);
      
      if (color) {
        const rgb = hexToRgb(color);
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      }
      
      if (style === 'dashed') {
        doc.setLineDash([1, 1], 0);
      }
      
      doc.line(contentMargin, yPosition, pageWidth - contentMargin, yPosition);
      
      if (style === 'dashed') {
        doc.setLineDash([], 0);
      }
      
      if (color) {
        doc.setDrawColor(0, 0, 0); // Reset
      }
      
      yPosition += 2;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Remove store logo - causes signature errors
    // Store Header with brand color
    addCenteredText(storeName, 11, true, primaryColor);
    yPosition += 1;
    addCenteredText(`Order #${orderData.orderNumber}`, 8);
    addCenteredText(formatDate(saleData.saleDate), 6);
    
    addSeparatorLine('dashed', primaryColor);

    // Customer info
    if (orderData.customer.name) {
      doc.setFontSize(6);
      doc.text(`Customer: ${orderData.customer.name}`, contentMargin, yPosition);
      yPosition += lineHeight;
    }
    if (orderData.customer.phone) {
      doc.text(`Phone: ${orderData.customer.phone}`, contentMargin, yPosition);
      yPosition += lineHeight;
    }
    yPosition += 1;

    // Items header with brand color accent
    doc.setFontSize(6);
    doc.setFont('courier', 'bold');
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.text('ITEMS:', contentMargin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += lineHeight + 0.5;

    // Items list
    saleData.items.forEach(item => {
      doc.setFont('courier', 'normal');
      const productLine = `${item.productName} x${item.quantity}`;
      const priceText = item.total.toFixed(2);
      addLeftRightText(productLine, priceText, 6);
    });

    addSeparatorLine('dashed', primaryColor);

    yPosition += 2;
    // Totals
    doc.setFont('courier', 'normal');
    addLeftRightText('Subtotal:', saleData.subtotal.toFixed(2), 7);
    
    if (saleData.discount > 0) {
      addLeftRightText('Discount:', `-${saleData.discount.toFixed(2)}`, 7);
    }
    
    if (saleData.tax > 0) {
      addLeftRightText('Tax:', saleData.tax.toFixed(2), 7);
    }

    yPosition += 0.5;
    addSeparatorLine('solid', primaryColor);

    // Grand total with brand color
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');

    yPosition += 3;
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    const totalLabel = 'TOTAL:';
    const totalValue = saleData.total.toFixed(2);
    const totalValueWidth = doc.getTextWidth(totalValue);
    const totalX = pageWidth - contentMargin - totalValueWidth;
    doc.text(totalLabel, contentMargin, yPosition);
    doc.text(totalValue, totalX, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += lineHeight;

    yPosition += 2;
    addSeparatorLine('dashed', primaryColor);
    yPosition += 6;
    addCenteredText('Thank you for your purchase!', 6);
    addCenteredText('Order processed successfully', 6);
    
    yPosition += 2;

    // Generate QR Code
    try {
      const qrData = JSON.stringify({
        transactionId: saleData.transactionId,
        orderNumber: orderData.orderNumber,
        linkedOrderId: saleData.linkedOrderId || null,
        total: saleData.total,
        date: saleData.saleDate,
        customer: orderData.customer.name
      });

      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        color: {
          dark: primaryColor, // Use brand color for QR code
          light: '#FFFFFF'
        }
      });

      const qrSize = 25;
      const qrX = (pageWidth - qrSize) / 2;
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, yPosition, qrSize, qrSize);
      yPosition += qrSize + 2;

      doc.setFontSize(5);
      doc.setFont('courier', 'normal');
      addCenteredText('Scan for transaction details', 5);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }

    // IVMA branding
    yPosition += 1;
    doc.setFontSize(5);
    doc.setFont('courier', 'normal');
    doc.setTextColor(100, 100, 100);
    addCenteredText('Powered by IVMA', 5);
    addCenteredText('ivma.ng', 5);
    
    doc.setTextColor(0, 0, 0);

    const pdfOutput = doc.output('arraybuffer');
    const pdfBase64 = Buffer.from(pdfOutput).toString('base64');
    
    return {
      filename: `Receipt_${saleData.transactionId}.pdf`,
      content: pdfBase64,
      encoding: 'base64',
      contentType: 'application/pdf'
    };
  } catch (error) {
    console.error('Failed to generate receipt PDF:', error);
    return null;
  }
};
