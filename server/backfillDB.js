import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from './models/Shop.js';
import User from './models/User.js';
import Order from './models/Order.js';
import BarberBooking from './models/BarberBooking.js';
import LaundryBooking from './models/LaundryBooking.js';

dotenv.config();

const backfill = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB...");

    // 1. Backfill Order shopId
    const orders = await Order.find({ shopId: { $exists: false } });
    console.log(`Backfilling ${orders.length} orders...`);
    for (let order of orders) {
      if (order.items && order.items.length > 0) {
        const shopName = order.items[0].shop;
        const shop = await Shop.findOne({ name: shopName });
        if (shop) {
          order.shopId = shop._id;
          await order.save();
          console.log(`Linked order ${order._id} to shop ${shop.name}`);
        }
      }
    }

    // 2. Backfill BarberBooking shopId
    const barberShops = await Shop.find({ category: "barber" });
    if (barberShops.length > 0) {
        const defaultBarber = barberShops[0]; 
        const bks = await BarberBooking.find({ shopId: { $exists: false } });
        for (let b of bks) {
            b.shopId = defaultBarber._id;
            await b.save();
        }
        console.log(`Linked ${bks.length} barber bookings to ${defaultBarber.name}`);
    }

    // 3. Ensure "Vinayak", "CCD", "Amul" etc have correct owners
    const coreShops = ["Vinayak", "CCD", "Amul", "Campus Barber", "Campus Laundry", "CiBUS"];
    for (let name of coreShops) {
        const shop = await Shop.findOne({ name });
        if (shop && shop.ownerId) {
            const user = await User.findById(shop.ownerId);
            if (user) {
                user.role = "shop_owner";
                user.shopId = shop._id;
                await user.save();
                console.log(`Verified owner ${user.email} for shop ${name}`);
            }
        }
    }

    console.log("Backfill and verification complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

backfill();
