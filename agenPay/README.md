# AgenPay — Agentic Payment Infrastructure for Web3 Teams (Agentic Stripe for Web3) Powered by Sei

AgenPay is the first AI-powered crypto payment system where your agent handles everything from scheduling and sending to receiving, refunding, and reconciling payments. Designed for modern workflows, your agent connects directly with your Notion workspace, leverages **X402Pay** for secure transactions, and integrates with **Sei Network** for seamless multi-token payments. Now merchants can receive payments in their preferred currency while users pay with any supported cryptocurrency.

🎥 **Demo Video**: [Watch here](https://www.loom.com/share/62cbbce7bac1435483e03a3b905aae55?sid=fd05ccd9-6768-4f0c-b86b-589b16148af7)

---

## 🏗️ Technical Architecture

### Core Components

- 🤖 **AI Agent System**: LangGraph-powered autonomous payment processing  
- 🗃️ **Notion Integration**: Direct workspace synchronization for payment operations  
- 💳 **X402Pay Protocol**: Web3 payment links with cryptographic verification  
- 💱 **Sei Network Integration**: Multi-token payments with high-performance execution  
- 🔐 **Privy Wallets**: Secure multi-user crypto wallet management  
- 📊 **Multi-User Dashboard**: Real-time analytics and transaction monitoring  
- ⚡ **Real-Time Processing**: Event-driven payment automation  

### Technology Stack

**Backend (agenpay-backend/)**

- Node.js + Express.js: REST API server with authentication  
- LangGraph.js: AI agent workflow orchestration  
- OpenAI GPT-4: Natural language payment processing  
- PostgreSQL + Prisma: Multi-user data persistence  
- Privy SDK: Secure wallet operations  
- Sei Network: High-speed transaction execution  
- JWT: Stateless authentication  
- Nodemailer and AWS SMS: Email notifications  

**Frontend (agenpay-frontend/)**

- React 18: Modern UI with hooks and context  
- Tailwind CSS: Responsive design system  
- Axios: HTTP client for API communication  
- React Router: Client-side routing  

### Integrations

- Notion API: Workspace setup and real-time sync  
- X402Pay Protocol: Crypto payment link generation  
- Sei Network: Native and multi-token transaction processing 

---

## ⚙️ How It Works

### 🧾 Notion-First Interface

Most teams already run operations in Notion — so why switch tools?

AgenPay lets you turn any Notion database into a powerful payment dashboard:

- Automated Workspace Setup  
- Real-Time Synchronization  
- Smart Data Extraction  
- Bi-Directional Updates  

### 🤖 Agent = Your Payment Ops Team

The AI agent automatically watches your Notion for:

- New payment requests  
- Overdue invoices  
- Subscription renewals  
- Refund schedules  

And reacts instantly:

✅ Schedules recurring payments

✅ Sends personalized X402Pay links

✅ Follows up on unpaid invoices

✅ Reconciles records and marks invoices as "Paid"

✅ Automatically refunds payments after set time periods

### 🔁 Ask & Refund Flow (Like Stripe Intents)

Example: *Ask 0.1 ETH from [john@company.com](mailto:john@company.com), refund after 30 days*

1. Creates secure X402Pay payment link  
2. Sends personalized email to recipient  
3. Updates Notion with payment status  
4. Schedules automatic refund  
5. Executes refund using Privy wallet  

### 💬 Chat-Based Payments

Natural language control:

- User: *"Send 50 USDC to [alice@startup.com](mailto:alice@startup.com) for consulting work"*  
- Agent: ✅ Payment link created and sent. Tracking in Notion.  

---

## 💱 Multi-Token Payments on Sei

AgenPay leverages Sei’s high-performance blockchain for multi-token settlement.

**Example Workflow:**

- Merchant requests payment: *"100 USDC for design work"*  
- AgenPay creates multi-token payment link  
- User pays with 0.04 ETH (their preferred token)  
- Sei Network executes the swap → USDC  
- Merchant receives exactly 100 USDC  
- Transaction logged in Notion with full swap details  

**Merchant Benefits:**

- Receive in preferred currency (USDC, ETH, etc.)  
- Accept any crypto token from users  
- Optimized transaction costs via Sei’s parallel execution  

**User Benefits:**

- Pay with any supported token  
- Best pricing via optimized routes  
- One-click payments  
- Multi-chain compatibility  

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+  
- PostgreSQL database  
- OpenAI API Key  
- Notion integration (optional)  

### Setup Process

1. Clone the repository and install dependencies for both frontend and backend  
2. Configure environment variables (DB, OpenAI API, CDP credentials, Sei RPC)  
3. Initialize database schema  
4. Start the application and access dashboard  
5. Connect integrations like Notion and email notifications  

### Key Integrations

- OpenAI API: Natural language AI agent  
- Coinbase CDP: Secure crypto transactions  
- Sei Network: Multi-token payments with fast execution  
- Notion API: Workspace synchronization  
- SMTP Email: Payment notifications and reminders  

---

## 🔧 Configuration

### Wallet Integration

- **Privy** for secure custody  
- Runs on **Sei** network
- Supports ETH, USDC, and ERC-20 tokens  
- Testnet and mainnet support  

### Email Integration

- SMTP setup for notifications and reminders  
- Personalized payment request templates  
- Automated follow-ups  

### Notion Integration

- Setup via [Notion Integrations](https://notion.so/integrations)  
- Real-time payment tracking  
- Bi-directional updates with team workflows  

---

## 🧠 Key Features

- ✨ **AI-Powered Processing**: Natural language, context awareness, smart scheduling  
- 🔄 **Automated Workflows**: Recurring payments, multi-token support, refunds  
- 🔐 **Enterprise Security**: JWT, isolated wallets, TEE-secured agents  
- 📊 **Analytics**: Real-time tracking, reporting, dashboards  

---

Built with ❤️ for the future of Web3 payments on **Sei Network**