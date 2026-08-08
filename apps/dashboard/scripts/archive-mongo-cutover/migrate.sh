#!/bin/bash

# IVMA App MongoDB to Supabase Migration Script
# Usage: ./migrate.sh [phase]
# Phases: setup, test, migrate, validate, switch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env.local" ]; then
    error ".env.local file not found. Please copy .env.example and configure it."
    exit 1
fi

PHASE=${1:-"help"}

case $PHASE in
    "setup")
        log "Setting up Supabase schema..."
        
        # Install Supabase dependencies
        log "Installing Supabase dependencies..."
        npm install @supabase/supabase-js
        
        success "Setup complete. Please:"
        echo "1. Create a Supabase project at https://supabase.com"
        echo "2. Run the SQL from migration/supabase-schema.sql in your Supabase SQL editor"
        echo "3. Update .env.local with your Supabase credentials"
        echo "4. Run './migrate.sh test' to test connections"
        ;;
        
    "test")
        log "Testing connections..."
        
        # Test MongoDB connection
        log "Testing MongoDB connection..."
        node -e "
            require('dotenv').config({ path: '.env.local' });
            const connectToDatabase = require('./src/lib/mongodb.js').default;
            connectToDatabase()
                .then(() => { console.log('✓ MongoDB connection successful'); process.exit(0); })
                .catch(err => { console.error('✗ MongoDB connection failed:', err.message); process.exit(1); });
        "
        
        # Test Supabase connection
        log "Testing Supabase connection..."
        node -e "
            require('dotenv').config({ path: '.env.local' });
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
            supabase.from('users').select('id').limit(1)
                .then(result => { 
                    if (result.error && result.error.code !== 'PGRST116') {
                        throw result.error;
                    }
                    console.log('✓ Supabase connection successful'); 
                    process.exit(0); 
                })
                .catch(err => { console.error('✗ Supabase connection failed:', err.message); process.exit(1); });
        "
        
        success "Connection tests passed!"
        ;;
        
    "migrate")
        log "Starting data migration..."
        
        # Create backup first
        log "Creating MongoDB backup..."
        BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
        mkdir -p backups
        
        # Note: Adjust this command based on your MongoDB setup
        warn "Please create a MongoDB backup manually before proceeding!"
        read -p "Have you created a MongoDB backup? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Migration cancelled. Please create a backup first."
            exit 1
        fi
        
        # Run migration
        log "Running data migration..."
        export NODE_OPTIONS="--max-old-space-size=4096"
        node migration/data-migrator.js
        
        success "Data migration completed!"
        ;;
        
    "dual-write")
        log "Enabling dual write mode..."
        
        # Update environment to enable dual write
        if grep -q "DUAL_WRITE_ENABLED=true" .env.local; then
            warn "Dual write already enabled"
        else
            sed -i '' 's/DUAL_WRITE_ENABLED=false/DUAL_WRITE_ENABLED=true/' .env.local
            success "Dual write enabled"
        fi
        
        log "In dual write mode, all new data will be written to both MongoDB and Supabase"
        log "Monitor the application logs for any dual write errors"
        ;;
        
    "validate")
        log "Validating migration..."
        
        # Run validation script
        node -e "
            require('dotenv').config({ path: '.env.local' });
            const { createClient } = require('@supabase/supabase-js');
            const connectToDatabase = require('./src/lib/mongodb.js').default;
            const mongoose = require('mongoose');
            
            async function validate() {
                try {
                    // Connect to both databases
                    await connectToDatabase();
                    const supabase = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL, 
                        process.env.SUPABASE_SERVICE_ROLE_KEY
                    );
                    
                    // Count records in both databases
                    const collections = ['users', 'stores', 'customers', 'orders', 'inventory'];
                    
                    for (const collection of collections) {
                        const mongoCount = await mongoose.connection.db.collection(collection).countDocuments();
                        const { count: supabaseCount, error } = await supabase
                            .from(collection)
                            .select('*', { count: 'exact', head: true });
                            
                        if (error) {
                            console.log(\`✗ Error counting \${collection}: \${error.message}\`);
                        } else {
                            const match = mongoCount === supabaseCount;
                            const status = match ? '✓' : '✗';
                            console.log(\`\${status} \${collection}: MongoDB=\${mongoCount}, Supabase=\${supabaseCount}\`);
                        }
                    }
                    
                    mongoose.disconnect();
                    console.log('Validation complete!');
                } catch (error) {
                    console.error('Validation failed:', error.message);
                    process.exit(1);
                }
            }
            
            validate();
        "
        ;;
        
    "switch")
        log "Switching to Supabase..."
        
        warn "This will switch your application to use Supabase instead of MongoDB"
        read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Switch cancelled"
            exit 1
        fi
        
        # Update environment
        sed -i '' 's/USE_SUPABASE=false/USE_SUPABASE=true/' .env.local
        sed -i '' 's/DUAL_WRITE_ENABLED=true/DUAL_WRITE_ENABLED=false/' .env.local
        
        success "Application switched to Supabase!"
        log "Remember to:"
        echo "1. Update your deployment environment variables"
        echo "2. Monitor the application for any issues"
        echo "3. Keep MongoDB backup for rollback if needed"
        ;;
        
    "rollback")
        log "Rolling back to MongoDB..."
        
        sed -i '' 's/USE_SUPABASE=true/USE_SUPABASE=false/' .env.local
        sed -i '' 's/DUAL_WRITE_ENABLED=true/DUAL_WRITE_ENABLED=false/' .env.local
        
        success "Rolled back to MongoDB"
        ;;
        
    "help"|*)
        echo "IVMA App Migration Script"
        echo "Usage: ./migrate.sh [phase]"
        echo ""
        echo "Phases:"
        echo "  setup      - Install dependencies and setup Supabase"
        echo "  test       - Test connections to both databases"
        echo "  migrate    - Run the data migration"
        echo "  dual-write - Enable dual write mode"
        echo "  validate   - Validate migration by comparing record counts"
        echo "  switch     - Switch application to use Supabase"
        echo "  rollback   - Roll back to MongoDB"
        echo "  help       - Show this help"
        ;;
esac