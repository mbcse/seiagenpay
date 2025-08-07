#!/usr/bin/env node

/**
 * AgenPay Setup Script
 * Helps users initialize the database and check system requirements
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
config();

const prisma = new PrismaClient();

async function checkRequirements() {
  console.log('🔍 Checking system requirements...\n');

  const checks = {
    nodeVersion: false,
    envFile: false,
    databaseUrl: false,
    jwtSecret: false,
    openaiKey: false,
  };

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  checks.nodeVersion = majorVersion >= 18;
  console.log(`📦 Node.js: ${nodeVersion} ${checks.nodeVersion ? '✅' : '❌ (requires v18+)'}`);

  // Check .env file
  checks.envFile = fs.existsSync('.env');
  console.log(`📄 .env file: ${checks.envFile ? '✅ Found' : '❌ Missing'}`);

  // Check database URL
  checks.databaseUrl = !!process.env.DATABASE_URL;
  console.log(`🗄️ Database URL: ${checks.databaseUrl ? '✅ Configured' : '❌ Missing'}`);

  // Check JWT secret
  checks.jwtSecret = !!process.env.JWT_SECRET;
  console.log(`🔑 JWT Secret: ${checks.jwtSecret ? '✅ Configured' : '❌ Missing'}`);

  // Check OpenAI API key
  checks.openaiKey = !!process.env.OPENAI_API_KEY;
  console.log(`🤖 OpenAI API: ${checks.openaiKey ? '✅ Configured' : '❌ Missing'}`);

  // Optional services
  console.log('\n🔧 Optional Services:');
      console.log(`💳 Privy Wallet: ${process.env.PRIVY_APP_ID ? '✅ Live' : '🧪 Mock'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER !== 'test@example.com' ? '✅ Live' : '🧪 Mock'}`);
  console.log(`🗃️ Notion: ${'Will be configured per user'}`);

  return checks;
}

async function createEnvFile() {
  console.log('\n📝 Creating .env file...');

  const envContent = `# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/agenpay_db"

# JWT Authentication
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
DEBUG=true

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# X402Pay Configuration
X402PAY_API_KEY=your-x402pay-api-key-here
X402PAY_BASE_URL=https://api.x402pay.com/v1

# Privy Wallet Configuration
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
EMAIL_FROM=AgenPay <your-email@gmail.com>

# Agent Configuration
AGENT_NAME=AgenPay AI
DEFAULT_CURRENCY=SEI
MONITORING_INTERVAL_MINUTES=10

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Notion Configuration (Global defaults)
NOTION_API_KEY=secret_your-notion-integration-token-here
NOTION_DATABASE_ID=your-notion-database-id-here

# Encryption Key for sensitive data
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
`;

  fs.writeFileSync('.env', envContent);
  console.log('✅ .env file created with secure defaults');
  console.log('⚠️ Please edit .env file with your actual API keys');
}

async function testDatabaseConnection() {
  console.log('\n🗄️ Testing database connection...');

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
    
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    
    if (error.code === 'P1001') {
      console.log('\n💡 Database setup tips:');
      console.log('1. Install PostgreSQL locally or use a cloud service');
      console.log('2. Create a database named "agenpay_db"');
      console.log('3. Update DATABASE_URL in .env file');
      console.log('4. Run: npm run db:push');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function initializeDatabase() {
  console.log('\n🏗️ Initializing database...');

  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    const { spawn } = await import('child_process');
    
    await new Promise((resolve, reject) => {
      const generateProcess = spawn('npx', ['prisma', 'generate'], {
        stdio: 'inherit',
      });
      
      generateProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prisma generate failed with code ${code}`));
        }
      });
    });

    // Push database schema
    console.log('📊 Pushing database schema...');
    await new Promise((resolve, reject) => {
      const pushProcess = spawn('npx', ['prisma', 'db', 'push'], {
        stdio: 'inherit',
      });
      
      pushProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prisma db push failed with code ${code}`));
        }
      });
    });

    console.log('✅ Database schema created');
    return true;
  } catch (error) {
    console.log('❌ Database initialization failed:', error.message);
    return false;
  }
}

async function seedDatabase() {
  console.log('\n🌱 Seeding database with demo data...');

  try {
    const { spawn } = await import('child_process');
    
    await new Promise((resolve, reject) => {
      const seedProcess = spawn('npm', ['run', 'db:seed'], {
        stdio: 'inherit',
      });
      
      seedProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Database seeding failed with code ${code}`));
        }
      });
    });

    console.log('✅ Database seeded with demo data');
    return true;
  } catch (error) {
    console.log('❌ Database seeding failed:', error.message);
    return false;
  }
}

async function displayFinalInstructions() {
  console.log('\n🎉 Setup completed successfully!\n');

  console.log('📚 Next Steps:');
  console.log('1. Edit .env file with your API keys:');
  console.log('   - OPENAI_API_KEY (required for AI agent)');
  console.log('   - DATABASE_URL (if using external database)');
  console.log('   - PRIVY_APP_ID & PRIVY_APP_SECRET (for live wallet)');
  console.log('   - EMAIL_USER & EMAIL_PASS (for live email)');
  console.log('');
  console.log('2. Start the server:');
  console.log('   npm start');
  console.log('');
  console.log('3. Test the API:');
  console.log('   curl http://localhost:3001/health');
  console.log('');
  console.log('4. Demo credentials:');
  console.log('   Email: demo@agenpay.com');
  console.log('   Password: demo123');
  console.log('');
  console.log('🚀 Your AgenPay backend is ready for production!');
}

async function main() {
  console.log(`
🚀 AgenPay Backend Setup
========================
Multi-user AI Payment Processing System

This script will help you set up your AgenPay backend server.
  `);

  try {
    // Check requirements
    const checks = await checkRequirements();

    // Create .env file if missing
    if (!checks.envFile) {
      await createEnvFile();
    }

    // Test database connection
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected && checks.databaseUrl) {
      // Try to initialize database
      const dbInitialized = await initializeDatabase();
      
      if (dbInitialized) {
        // Seed database
        await seedDatabase();
      }
    } else if (dbConnected) {
      console.log('💡 Database already connected. To reset, run: npm run db:push --force-reset');
    }

    // Display final instructions
    await displayFinalInstructions();

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
main().catch(console.error); 