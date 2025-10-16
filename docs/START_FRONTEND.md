# How to Start the Frontend

## The Issue
The verification link points to `http://localhost:5173` but the frontend development server is not running.

## Solution: Start the Frontend

### Option 1: Start Frontend Manually

```bash
cd /Users/matthew/projects/A-STSC/opentak-onboarding-portal/frontend
npm install  # Only needed first time or after package changes
npm run dev
```

The frontend will start on `http://localhost:5173`

### Option 2: Start with Docker Compose

If you have a docker-compose setup for the frontend:

```bash
docker compose up frontend
```

### Option 3: Run in Background

```bash
cd frontend
npm run dev &
```

## Verify It's Running

Check if port 5173 is open:
```bash
lsof -i:5173
```

Or visit: http://localhost:5173

## Test Verification Again

Once the frontend is running:

1. Go to your email
2. Click the verification link: `http://localhost:5173/verify-email?token=...`
3. Should see the verification page
4. Should verify successfully
5. Should redirect to login

## ✅ Backend Already Works!

I tested the backend API and it works perfectly:
- The user `test1610` was created successfully
- Email was verified
- User can now login

The only issue was the frontend wasn't running, so clicking the link didn't open the verification page.

## For Production

In production, you would:
1. Build the frontend: `npm run build`
2. Serve it with nginx or apache
3. Set `FRONTEND_URL` in `.env` to your actual domain

## Quick Test Without Frontend

If you want to test without starting the frontend, you can verify via API:

```bash
curl -X POST http://localhost:5000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN_HERE"}'
```

Replace `YOUR_TOKEN_HERE` with the token from your email.
