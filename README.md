	# Canteen Portal

	Monorepo with Express/MongoDB backend and React frontend.

	## Scripts
	- `npm run dev`: Run server (nodemon) and client concurrently
	- `npm run start:server`: Start backend
	- `npm run start:client`: Start frontend

	## Env
	Create `server/.env` with:
	```
	PORT=5000
	MONGO_URI=mongodb://127.0.0.1:27017/canteen_portal
	JWT_SECRET=change_me
# FRONTEND_URL should point to your deployed frontend (used by CORS)
# e.g. FRONTEND_URL=https://campus-ease-frontend-i3bz.onrender.com
```

Deployment note (Render):
- On your **backend service**, add `FRONTEND_URL=https://<your-frontend>.onrender.com` in Environment.
- On your **frontend service**, add `VITE_API_URL=https://<your-backend>.onrender.com/api` and **re-deploy the frontend** (Vite reads env vars at build time).
