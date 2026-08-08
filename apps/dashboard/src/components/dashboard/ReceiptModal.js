"use client";
import { X, Download, Printer, FileText, Truck, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import DeliveryScheduleModal from "./DeliveryScheduleModal";
import { generateReceiptPDF } from "@/lib/email/utils/pdfGenerator";

export default function ReceiptModal({ isOpen, onClose, sale }) {
  const { secureApiCall } = useAuth();
  const [store, setStore] = useState(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  // Fetch store information
  const fetchStoreInfo = async () => {
    try {
      const response = await secureApiCall('/api/stores');
      if (response.success && response.hasStore) {
        setStore(response.data);
      }
    } catch (error) {
      console.error('Error fetching store info:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStoreInfo();
    }
  }, [isOpen]);

  if (!isOpen || !sale) return null;

  // Add safety check for sale.items
  const saleItems = sale.items || [];
  const hasItems = saleItems.length > 0;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate receipt HTML content
  const generateReceiptHTML = () => {
    const storeName = store?.storeName || 'IVMA STORE';
    const storeAddress = store?.storeType === 'physical' && store?.fullAddress ? store.fullAddress : '';
    const storePhone = store?.storePhone || '';
    const storeEmail = store?.storeEmail || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${sale.transactionId}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            margin: 20px; 
            max-width: 300px; 
            font-size: 12px; 
            line-height: 1.4;
          }
          .header { 
            text-align: center; 
            border-bottom: 1px dashed #000; 
            padding-bottom: 10px; 
            margin-bottom: 10px;
          }
          .store-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .store-info {
            font-size: 10px;
            margin-bottom: 2px;
          }
          .item { 
            display: flex; 
            justify-content: space-between; 
            margin: 3px 0; 
          }
          .total { 
            border-top: 1px dashed #000; 
            padding-top: 10px; 
            font-weight: bold; 
            margin-top: 10px;
          }
          .footer { 
            text-align: center; 
            margin-top: 20px; 
            border-top: 1px dashed #000; 
            padding-top: 10px; 
          }
          .powered-by {
            font-size: 8px;
            color: #666;
            margin-top: 10px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${storeName}</div>
          ${storeAddress ? `<div class="store-info">${storeAddress}</div>` : ''}
          ${storePhone ? `<div class="store-info">Tel: ${storePhone}</div>` : ''}
          ${storeEmail ? `<div class="store-info">Email: ${storeEmail}</div>` : ''}
          <p style="margin-top: 10px;">Receipt #${sale.transactionId}</p>
          <p>${formatDate(sale.saleDate)}</p>
        </div>
        
        <div style="margin: 10px 0;">
          ${sale.customer.name ? `<p>Customer: ${sale.customer.name}</p>` : ''}
          ${sale.customer.phone ? `<p>Phone: ${sale.customer.phone}</p>` : ''}
        </div>

        <div>
          ${sale.items.map(item => `
            <div class="item">
              <span>${item.productName} x${item.quantity}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
        </div>

        <div class="total">
          <div class="item">
            <span>Subtotal:</span>
            <span>${formatCurrency(sale.subtotal)}</span>
          </div>
          ${sale.discount > 0 ? `
            <div class="item">
              <span>Discount:</span>
              <span>-${formatCurrency(sale.discount)}</span>
            </div>
          ` : ''}
          ${sale.tax > 0 ? `
            <div class="item">
              <span>Tax:</span>
              <span>${formatCurrency(sale.tax)}</span>
            </div>
          ` : ''}
          <div class="item" style="font-size: 14px; margin-top: 5px;">
            <span>TOTAL:</span>
            <span>${formatCurrency(sale.total)}</span>
          </div>
          <div class="item">
            <span>Payment (${sale.paymentMethod}):</span>
            <span>${formatCurrency(sale.amountReceived)}</span>
          </div>
          ${sale.balance > 0 ? `
            <div class="item">
              <span>Change:</span>
              <span>${formatCurrency(sale.balance)}</span>
            </div>
          ` : ''}
        </div>

        <div class="footer">
          <p>${store?.settings?.receiptFooter || 'Thank you for your business!'}</p>
          <p>Please come again</p>
          <div class="powered-by">
            <p>Powered by IVMA</p>
            <p>ivma.ng</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Print receipt
  const printReceipt = () => {
    let receiptWindow;
    try {
      receiptWindow = window.open('', '_blank', 'width=300,height=600');
    } catch (error) {
      console.error('Failed to open popup window:', error);
    }

    if (!receiptWindow || receiptWindow.closed || typeof receiptWindow.closed === 'undefined') {
      // Popup blocked - show alert
      alert('Popup blocked! Please allow popups for printing receipts or use the download option.');
      return;
    }

    const receiptHTML = generateReceiptHTML() + `
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 1000);
        }
      </script>
    `;
    
    try {
      receiptWindow.document.write(receiptHTML);
      receiptWindow.document.close();
    } catch (error) {
      console.error('Error writing to receipt window:', error);
      receiptWindow.close();
      alert('Printing failed! Please use the download option or enable popups.');
    }
  };

  // Download receipt as HTML file
  const downloadReceipt = () => {
    try {
      const receiptHTML = generateReceiptHTML();
      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt_${sale.transactionId}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success message
      alert('Receipt downloaded successfully! You can open the HTML file in your browser and print it.');
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed! Please try again.');
    }
  };

  // Download receipt as PNG image
  const downloadReceiptAsImage = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Create a temporary div with receipt content
      const receiptDiv = document.createElement('div');
      receiptDiv.style.position = 'absolute';
      receiptDiv.style.left = '-9999px';
      receiptDiv.style.width = '350px';
      receiptDiv.style.backgroundColor = 'white';
      receiptDiv.style.padding = '30px';
      receiptDiv.style.fontFamily = "'Courier New', monospace";
      receiptDiv.style.fontSize = '13px';
      receiptDiv.style.lineHeight = '1.6';
      receiptDiv.style.color = '#000';
      
      const storeName = store?.storeName || 'IVMA STORE';
      const storeAddress = store?.storeType === 'physical' && store?.fullAddress ? store.fullAddress : '';
      const storePhone = store?.storePhone || '';
      const storeEmail = store?.storeEmail || '';
      
      receiptDiv.innerHTML = `
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px;">
          <div style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">${storeName}</div>
          ${storeAddress ? `<div style="font-size: 11px; margin-bottom: 3px;">${storeAddress}</div>` : ''}
          ${storePhone ? `<div style="font-size: 11px; margin-bottom: 3px;">Tel: ${storePhone}</div>` : ''}
          ${storeEmail ? `<div style="font-size: 11px; margin-bottom: 3px;">Email: ${storeEmail}</div>` : ''}
          <div style="margin-top: 10px; font-size: 14px; font-weight: bold;">Receipt #${sale.transactionId}</div>
          <div style="font-size: 11px; color: #666;">${formatDate(sale.saleDate)}</div>
        </div>
        
        ${sale.customer.name || sale.customer.phone ? `
          <div style="margin: 15px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;">
            ${sale.customer.name ? `<div style="margin-bottom: 5px;"><strong>Customer:</strong> ${sale.customer.name}</div>` : ''}
            ${sale.customer.phone ? `<div><strong>Phone:</strong> ${sale.customer.phone}</div>` : ''}
          </div>
        ` : ''}

        <div style="margin: 15px 0;">
          <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">ITEMS PURCHASED</div>
          ${sale.items.map(item => `
            <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 5px 0;">
              <div style="flex: 1;">
                <div style="font-weight: 500;">${item.productName}</div>
                <div style="font-size: 11px; color: #666;">Qty: ${item.quantity} × ${formatCurrency(item.unitPrice)}</div>
              </div>
              <div style="font-weight: bold; text-align: right;">${formatCurrency(item.total)}</div>
            </div>
          `).join('')}
        </div>

        <div style="border-top: 2px dashed #000; padding-top: 15px; margin-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin: 6px 0;">
            <span>Subtotal:</span>
            <span style="font-weight: 500;">${formatCurrency(sale.subtotal)}</span>
          </div>
          ${sale.discount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 6px 0; color: #dc2626;">
              <span>Discount:</span>
              <span style="font-weight: 500;">-${formatCurrency(sale.discount)}</span>
            </div>
          ` : ''}
          ${sale.tax > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 6px 0;">
              <span>Tax:</span>
              <span style="font-weight: 500;">${formatCurrency(sale.tax)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; margin: 10px 0 6px 0; padding-top: 10px; border-top: 1px solid #000; font-size: 16px; font-weight: bold;">
            <span>TOTAL:</span>
            <span>${formatCurrency(sale.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 12px;">
            <span>Paid (${sale.paymentMethod}):</span>
            <span style="font-weight: 500;">${formatCurrency(sale.amountReceived)}</span>
          </div>
          ${sale.balance > 0 ? `
            <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 12px; color: #059669;">
              <span>Change:</span>
              <span style="font-weight: bold;">${formatCurrency(sale.balance)}</span>
            </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 2px dashed #000;">
          <div style="font-size: 13px; margin-bottom: 5px;">${store?.settings?.receiptFooter || 'Thank you for your business!'}</div>
          <div style="font-size: 12px; color: #666;">Please come again</div>
          <div style="margin-top: 15px; font-size: 10px; color: #999;">
            <div>Powered by IVMA</div>
            <div>ivma.ng</div>
          </div>
        </div>
      `;
      
      document.body.appendChild(receiptDiv);
      
      // Generate canvas from the div
      const canvas = await html2canvas(receiptDiv, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        windowWidth: 350,
        windowHeight: receiptDiv.scrollHeight
      });
      
      // Remove temporary div
      document.body.removeChild(receiptDiv);
      
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Receipt_${sale.transactionId}_${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
      
      alert('Receipt image downloaded successfully!');
    } catch (error) {
      console.error('Image generation failed:', error);
      alert('Image generation failed! Please try downloading as PDF instead.');
    }
  };

  // Download receipt as PDF - NOW USING SHARED UTILITY WITH LOGO AND BRANDING
  const downloadReceiptAsPDF = async () => {
    try {
      const storeName = store?.storeName || 'IVMA Store';
      const storeLogoUrl = store?.branding?.logo || null; // ✅ Use branding.logo
      const brandingColors = store?.branding ? {
        primaryColor: store.branding.primaryColor,
        secondaryColor: store.branding.secondaryColor
      } : null;
      
      // Prepare order data format
      const orderData = {
        orderNumber: sale.transactionId,
        customer: {
          name: sale.customer?.name || 'Walk-in Customer',
          phone: sale.customer?.phone || '',
          email: sale.customer?.email || ''
        }
      };
      
      // Prepare sale data format
      const saleData = {
        transactionId: sale.transactionId,
        items: sale.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          total: item.total,
          unitPrice: item.unitPrice
        })),
        subtotal: sale.subtotal,
        discount: sale.discount || 0,
        tax: sale.tax || 0,
        total: sale.total,
        saleDate: sale.saleDate,
        paymentMethod: sale.paymentMethod,
        linkedOrderId: sale.linkedOrderId || sale._id // Include linked order ID
      };
      
      // Generate PDF using shared utility with logo and branding
      const pdfData = await generateReceiptPDF(orderData, saleData, storeName, storeLogoUrl, brandingColors);
      
      if (!pdfData) {
        throw new Error('PDF generation failed');
      }
      
      // Convert base64 to blob and download
      const binaryString = atob(pdfData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('Receipt PDF downloaded successfully with store branding!');
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF generation failed! Please try another format.');
    }
  };

  // Handle delivery scheduling
  const handleScheduleDelivery = async (deliveryData) => {
    try {
      const response = await secureApiCall('/api/deliveries', {
        method: 'POST',
        body: JSON.stringify({
          saleId: sale._id,
          transactionId: sale.transactionId,
          ...deliveryData
        })
      });

      if (response.success) {
        alert('Delivery scheduled successfully!');
        setIsDeliveryModalOpen(false);
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error scheduling delivery:', error);
      throw error;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Receipt Details</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Receipt Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="text-center mb-6">
            <h4 className="text-xl font-bold text-gray-900">{store?.storeName || 'IVMA STORE'}</h4>
            {store?.storeType === 'physical' && store?.fullAddress && (
              <p className="text-sm text-gray-600 mt-1">{store.fullAddress}</p>
            )}
            {store?.storePhone && (
              <p className="text-sm text-gray-600">Tel: {store.storePhone}</p>
            )}
            {store?.storeEmail && (
              <p className="text-sm text-gray-600">Email: {store.storeEmail}</p>
            )}
            <p className="text-sm text-gray-600 mt-2">Receipt #{sale.transactionId}</p>
            <p className="text-sm text-gray-600">{formatDate(sale.saleDate)}</p>
          </div>

          {/* Customer Information - Add safety check */}
          {sale.customer && (sale.customer.name || sale.customer.phone) && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Customer Information</h5>
              {sale.customer.name && (
                <p className="text-sm text-gray-600">
                  <strong>Name:</strong> {sale.customer.name}
                </p>
              )}
              {sale.customer.phone && (
                <p className="text-sm text-gray-600">
                  <strong>Phone:</strong> {sale.customer.phone}
                </p>
              )}
              {sale.customer.email && (
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {sale.customer.email}
                </p>
              )}
            </div>
          )}

          {/* Items Purchased */}
          {hasItems && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Items Purchased</h5>
              <div className="space-y-2">
                {saleItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="text-gray-600">{item.productName} x{item.quantity}</span>
                      {/* Variant Information */}
                      {item.variant && item.variant.hasVariant && item.variant.size && item.variant.color && (
                        <span className="text-teal-600 text-xs ml-1">
                          ({item.variant.color} - {item.variant.size})
                        </span>
                      )}
                    </div>
                    <span className="text-gray-900 font-medium">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-red-600">-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              {sale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="text-gray-900">{formatCurrency(sale.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span className="text-gray-600">Total:</span>
                <span className="text-gray-900">{formatCurrency(sale.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment (${sale.paymentMethod}):</span>
                <span className="text-gray-900">{formatCurrency(sale.amountReceived)}</span>
              </div>
              {sale.balance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Change:</span>
                  <span className="text-green-600">{formatCurrency(sale.balance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          {/* <div className="border-t border-b border-gray-200 py-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-600">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sale.items.map((item, index) => (
                  <tr key={index} className="border-t border-gray-100">
                    <td className="py-2">
                      <div>
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        
                        {item.variant && item.variant.hasVariant && (
                          <div className="text-xs text-teal-600 mt-0.5">
                            {item.variant.color} - {item.variant.size}
                            {item.variant.variantSku && (
                              <span className="text-gray-500 ml-1">
                                (SKU: {item.variant.variantSku})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {item.categoryDetails && item.categoryDetails.category && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.categoryDetails.category}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                      </div>
                    </td>
                    <td className="py-2 text-center text-gray-900">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          
          {sale.items.some(item => item.batchesSoldFrom && item.batchesSoldFrom.length > 0) && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Batch Information</h4>
              <div className="space-y-2">
                {sale.items
                  .filter(item => item.batchesSoldFrom && item.batchesSoldFrom.length > 0)
                  .map((item, itemIndex) => (
                    <div key={itemIndex} className="text-xs">
                      <div className="font-medium text-blue-900">
                        {item.productName}
                        {item.variant && item.variant.hasVariant && (
                          <span className="text-teal-600 ml-1">
                            ({item.variant.color} - {item.variant.size})
                          </span>
                        )}
                      </div>
                      {item.batchesSoldFrom.map((batch, batchIndex) => (
                        <div key={batchIndex} className="ml-2 text-blue-700">
                          • Batch {batch.batchCode}: {batch.quantityFromBatch} units
                          {batch.batchVariant && batch.batchVariant.size && batch.batchVariant.color && (
                            <span className="text-teal-600 ml-1">
                              [{batch.batchVariant.color} - {batch.batchVariant.size}]
                            </span>
                          )}
                          {' '}@ {formatCurrency(batch.costPriceFromBatch)} each
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {sale.items.some(item => item.categoryDetails && Object.keys(item.categoryDetails).length > 1) && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Product Details</h4>
              <div className="space-y-3">
                {sale.items
                  .filter(item => item.categoryDetails && Object.keys(item.categoryDetails).length > 1)
                  .map((item, itemIndex) => (
                    <div key={itemIndex} className="text-xs">
                      <div className="font-medium text-gray-900 mb-1">
                        {item.productName}
                        {item.variant && item.variant.hasVariant && (
                          <span className="text-teal-600 ml-1">
                            ({item.variant.color} - {item.variant.size})
                          </span>
                        )}
                      </div>
                      <div className="ml-2 space-y-0.5 text-gray-600">
                        {item.categoryDetails.clothingDetails && (
                          <>
                            <div>Material: {item.categoryDetails.clothingDetails.material}</div>
                            {item.categoryDetails.clothingDetails.gender && (
                              <div>Gender: {item.categoryDetails.clothingDetails.gender}</div>
                            )}
                          </>
                        )}
                       
                        {item.categoryDetails.foodDetails && (
                          <>
                            {item.categoryDetails.foodDetails.foodType && (
                              <div>Type: {item.categoryDetails.foodDetails.foodType}</div>
                            )}
                            {item.categoryDetails.foodDetails.spiceLevel && (
                              <div>Spice Level: {item.categoryDetails.foodDetails.spiceLevel}</div>
                            )}
                          </>
                        )}
                        
                        {item.categoryDetails.electronicsDetails && (
                          <>
                            {item.categoryDetails.electronicsDetails.brand && (
                              <div>Brand: {item.categoryDetails.electronicsDetails.brand}</div>
                            )}
                            {item.categoryDetails.electronicsDetails.model && (
                              <div>Model: {item.categoryDetails.electronicsDetails.model}</div>
                            )}
                          </>
                        )}
                        
                        {item.categoryDetails.perfumeDetails && (
                          <>
                            {item.categoryDetails.perfumeDetails.volume && (
                              <div>Volume: {item.categoryDetails.perfumeDetails.volume}</div>
                            )}
                            {item.categoryDetails.perfumeDetails.scentFamily && (
                              <div>Scent: {item.categoryDetails.perfumeDetails.scentFamily}</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )} */}

          {/* IVMA Branding */}
          <div className="text-center mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">Powered by IVMA</p>
            <p className="text-xs text-gray-400">ivma.ng</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={printReceipt}
              className="flex items-center justify-center px-3 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </button>
            
            <button
              onClick={() => setIsDeliveryModalOpen(true)}
              className="flex items-center justify-center px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Truck className="w-4 h-4 mr-1.5" />
              Delivery
            </button>
            
            <button
              onClick={downloadReceiptAsPDF}
              className="flex items-center justify-center px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              title="Download as PDF"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              PDF
            </button>
            
            <button
              onClick={downloadReceiptAsImage}
              className="flex items-center justify-center px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              title="Download as Image"
            >
              <ImageIcon className="w-4 h-4 mr-1.5" />
              Image
            </button>
            
            {/* <button
              onClick={downloadReceipt}
              className="flex items-center justify-center px-3 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              title="Download as HTML"
            >
              <Download className="w-4 h-4 mr-1.5" />
              HTML
            </button> */}
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Print for immediate use, or download as PDF/Image for sharing
          </p>
        </div>
      </div>

      {/* Delivery Schedule Modal */}
      <DeliveryScheduleModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        onSubmit={handleScheduleDelivery}
        sale={sale}
      />
    </div>
  );
}
