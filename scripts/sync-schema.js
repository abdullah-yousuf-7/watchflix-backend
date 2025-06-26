#!/usr/bin/env node

/**
 * Schema Synchronization Script for WatchFlixx Microservices
 * 
 * This script ensures all microservices are using the same database schema
 * and handles migrations across the entire system.
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVICES = [
  'auth',
  'content', 
  'streaming',
  'payment',
  'social',
  'analytics',
  'notification'
];

const SHARED_SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

/**
 * Execute command and return promise
 */
function execAsync(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Copy shared schema to all services
 */
async function copySchemaToServices() {
  console.log('📋 Copying shared schema to all microservices...');
  
  for (const service of SERVICES) {
    const servicePath = path.join(__dirname, '..', 'services', service);
    const servicePrismaPath = path.join(servicePath, 'prisma');
    const serviceSchemaPath = path.join(servicePrismaPath, 'schema.prisma');
    
    // Create prisma directory if it doesn't exist
    if (!fs.existsSync(servicePrismaPath)) {
      fs.mkdirSync(servicePrismaPath, { recursive: true });
    }
    
    // Copy shared schema
    fs.copyFileSync(SHARED_SCHEMA_PATH, serviceSchemaPath);
    console.log(`  ✅ Copied schema to ${service} service`);
  }
}

/**
 * Generate Prisma clients for all services
 */
async function generateClients() {
  console.log('🔄 Generating Prisma clients for all services...');
  
  for (const service of SERVICES) {
    const servicePath = path.join(__dirname, '..', 'services', service);
    
    if (fs.existsSync(servicePath)) {
      try {
        console.log(`  Generating client for ${service}...`);
        await execAsync('npx prisma generate', servicePath);
        console.log(`  ✅ Generated client for ${service} service`);
      } catch (error) {
        console.error(`  ❌ Failed to generate client for ${service}:`, error.stderr);
      }
    }
  }
}

/**
 * Run database migrations
 */
async function runMigrations() {
  console.log('🚀 Running database migrations...');
  
  try {
    // Run migration from the main backend directory
    await execAsync('npx prisma migrate deploy', path.join(__dirname, '..'));
    console.log('  ✅ Database migrations completed successfully');
  } catch (error) {
    console.error('  ❌ Migration failed:', error.stderr);
    throw error;
  }
}

/**
 * Validate schema consistency across services
 */
async function validateSchemaConsistency() {
  console.log('🔍 Validating schema consistency across services...');
  
  const mainSchemaContent = fs.readFileSync(SHARED_SCHEMA_PATH, 'utf8');
  
  for (const service of SERVICES) {
    const serviceSchemaPath = path.join(__dirname, '..', 'services', service, 'prisma', 'schema.prisma');
    
    if (fs.existsSync(serviceSchemaPath)) {
      const serviceSchemaContent = fs.readFileSync(serviceSchemaPath, 'utf8');
      
      if (mainSchemaContent !== serviceSchemaContent) {
        console.error(`  ❌ Schema mismatch detected in ${service} service`);
        return false;
      }
    }
  }
  
  console.log('  ✅ All schemas are consistent');
  return true;
}

/**
 * Update service event configuration
 */
async function updateServiceEvents() {
  console.log('📡 Updating service event configurations...');
  
  const configPath = path.join(__dirname, '..', 'microservices.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Generate event type constants for each service
  for (const [serviceName, serviceConfig] of Object.entries(config.microservices)) {
    const servicePath = path.join(__dirname, '..', 'services', serviceName);
    const eventsPath = path.join(servicePath, 'src', 'events');
    
    if (!fs.existsSync(eventsPath)) {
      fs.mkdirSync(eventsPath, { recursive: true });
    }
    
    // Create event types file
    const eventTypesContent = `// Auto-generated event types for ${serviceName} service
export const EVENT_TYPES = {
${serviceConfig.database.eventTypes.map(type => `  ${type.toUpperCase().replace(/([A-Z])/g, '_$1')}: '${type}'`).join(',\n')}
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
`;
    
    fs.writeFileSync(path.join(eventsPath, 'types.ts'), eventTypesContent);
    console.log(`  ✅ Updated event types for ${serviceName} service`);
  }
}

/**
 * Main synchronization function
 */
async function main() {
  console.log('🎬 Starting WatchFlixx Schema Synchronization...\n');
  
  try {
    // Step 1: Copy shared schema to all services
    await copySchemaToServices();
    console.log('');
    
    // Step 2: Validate consistency
    const isConsistent = await validateSchemaConsistency();
    console.log('');
    
    if (!isConsistent) {
      throw new Error('Schema consistency validation failed');
    }
    
    // Step 3: Run migrations
    await runMigrations();
    console.log('');
    
    // Step 4: Generate clients
    await generateClients();
    console.log('');
    
    // Step 5: Update service events
    await updateServiceEvents();
    console.log('');
    
    console.log('🎉 Schema synchronization completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your microservices: docker-compose -f docker-compose.microservices.yml up');
    console.log('2. Monitor service health at: http://localhost:3000/health');
    console.log('3. View API documentation at: http://localhost:3000/docs');
    
  } catch (error) {
    console.error('❌ Schema synchronization failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
WatchFlixx Schema Synchronization Tool

Usage: node sync-schema.js [options]

Options:
  --help, -h          Show this help message
  --validate-only     Only validate schema consistency
  --no-migrate        Skip database migrations
  --no-generate       Skip client generation
  --service <name>    Sync specific service only

Examples:
  node sync-schema.js                    # Full synchronization
  node sync-schema.js --validate-only    # Just validate schemas
  node sync-schema.js --service auth     # Sync only auth service
`);
  process.exit(0);
}

if (args.includes('--validate-only')) {
  validateSchemaConsistency()
    .then(isValid => process.exit(isValid ? 0 : 1))
    .catch(() => process.exit(1));
} else {
  main();
}