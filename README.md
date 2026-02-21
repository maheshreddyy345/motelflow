# 🏨 Motel Flow — Property Management System

A full-featured, real-time motel property management system built with **React**, **Express**, **PostgreSQL**, and **Stripe**.

![Dashboard](https://img.shields.io/badge/status-production_ready-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

| Module | Description |
|---|---|
| 📊 **Dashboard** | Real-time KPIs, occupancy %, arrivals/departures, room status |
| 📋 **Reservations** | Full CRUD, check-in/out, cancellation with reasons, search & filters |
| 🏨 **Rooms** | Visual room grid by floor, status management, out-of-order tracking |
| 🛏️ **Housekeeping** | Bulk status updates, floor-level filtering, dirty/clean/inspected |
| 📈 **Tape Chart** | Visual timeline of all reservations across rooms |
| 💰 **Folio** | Guest billing: room charges, payments, adjustments, balance tracking |
| 💳 **Stripe Payments** | Real credit card processing (test mode) via Stripe Elements |
| 📊 **Reports** | Revenue, occupancy, rate analysis, payment reports with charts |
| 🌙 **Night Audit** | Daily close-out: auto-post charges, mark no-shows, reset housekeeping |

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite + React Router
- **Backend:** Express 5 + Node.js
- **Database:** PostgreSQL
- **Payments:** Stripe (test mode)
- **Charts:** Chart.js + react-chartjs-2
- **Auth:** JWT + bcrypt with role-based access (owner/manager/frontdesk/housekeeping)

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/maheshreddyy345/motelflow.git
cd motelflow

# 2. Install all dependencies
npm run install:all

# 3. Set up the database
# Create a database called 'motelflow' in PostgreSQL
# Then run the schema:
psql -U postgres -d motelflow -f server/db/schema.sql
psql -U postgres -d motelflow -f server/db/folio_tables.sql
psql -U postgres -d motelflow -f server/db/night_audit_migration.sql

# 4. Configure environment variables
cp server/.env.example server/.env
# Edit .env with your database credentials and Stripe keys

# 5. Seed sample data
cd server && node scripts/seed_reservations.js && cd ..

# 6. Start development servers (two terminals)
npm run dev:server    # Terminal 1 → http://localhost:5000
npm run dev:client    # Terminal 2 → http://localhost:5173
```

### Default Login
- **Username:** `owner`
- **Password:** `motelflow123`

## 🌐 Environment Variables

Create `server/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=motelflow
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

## 📦 Production Deployment

```bash
# Build the frontend
npm run build:client

# Set NODE_ENV and start
NODE_ENV=production npm start
```

The server will serve the React frontend and API from a single port.

## 📁 Project Structure

```
motel-flow/
├── client/               # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # Auth context
│   │   ├── pages/        # Page components
│   │   └── utils/        # API utilities
│   └── package.json
├── server/               # Express backend
│   ├── config/           # Database config
│   ├── db/               # SQL schemas & migrations
│   ├── middleware/        # Auth middleware
│   ├── routes/           # API route handlers
│   ├── scripts/          # Seed scripts
│   └── package.json
└── package.json          # Root scripts
```

## 🧪 Test Card (Stripe)

| Field | Value |
|---|---|
| Card Number | `4242 4242 4242 4242` |
| Expiry | `12/34` |
| CVC | `123` |

## 📄 License

MIT
