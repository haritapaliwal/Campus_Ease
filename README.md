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
	```


