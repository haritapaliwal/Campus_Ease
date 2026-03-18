import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import BarberBooking from './models/BarberBooking.js';
import LaundryBooking from './models/LaundryBooking.js';

dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const orders = await Order.find();
        console.log("---- Food Orders ----");
        orders.forEach(o => {
            console.log(`ID: ${o._id}, Status: ${o.status}, ShopId: ${o.shopId}, Total: ${o.items.reduce((s, i) => s + i.price, 0)}`);
        });

        const barbers = await BarberBooking.find();
        console.log("\n---- Barber Bookings ----");
        barbers.forEach(b => {
             console.log(`ID: ${b._id}, Status: ${b.status}, ShopId: ${b.shopId}`);
        });

        const laundry = await LaundryBooking.find();
        console.log("\n---- Laundry Bookings ----");
        laundry.forEach(l => {
             console.log(`ID: ${l._id}, Status: ${l.status}, ShopId: ${l.shopId}, Total: ${l.totalAmount}`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
