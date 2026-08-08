import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import connectToDatabase from '../src/lib/mongodb.js';

// Import all MongoDB models
import User from '../src/models/User.js';
import Store from '../src/models/Store.js';
import Customer from '../src/models/Customer.js';
import Inventory from '../src/models/Inventory.js';
import Order from '../src/models/Order.js';
import Sale from '../src/models/Sale.js';
import DeliverySchedule from '../src/models/DeliverySchedule.js';
import Notification from '../src/models/Notification.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class DataMigrator {
  constructor() {
    this.batchSize = 1000;
    this.migrationLog = [];
  }

  log(message, type = 'info') {
    const logEntry = `[${new Date().toISOString()}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    this.migrationLog.push(logEntry);
  }

  async connectMongoDB() {
    await connectToDatabase();
    this.log('Connected to MongoDB');
  }

  async migrateUsers() {
    this.log('Starting Users migration...');
    let skip = 0;
    let migrated = 0;
    let errors = 0;

    while (true) {
      const users = await User.find().skip(skip).limit(this.batchSize).lean();
      if (users.length === 0) break;

      const transformedUsers = users.map(user => ({
        id: user._id.toString(),
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        password_hash: user.password,
        role: user.role || 'user',
        is_active: user.isActive !== false,
        last_login: user.lastLogin,
        is_subscribed: user.isSubscribed || false,
        date_subscribed: user.dateSubscribed,
        current_subscription_id: user.currentSubscription?.toString(),
        preferences: user.preferences || {},
        avatar: user.avatar,
        created_at: user.createdAt || new Date(),
        updated_at: user.updatedAt || new Date()
      }));

      const { error } = await supabase
        .from('users')
        .upsert(transformedUsers, { onConflict: 'id' });

      if (error) {
        this.log(`Error migrating users batch: ${error.message}`, 'error');
        errors += users.length;
      } else {
        migrated += users.length;
        this.log(`Migrated ${users.length} users (Total: ${migrated})`);
      }

      skip += this.batchSize;
    }

    this.log(`Users migration complete. Migrated: ${migrated}, Errors: ${errors}`);
  }

  async migrateStores() {
    this.log('Starting Stores migration...');
    let skip = 0;
    let migrated = 0;
    let errors = 0;

    while (true) {
      const stores = await Store.find().skip(skip).limit(this.batchSize).lean();
      if (stores.length === 0) break;

      const transformedStores = stores.map(store => ({
        id: store._id.toString(),
        owner_id: store.owner?.toString(),
        store_name: store.storeName,
        store_slug: store.slug,
        store_phone: store.phone,
        store_email: store.email,
        address: store.address,
        online_store_info: store.onlineStoreInfo,
        branding: store.branding,
        business_hours: store.businessHours,
        is_active: store.isActive !== false,
        created_at: store.createdAt || new Date(),
        updated_at: store.updatedAt || new Date()
      }));

      const { error } = await supabase
        .from('stores')
        .upsert(transformedStores, { onConflict: 'id' });

      if (error) {
        this.log(`Error migrating stores batch: ${error.message}`, 'error');
        errors += stores.length;
      } else {
        migrated += stores.length;
        this.log(`Migrated ${stores.length} stores (Total: ${migrated})`);
      }

      skip += this.batchSize;
    }

    this.log(`Stores migration complete. Migrated: ${migrated}, Errors: ${errors}`);
  }

  async migrateCustomers() {
    this.log('Starting Customers migration...');
    let skip = 0;
    let migrated = 0;
    let errors = 0;

    while (true) {
      const customers = await Customer.find().skip(skip).limit(this.batchSize).lean();
      if (customers.length === 0) break;

      const transformedCustomers = customers.map(customer => ({
        id: customer._id.toString(),
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        addresses: customer.addresses || [],
        preferences: customer.preferences || {},
        created_at: customer.createdAt || new Date(),
        updated_at: customer.updatedAt || new Date()
      }));

      const { error } = await supabase
        .from('customers')
        .upsert(transformedCustomers, { onConflict: 'id' });

      if (error) {
        this.log(`Error migrating customers batch: ${error.message}`, 'error');
        errors += customers.length;
      } else {
        migrated += customers.length;
        this.log(`Migrated ${customers.length} customers (Total: ${migrated})`);
      }

      skip += this.batchSize;
    }

    this.log(`Customers migration complete. Migrated: ${migrated}, Errors: ${errors}`);
  }

  async migrateInventory() {
    this.log('Starting Inventory migration...');
    let skip = 0;
    let migrated = 0;
    let variantsMigrated = 0;
    let errors = 0;

    while (true) {
      const inventoryItems = await Inventory.find().skip(skip).limit(this.batchSize).lean();
      if (inventoryItems.length === 0) break;

      for (const item of inventoryItems) {
        try {
          // Transform main inventory item
          const transformedItem = {
            id: item._id.toString(),
            store_id: item.store?.toString(),
            product_name: item.productName,
            sku: item.sku,
            category: item.category,
            brand: item.brand,
            unit_of_measure: item.unitOfMeasure,
            base_price: item.basePrice || 0,
            has_variants: item.hasVariants || false,
            quantity_in_stock: item.quantityInStock || 0,
            reorder_level: item.reorderLevel || 5,
            sold_quantity: item.soldQuantity || 0,
            images: item.images || [],
            description: item.description,
            details: item.details || item.clothingDetails || item.shoesDetails,
            tags: item.tags || [],
            is_active: item.isActive !== false,
            created_at: item.createdAt || new Date(),
            updated_at: item.updatedAt || new Date()
          };

          const { error: itemError } = await supabase
            .from('inventory')
            .upsert([transformedItem], { onConflict: 'id' });

          if (itemError) {
            this.log(`Error migrating inventory item ${item._id}: ${itemError.message}`, 'error');
            errors++;
            continue;
          }

          migrated++;

          // Migrate variants if they exist
          if (item.variants && item.variants.length > 0) {
            const transformedVariants = item.variants.map(variant => ({
              id: variant._id.toString(),
              inventory_id: item._id.toString(),
              size: variant.size,
              color: variant.color,
              sku: variant.sku,
              quantity_in_stock: variant.quantityInStock || 0,
              reorder_level: variant.reorderLevel || 5,
              sold_quantity: variant.soldQuantity || 0,
              images: variant.images || [],
              barcode: variant.barcode,
              is_active: variant.isActive !== false,
              created_at: variant.createdAt || item.createdAt || new Date(),
              updated_at: variant.updatedAt || item.updatedAt || new Date()
            }));

            const { error: variantsError } = await supabase
              .from('inventory_variants')
              .upsert(transformedVariants, { onConflict: 'id' });

            if (variantsError) {
              this.log(`Error migrating variants for item ${item._id}: ${variantsError.message}`, 'error');
            } else {
              variantsMigrated += transformedVariants.length;
            }
          }

        } catch (error) {
          this.log(`Error processing inventory item ${item._id}: ${error.message}`, 'error');
          errors++;
        }
      }

      skip += this.batchSize;
      this.log(`Processed ${inventoryItems.length} inventory items (Total: ${migrated}, Variants: ${variantsMigrated})`);
    }

    this.log(`Inventory migration complete. Items: ${migrated}, Variants: ${variantsMigrated}, Errors: ${errors}`);
  }

  async migrateOrders() {
    this.log('Starting Orders migration...');
    let skip = 0;
    let migrated = 0;
    let itemsMigrated = 0;
    let errors = 0;

    while (true) {
      const orders = await Order.find().skip(skip).limit(this.batchSize).lean();
      if (orders.length === 0) break;

      for (const order of orders) {
        try {
          // Transform main order
          const transformedOrder = {
            id: order._id.toString(),
            order_number: order.orderNumber,
            customer_id: order.customer?.toString(),
            customer_snapshot: order.customerSnapshot || {},
            subtotal: order.subtotal,
            tax: order.tax || 0,
            shipping_fee: order.shippingFee || 0,
            discount: order.discount || 0,
            coupon_discount: order.couponDiscount || 0,
            total_amount: order.totalAmount,
            status: order.status || 'pending',
            shipping_address: order.shippingAddress,
            billing_address: order.billingAddress,
            payment_info: order.paymentInfo,
            delivery_info: order.deliveryInfo,
            notes: order.notes,
            created_at: order.createdAt || new Date(),
            updated_at: order.updatedAt || new Date()
          };

          const { error: orderError } = await supabase
            .from('orders')
            .upsert([transformedOrder], { onConflict: 'id' });

          if (orderError) {
            this.log(`Error migrating order ${order._id}: ${orderError.message}`, 'error');
            errors++;
            continue;
          }

          migrated++;

          // Migrate order items
          if (order.items && order.items.length > 0) {
            const transformedItems = order.items.map(item => ({
              id: item._id?.toString() || `${order._id}-${Math.random().toString(36).substr(2, 9)}`,
              order_id: order._id.toString(),
              product_id: item.product?.toString(),
              variant_id: item.variant?.variantId?.toString(),
              product_snapshot: item.productSnapshot,
              variant: item.variant,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
              store_id: item.store?.toString(),
              store_snapshot: item.storeSnapshot,
              seller_id: item.seller?.toString(),
              item_status: item.itemStatus || 'pending',
              item_tracking: item.itemTracking,
              batch_id: item.batchId?.toString(),
              batch_code: item.batchCode,
              created_at: order.createdAt || new Date()
            }));

            const { error: itemsError } = await supabase
              .from('order_items')
              .upsert(transformedItems, { onConflict: 'id' });

            if (itemsError) {
              this.log(`Error migrating items for order ${order._id}: ${itemsError.message}`, 'error');
            } else {
              itemsMigrated += transformedItems.length;
            }
          }

        } catch (error) {
          this.log(`Error processing order ${order._id}: ${error.message}`, 'error');
          errors++;
        }
      }

      skip += this.batchSize;
      this.log(`Processed ${orders.length} orders (Total: ${migrated}, Items: ${itemsMigrated})`);
    }

    this.log(`Orders migration complete. Orders: ${migrated}, Items: ${itemsMigrated}, Errors: ${errors}`);
  }

  async migrateSales() {
    this.log('Starting Sales migration...');
    let skip = 0;
    let migrated = 0;
    let errors = 0;

    while (true) {
      const sales = await Sale.find().skip(skip).limit(this.batchSize).lean();
      if (sales.length === 0) break;

      const transformedSales = sales.map(sale => ({
        id: sale._id.toString(),
        order_id: sale.orderId?.toString(),
        order_item_id: sale.orderItemId?.toString(),
        product_id: sale.productId?.toString(),
        variant_id: sale.variantId?.toString(),
        store_id: sale.storeId?.toString(),
        seller_id: sale.sellerId?.toString(),
        customer_id: sale.customerId?.toString(),
        quantity_sold: sale.quantitySold,
        unit_price: sale.unitPrice,
        total_amount: sale.totalAmount,
        sale_date: sale.saleDate || sale.createdAt,
        payment_method: sale.paymentMethod,
        created_at: sale.createdAt || new Date()
      }));

      const { error } = await supabase
        .from('sales')
        .upsert(transformedSales, { onConflict: 'id' });

      if (error) {
        this.log(`Error migrating sales batch: ${error.message}`, 'error');
        errors += sales.length;
      } else {
        migrated += sales.length;
        this.log(`Migrated ${sales.length} sales (Total: ${migrated})`);
      }

      skip += this.batchSize;
    }

    this.log(`Sales migration complete. Migrated: ${migrated}, Errors: ${errors}`);
  }

  async migrateAll() {
    try {
      await this.connectMongoDB();
      
      this.log('=== Starting Full Migration ===');
      
      // Migrate in dependency order
      await this.migrateUsers();
      await this.migrateStores(); 
      await this.migrateCustomers();
      await this.migrateInventory();
      await this.migrateOrders(); // This includes order items
      await this.migrateSales();
      
      this.log('=== Migration Complete ===');
      
      // Save migration log
      const fs = require('fs');
      fs.writeFileSync(
        `migration-log-${new Date().toISOString().split('T')[0]}.txt`, 
        this.migrationLog.join('\n')
      );
      
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    } finally {
      mongoose.disconnect();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migrator = new DataMigrator();
  migrator.migrateAll().catch(console.error);
}

export default DataMigrator;