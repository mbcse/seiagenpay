-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "notionApiKey" TEXT,
    "notionWorkspaceId" TEXT,
    "walletAddress" TEXT,
    "walletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STOPPED',
    "threadId" TEXT,
    "lastActivity" TIMESTAMP(3),
    "totalProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "totalAmountSent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETH',
    "network" TEXT,
    "description" TEXT,
    "toAddress" TEXT,
    "fromAddress" TEXT,
    "txHash" TEXT,
    "x402PayId" TEXT,
    "relatedRequestId" TEXT,
    "paymentId" TEXT,
    "paymentLink" TEXT,
    "recipientEmail" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotionDatabase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseType" TEXT NOT NULL,
    "properties" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotionDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "network" TEXT NOT NULL DEFAULT 'sei-testnet',
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "description" TEXT,
    "aiPrompt" TEXT,
    "transactionType" TEXT NOT NULL DEFAULT 'ask_payment',
    "scheduleType" TEXT NOT NULL DEFAULT 'immediate',
    "scheduledDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "x402PayLink" TEXT,
    "paymentHash" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEI',
    "network" TEXT NOT NULL DEFAULT 'sei-testnet',
    "recipientAddress" TEXT NOT NULL,
    "recipientName" TEXT,
    "fromName" TEXT,
    "description" TEXT,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "txHash" TEXT,
    "executedAt" TIMESTAMP(3),
    "relatedRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutgoingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_userId_key" ON "Agent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotionDatabase_databaseId_key" ON "NotionDatabase"("databaseId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotionDatabase" ADD CONSTRAINT "NotionDatabase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingPayment" ADD CONSTRAINT "OutgoingPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
