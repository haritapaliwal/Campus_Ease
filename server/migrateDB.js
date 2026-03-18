import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Import Schema dynamically without referencing existing models which might apply validation too early
const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("UserMigration", userSchema, "users");

const shopSchema = new mongoose.Schema({}, { strict: false });
const Shop = mongoose.model("ShopMigration", shopSchema, "shops");

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model("OrderMigration", orderSchema, "orders");

const barberBookingSchema = new mongoose.Schema({}, { strict: false });
const BarberBooking = mongoose.model("BarberBookingMigration", barberBookingSchema, "barberbookings");

dotenv.config();

async function migrate() {
  try {
    await connectDB();
    console.log("Connected to DB, starting migration...");

    // 1. Migrate Users
    const users = await User.find({});
    let usersUpdated = 0;
    for (let user of users) {
      let needsSave = false;
      if (user.role === "student") {
        user.role = "customer";
        needsSave = true;
      } else if (user.role === "owner") {
        user.role = "shop_owner";
        needsSave = true;
      }
      
      if (needsSave) {
        await user.save();
        usersUpdated++;
      }
    }
    console.log(`Migrated ${usersUpdated} users to new roles.\n`);

    // 2. Migrate Shops
    const shops = await Shop.find({});
    let shopsUpdated = 0;
    
    // Create a map to link shopName to shopId for Order migration later
    const shopNamesMap = {};
    
    for (let shop of shops) {
      shopNamesMap[shop.name] = shop._id;
      
      let needsSave = false;
      if (shop.get("type")) {
        shop.set("category", shop.get("type"));
        shop.set("type", undefined); // Remove old field
        needsSave = true;
      }
      if (!shop.get("status")) {
         shop.set("status", "active");
         needsSave = true;
      }

      if (needsSave) {
        await shop.save();
        shopsUpdated++;
      }
    }
    console.log(`Migrated ${shopsUpdated} shops (type -> category, added status).\n`);

    // 3. Migrate Orders (add shopId based on items array)
    const orders = await Order.find({});
    let ordersUpdated = 0;
    for (let order of orders) {
       if (!order.get("shopId") && order.get("items") && order.get("items").length > 0) {
           const shopName = order.get("items")[0].shop; // Assume all items in an order are from the same shop
           if (shopName && shopNamesMap[shopName]) {
               order.set("shopId", shopNamesMap[shopName]);
               await order.save();
               ordersUpdated++;
           }
       }
    }
    console.log(`Migrated ${ordersUpdated} orders to include shopId.\n`);
    
    // 4. Migrate BarberBookings (add shopId)
    // For BarberBookings, there is usually only one Barber shop
    const barberShop = await Shop.findOne({ category: "barber" }) || await Shop.findOne({ type: "barber" });
    if (barberShop) {
      const barberBookings = await BarberBooking.find({ shopId: { $exists: false } });
      let bUpdated = 0;
      for (let b of barberBookings) {
         b.set("shopId", barberShop._id);
         await b.save();
         bUpdated++;
      }
      console.log(`Migrated ${bUpdated} barber bookings to include shopId.\n`);
    }

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
