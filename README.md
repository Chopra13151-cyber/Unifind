# 🔍 UniFind — AI-Powered Campus Lost & Found Platform

> A full-stack web application that helps university students and staff report, find, and reclaim lost belongings — powered by AI matching using the Anthropic Claude API.

---

## 📖 About the Project

UniFind is a **DBMS semester project** built to solve the real problem of lost and found management on university campuses. Instead of physical notice boards or manual searching, UniFind uses:

- A **relational MySQL database** (normalized to 3NF)
- A **Node.js + Express backend** with REST APIs
- An **AI matching engine** powered by Anthropic Claude that automatically pairs lost and found items
- A clean **dark-themed frontend** with no frameworks — pure HTML, CSS, JavaScript

When a student reports a lost item, the system instantly scans all found reports and calculates a match score using keyword similarity, category matching, location matching, and Claude AI scoring — then notifies both users if a strong match is found.

---

## ✨ Features

- 🔐 **Authentication** — Signup/Login with JWT tokens and bcrypt password hashing
- 😟 **Report Lost Items** — Submit lost item reports with image upload
- ✅ **Report Found Items** — Submit found item reports with photo evidence
- 🤖 **AI Smart Matching** — Automatically matches lost and found items using Claude AI
- 📊 **Dashboard** — Personal overview with active, matched, and resolved item counts
- 🔔 **Notifications** — Real-time alerts when AI finds a match for your item
- 📹 **CCTV Requests** — Submit requests to review campus security footage
- 👮 **Admin Panel** — Manage all users, items, matches, and CCTV requests
- 💬 **Community Comments** — Anyone can comment on items with contact details
- 📈 **Analytics** — Category-wise stats, active reporters, location hotspots

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js v5 |
| Database | MySQL 8.0 |
| AI Engine | Anthropic Claude API (Haiku model) |
| Authentication | JWT (jsonwebtoken) + bcryptjs |
| File Upload | Multer |
| Fonts | Google Fonts — Outfit, Space Grotesk |

---

## 📁 Project Structure

```
unifind/
│
├── 📄 server.js              # Express server entry point
├── 📄 db.js                  # MySQL connection pool
├── 📄 App.js                 # Shared frontend utilities
│
├── 📄 authRoutes.js          # /api/auth — signup, login
├── 📄 itemRoutes.js          # /api/items — report, fetch, comment
├── 📄 aiRoutes.js            # /api/ai — matches, confirm, dismiss
├── 📄 Cctvroutes.js          # /api/cctv — requests, admin update
│
├── 📄 aiMatchEngine.js       # Core AI matching logic
│
├── 📄 index.html             # Browse page — all items + AI matches
├── 📄 Auth.html              # Login / Signup
├── 📄 Dashboard.html         # User dashboard
├── 📄 Items.html             # My items
├── 📄 Report_lost.html       # Report a lost item
├── 📄 Report_found.html      # Report a found item
├── 📄 ai_Matches.html        # AI matches viewer
├── 📄 Notifications.html     # CCTV requests & alerts
├── 📄 Admin.html             # Admin control panel
│
├── 📄 Style.css              # Global styles
├── 📄 package.json
└── 📄 .env                   # Environment variables (not committed)
```

---

## 🗄 Database Design

The database is normalized to **Third Normal Form (3NF)**. Categories were extracted from the items table into a separate lookup table to eliminate repeating string values and transitive dependencies.

### Tables

| Table | Purpose |
|---|---|
| `users` | Stores student/staff/admin accounts |
| `items` | All lost and found reports |
| `categories` | Normalized category lookup (Electronics, Keys, etc.) |
| `comments` | Community comments on items |
| `ai_matches` | AI-generated match pairs with confidence scores |
| `notifications` | Per-user system alerts |
| `cctv_requests` | CCTV footage review requests |
| `item_status_log` | Audit trail of all status changes |

### Key Database Concepts Used

- **Normalization** — 3NF with categories extracted to separate table
- **Joins** — INNER JOIN, LEFT JOIN across items, users, categories
- **Subqueries** — Correlated, scalar, and NOT IN subqueries
- **Stored Procedure** — `resolve_match(lostId, foundId)` with full transaction
- **Transactions** — ACID-compliant status updates with rollback support
- **Views** — `vw_active_items` for clean querying of open reports
- **Indexes** — Composite indexes on `(type, status)`, `(user_id, is_read)`
- **Group By + Having** — Analytics queries for admin dashboard

---

## 🤖 AI Matching Engine

Every time a new item is reported, `aiMatchEngine.js` automatically runs and compares it against all existing opposite-type items using a **4-factor scoring system**:

| Factor | Max Score | Method |
|---|---|---|
| Text Similarity | 50 | Jaccard similarity on title + description tokens |
| Category Match | 20 | Exact match on category string |
| Location Match | 10 | Shared location keywords |
| Claude AI Score | 20 | Claude Haiku rates likelihood 0–20 |
| **Total** | **100** | Match saved if score ≥ 50 |

**Claude AI Prompt:**
```
You are a lost-and-found matcher.
LOST:  Title: ... | Desc: ... | Category: ... | Location: ...
FOUND: Title: ... | Desc: ... | Category: ... | Location: ...
Rate 0-20: how likely are these the SAME physical object?
Reply with ONE integer only.
```

If a match is found, both item owners receive an automatic notification and items are marked as `matched`. An admin can then confirm or dismiss the match, which moves items to `resolved`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MySQL 8.0+
- npm

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/your-username/unifind.git
cd unifind
```

**2. Install dependencies**
```bash
npm install
```

**3. Set up the database**

Open MySQL Workbench and run the full SQL script provided in `database.sql` — this creates all tables, indexes, views, stored procedures, and inserts mock data.

**4. Create your `.env` file**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=unifind_db
PORT=3000
JWT_SECRET=your_secret_key
ANTHROPIC_API_KEY=your_claude_api_key
```

**5. Start the server**
```bash
node server.js
```

**6. Open the app**

Go to `http://localhost:3000/index.html` in your browser.

> ⚠️ Always open via `http://localhost:3000` — opening HTML files directly as `file:///` will block all API calls.

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host (usually localhost) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name — `unifind_db` |
| `PORT` | Server port — default 3000 |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `ANTHROPIC_API_KEY` | Claude API key — optional, AI scoring disabled if missing |

> If `ANTHROPIC_API_KEY` is not provided, the system still works using text, category, and location scoring only.

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login and get JWT token |

### Items
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/items/report` | Report a lost or found item |
| GET | `/api/items/all` | Get all items with filters |
| GET | `/api/items/user/:id` | Get items by user |
| POST | `/api/items/comment` | Post a comment on an item |
| GET | `/api/items/comments/:itemId` | Get comments for an item |

### AI Matches
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ai/matches` | Get all AI matches |
| GET | `/api/ai/matches/user/:userId` | Get matches for a user |
| POST | `/api/ai/run-match/:itemId` | Manually trigger matching |
| PATCH | `/api/ai/matches/:matchId/confirm` | Confirm a match → resolved |
| PATCH | `/api/ai/matches/:matchId/dismiss` | Dismiss a false match |

### CCTV
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/cctv/request` | Submit CCTV request |
| GET | `/api/cctv/all-requests` | Admin — get all requests |
| PATCH | `/api/cctv/update/:id` | Admin — approve or reject |
| GET | `/api/cctv/my-requests/:userId` | User — get own requests |

---

## 👥 User Roles

| Role | Access |
|---|---|
| `student` | Report items, view matches, request CCTV |
| `staff` | Same as student |
| `clerk` | Manage found items at lost & found desk |
| `admin` | Full access — confirm matches, manage users, approve CCTV |

---

## 📚 Academic Context

This project was built as a **Database Management Systems (DBMS) semester project** demonstrating:

- Entity Relationship modeling
- Database normalization (1NF → 2NF → 3NF)
- DDL and DML operations
- Complex JOIN queries
- Subqueries (correlated, scalar, NOT IN)
- Stored procedures with transactions
- ACID properties
- Views and indexing
- Aggregate functions and GROUP BY / HAVING
- Integration of a live AI API with a relational database backend

---

## 📝 License

This project is built for academic purposes.

---

> Built with ❤️ using Node.js, MySQL, and Claude AI
