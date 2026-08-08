import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { processItemWithBatchTracking } from '@/lib/batchInventory';

// Generate unique transaction ID
function generateTransactionId() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                 (now.getMonth() + 1).toString().padStart(2, '0') + 
                 now.getDate().toString().padStart(2, '0');
  const timeStr = now.getHours().toString().padStart(2, '0') + 
                 now.getMinutes().toString().padStart(2, '0') + 
                 now.getSeconds().toString().padStart(2, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${dateStr}-${timeStr}-${randomSuffix}`;
}

// POST - Process a new sale with batch tracking
export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const saleData = await req.json();
    
    // Determine if this is an order processing or regular POS sale
    const isOrderProcessing = saleData.isOrderProcessing || saleData.isFromOrder || false;
    
    try {
      // Process each item with batch tracking
      const processedItems = [];
      const saleItemsToInsert = [];
      let totalBatchesUsed = 0;
      let totalCostFromBatches = 0;
      let totalProfitFromBatches = 0;

      for (const item of saleData.items) {
        const result = await processItemWithBatchTracking(item, user.id, isOrderProcessing);
        processedItems.push(result.processedItem);
        if (result.saleItemData) {
          saleItemsToInsert.push(result.saleItemData);
        }
        totalBatchesUsed += result.batchesUsed;
        totalCostFromBatches += result.totalCost;
        totalProfitFromBatches += result.totalProfit;
      }

      // Calculate average cost per unit
      const totalQuantitySold = processedItems.reduce((sum, item) => sum + item.quantity, 0);
      const averageCostPerUnit = totalQuantitySold > 0 ? totalCostFromBatches / totalQuantitySold : 0;

      // Generate transaction ID
      const transactionId = generateTransactionId();

      // Create the sale record
      const saleRecord = {
        id: uuidv4(),
        user_id: user.id,
        transaction_id: transactionId,
        customer_name: saleData.customer?.name || null,
        customer_phone: saleData.customer?.phone || null,
        customer_email: saleData.customer?.email || null,
        subtotal: Number(saleData.subtotal) || 0,
        discount: Number(saleData.discount) || 0,
        tax: Number(saleData.tax) || 0,
        total: Number(saleData.total) || 0,
        payment_method: saleData.paymentMethod || 'cash',
        amount_received: Number(saleData.amountReceived) || 0,
        balance: Number(saleData.balance) || 0,
        sale_date: new Date().toISOString(),
        status: 'completed',
        sold_by: user.id,
        notes: saleData.notes || null,
        total_batches_used: totalBatchesUsed,
        total_cost_from_batches: totalCostFromBatches,
        total_profit_from_batches: totalProfitFromBatches,
        average_cost_per_unit: averageCostPerUnit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert the sale
      const { data: sale, error: saleError } = await supabaseAdmin
        .from('sales')
        .insert(saleRecord)
        .select()
        .single();

      if (saleError) {
        console.error('Sale insert error:', saleError);
        throw new Error('Failed to create sale record');
      }

      // Insert sale items with the sale ID. batches_sold_from isn't a real
      // sale_items column -- it's kept on the in-memory objects only to build
      // the normalized sale_item_batches rows below, so strip it before insert.
      if (saleItemsToInsert.length > 0) {
        const itemsWithSaleId = saleItemsToInsert.map(item => {
          const { batches_sold_from, ...dbFields } = item;
          return { ...dbFields, sale_id: sale.id };
        });

        const { data: insertedSaleItems, error: itemsError } = await supabaseAdmin
          .from('sale_items')
          .insert(itemsWithSaleId)
          .select();

        if (itemsError) {
          console.error('Sale items insert error:', itemsError);
          throw new Error(`Failed to record sale items: ${itemsError.message}`);
        }

        // Insert sale_item_batches for batch traceability
        if (insertedSaleItems && insertedSaleItems.length > 0) {
          const batchRecords = [];
          
          // Map through original items to get batch data
          saleItemsToInsert.forEach((saleItemData, index) => {
            const insertedItem = insertedSaleItems[index];
            if (insertedItem && saleItemData.batches_sold_from && saleItemData.batches_sold_from.length > 0) {
              saleItemData.batches_sold_from.forEach(batch => {
                batchRecords.push({
                  id: uuidv4(),
                  sale_item_id: insertedItem.id,
                  batch_id: batch.batchId,
                  batch_code: batch.batchCode,
                  quantity_from_batch: batch.quantityFromBatch,
                  cost_price_from_batch: batch.costPriceFromBatch,
                  created_at: new Date().toISOString()
                });
              });
            }
          });

          if (batchRecords.length > 0) {
            const { error: batchError } = await supabaseAdmin
              .from('sale_item_batches')
              .insert(batchRecords);

            if (batchError) {
              console.error('Sale item batches insert error:', batchError);
              // Don't throw - this is for traceability only
            }
          }
        }
      }

      // If processing an order, create order_payment record
      if (isOrderProcessing && saleData.linkedOrderId) {
        const orderPayment = {
          id: uuidv4(),
          order_id: saleData.linkedOrderId,
          method: saleData.paymentMethod || 'cash',
          provider: 'manual',
          transaction_id: transactionId,
          reference: `SALE-${sale.id}`,
          status: 'completed',
          amount: Number(saleData.total) || 0,
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: paymentError } = await supabaseAdmin
          .from('order_payments')
          .insert(orderPayment);

        if (paymentError) {
          console.error('Order payment insert error:', paymentError);
          // Don't throw - sale is already created
        }
      }

      console.log('Sale created successfully with batch tracking:', {
        id: sale.id,
        transactionId: sale.transaction_id,
        total: sale.total,
        batchesUsed: totalBatchesUsed,
        isOrderProcessing
      });

      return NextResponse.json({
        success: true,
        message: 'Sale recorded successfully with batch tracking',
        data: {
          _id: sale.id,
          id: sale.id,
          transactionId: sale.transaction_id,
          total: sale.total,
          subtotal: sale.subtotal,
          saleDate: sale.sale_date,
          status: sale.status,
          batchSummary: {
            totalBatchesUsed,
            totalCostFromBatches,
            totalProfitFromBatches,
            averageCostPerUnit
          }
        }
      });

    } catch (error) {
      console.error('Sale processing error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Sale creation error:', error);
    
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Fetch sales for user
export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const paymentMethod = searchParams.get('paymentMethod');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const inventoryId = searchParams.get('inventoryId');
    const batchId = searchParams.get('batchId');

    const offset = (page - 1) * limit;

    // Build base query
    let query = supabaseAdmin
      .from('sales')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add filters
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }
    if (startDate) {
      query = query.gte('sale_date', new Date(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte('sale_date', new Date(endDate).toISOString());
    }

    const { data: sales, error: salesError, count } = await query;

    if (salesError) {
      console.error('Sales fetch error:', salesError);
      throw new Error('Failed to fetch sales');
    }

    // Fetch sale items for each sale
    let processedSales = [];
    
    if (sales && sales.length > 0) {
      const saleIds = sales.map(s => s.id);
      
      const { data: saleItems } = await supabaseAdmin
        .from('sale_items')
        .select('*')
        .in('sale_id', saleIds);

      // Group items by sale ID
      const itemsBySaleId = {};
      (saleItems || []).forEach(item => {
        if (!itemsBySaleId[item.sale_id]) {
          itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push({
          _id: item.id,
          id: item.id,
          inventoryId: item.inventory_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price || 0),
          total: parseFloat(item.total || 0),
          variant: item.variant_info,
          batchesSoldFrom: item.batches_sold_from || [],
          costBreakdown: {
            totalCost: parseFloat(item.total_cost || 0),
            weightedAverageCost: parseFloat(item.weighted_average_cost || 0),
            profit: parseFloat(item.profit || 0)
          }
        });
      });

      // Transform sales
      processedSales = sales.map(sale => ({
        _id: sale.id,
        id: sale.id,
        transactionId: sale.transaction_id,
        userId: sale.user_id,
        customer: {
          name: sale.customer_name || '',
          phone: sale.customer_phone || '',
          email: sale.customer_email || ''
        },
        items: itemsBySaleId[sale.id] || [],
        subtotal: parseFloat(sale.subtotal || 0),
        discount: parseFloat(sale.discount || 0),
        tax: parseFloat(sale.tax || 0),
        total: parseFloat(sale.total || 0),
        paymentMethod: sale.payment_method,
        amountReceived: parseFloat(sale.amount_received || 0),
        balance: parseFloat(sale.balance || 0),
        saleDate: sale.sale_date,
        status: sale.status,
        soldBy: sale.sold_by,
        notes: sale.notes,
        batchSummary: {
          totalBatchesUsed: sale.total_batches_used || 0,
          totalCostFromBatches: parseFloat(sale.total_cost_from_batches || 0),
          totalProfitFromBatches: parseFloat(sale.total_profit_from_batches || 0),
          averageCostPerUnit: parseFloat(sale.average_cost_per_unit || 0)
        },
        createdAt: sale.created_at,
        updatedAt: sale.updated_at
      }));

      // Filter by inventoryId or batchId if specified
      if (inventoryId) {
        processedSales = processedSales.map(sale => ({
          ...sale,
          items: sale.items.filter(item => item.inventoryId === inventoryId)
        })).filter(sale => sale.items.length > 0);
      }

      if (batchId) {
        processedSales = processedSales.map(sale => ({
          ...sale,
          items: sale.items.filter(item => 
            item.batchesSoldFrom && 
            item.batchesSoldFrom.some(batch => batch.batchId === batchId)
          )
        })).filter(sale => sale.items.length > 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sales: processedSales,
        pagination: {
          current: page,
          pages: Math.ceil((count || 0) / limit),
          total: count || 0,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Sales fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
