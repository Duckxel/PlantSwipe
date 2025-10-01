# 🌱 PlantSwipe  

PlantSwipe is an application that catalogs plants and seeds in a collaborative database.  
It allows users to search, filter, and add new entries based on criteria such as **name**, **family**, or other characteristics.  

---

## 🚀 Features
- 🔍 Search for plants and seeds by different criteria  
- ➕ Add new plants to the database  
- 🌍 Collaborative database enriched by users  

---

## 🛠️ Installation & Setup

### 1. Clone the repository
Clone the project with Git:  
```bash
git clone https://github.com/yourusername/PlantSwipe.git
````

---

### 2. Install dependencies

Make sure you have **Node.js** installed.
👉 [Download Node.js](https://nodejs.org/en/download)

Then run:

```bash
cd plant-swipe
npm install
```

---

### 3. Configure environment variables

Create a `.env` file in `plant-swipe` with ONLY client vars (Vite exposes only `VITE_`):

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Create `.env.server` in `plant-swipe` for server-only secrets:

```env
# Option 1: single URL
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Option 2: discrete vars
# PGHOST=host
# PGUSER=user
# PGPASSWORD=pass
# PGPORT=5432
# PGDATABASE=postgres

# If using Supabase managed Postgres:
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_DB_PASSWORD=database_password

# Express listen port (optional)
# PORT=3000
```

---

### 4. Start the project

Run the app locally (Vite dev, with API proxy):

```bash
npm run dev
```

Vite dev server: `http://127.0.0.1:5173` (configurable via `VITE_DEV_HOST`/`VITE_DEV_PORT`).
API proxy: requests to `/api/*` go to Express on `http://localhost:3000`.

---

## 📂 Tech Stack

* **Frontend**: Vite + React
* **Backend**: Supabase (PostgreSQL)
* **Auth & DB**: Supabase


---

Server update 
```bash
git pull
```
```bash
cd plant-swipe
```
```bash
npm ci
```
```bash
npm run build
```
```bash
sudo rsync -avh --delete ./dist/ /var/www/plant-swipe/
```
```bash
sudo systemctl reload nginx
```



---
✨ Happy digital gardening with *PlantSwipe*!
