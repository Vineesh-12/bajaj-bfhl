# SRM Full Stack Engineering Challenge — Round 1

https://bajaj-bfhl-five.vercel.app/

## Setup

```bash
cd backend
npm install
npm start         # production
npm run dev       # dev with hot-reload (nodemon)
```

Server runs on **port 3000** by default.

## Endpoint

```
POST /bfhl
Content-Type: application/json

{ "data": ["A->B", "A->C", "B->D"] }
```

## Frontend

Open `frontend/index.html` directly in any browser.  
Set the **API Endpoint** field to your hosted URL before submitting.

## Before Deploying

Edit the three identity constants at the top of `backend/index.js`:

```js
const USER_ID            = "yourname_ddmmyyyy";
const EMAIL_ID           = "you@college.edu";
const COLLEGE_ROLL_NUMBER = "XXCS0000";
```
