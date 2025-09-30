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

Create a **.env** file at the root of the project and add:

```env
VITE_SUPABASE_URL=[URL]
VITE_SUPABASE_ANON_KEY=[API]
SUPABASE_DB_PASSWORD=[PASSWORD]
```

---

### 4. Start the project

Run the app locally:

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

The application will be available at:
👉 [http://127.0.0.1:3000](http://127.0.0.1:3000)

---

## 🚢 Production deployment

See `plant-swipe/deploy/README_DEPLOY.md` for nginx config, PM2 process file, and a `deploy.sh` script that builds and syncs to a remote server over SSH. Provide your environment in `.env` (see `.env.example`).

Quick deploy from local machine:
```bash
export REMOTE_HOST=your.server.ip
export REMOTE_USER=root # or deploy user
bash plant-swipe/deploy/deploy.sh
```

Node-backed mode exposes the API at `/api/*` via `server.js` and serves the built SPA.

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
