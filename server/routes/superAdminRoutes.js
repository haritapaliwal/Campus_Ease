import express from "express";
import User from "../models/User.js";
import Shop from "../models/Shop.js";
import Order from "../models/Order.js";
import BarberBooking from "../models/BarberBooking.js";
import LaundryBooking from "../models/LaundryBooking.js";
import bcrypt from "bcryptjs";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware, authorizeRoles("admin"));

// Super Admin Dashboard Stats
router.get("/dashboard", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log("Dashboard aggregation 'since' date:", since.toISOString());

    // Total Active Customers
    const totalUsers = await User.countDocuments({ role: "customer" });

    // Shop Revenue Aggregation (Completed in last 24h)
    const orderRevenue = await Order.aggregate([
      { $match: { status: "completed", updatedAt: { $gte: since } } },
      { $unwind: "$items" },
      { $group: { _id: "$shopId", total: { $sum: "$items.price" } } }
    ]);
    console.log("Order Aggregation Results:", JSON.stringify(orderRevenue));

    const barberRevenue = await BarberBooking.aggregate([
      { $match: { status: "completed", updatedAt: { $gte: since } } },
      { $group: { _id: "$shopId", count: { $sum: 1 } } }
    ]);
    console.log("Barber Aggregation Results:", JSON.stringify(barberRevenue));

    const laundryRevenue = await LaundryBooking.aggregate([
      { $match: { status: "completed", updatedAt: { $gte: since } } },
      { $group: { _id: "$shopId", total: { $sum: "$totalAmount" } } }
    ]);
    console.log("Laundry Aggregation Results:", JSON.stringify(laundryRevenue));

    // Populate Shop details
    const shops = await Shop.find({}, "_id name category status");

    const breakdown = shops.map(shop => {
      let revenue = 0;
      let count = 0;

      if (shop.category === "canteen") {
        const orderRev = orderRevenue.find(r => String(r._id) === String(shop._id));
        revenue += orderRev ? orderRev.total : 0;
      }
      
      if (shop.category === "barber") {
        const bRev = barberRevenue.find(r => String(r._id) === String(shop._id));
        // Flat haircut rate: 100 for example, as not stored in DB
        revenue += bRev ? bRev.count * 100 : 0;
        count += bRev ? bRev.count : 0;
      }

      if (shop.category === "laundry") {
        const lRev = laundryRevenue.find(r => String(r._id) === String(shop._id));
        revenue += lRev ? lRev.total : 0;
      }

      return {
        shopId: shop._id,
        name: shop.name,
        category: shop.category,
        status: shop.status,
        revenue,
        bookingsCount: count
      };
    });

    const totalRevenue = breakdown.reduce((acc, curr) => acc + curr.revenue, 0);

    res.json({
      totalUsers,
      totalRevenue,
      breakdown
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Create New Shop and Owner
router.post("/shops", async (req, res) => {
  const { shopName, category, ownerEmail, ownerPassword } = req.body;
  if (!shopName || !category || !ownerEmail || !ownerPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if the user/email already exists
    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create the Shop Owner User
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    const user = await User.create({
      email: ownerEmail,
      passwordHash,
      role: "shop_owner"
    });

    // Create the Shop linked to the Owner
    const shop = await Shop.create({
      name: shopName,
      category,
      ownerId: user._id,
      menu: [],
      slots: []
    });

    // Cross-link User to Shop
    user.shopId = shop._id;
    await user.save();

    res.status(201).json({ message: "Shop and Owner created successfully", shop });
  } catch (error) {
    console.error("Create shop error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete Shop and Owner
router.delete("/shops/:shopId", async (req, res) => {
  const { shopId } = req.params;
  try {
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Delete the owner user if linked
    if (shop.ownerId) {
      await User.findByIdAndDelete(shop.ownerId);
    }

    // Delete the shop
    await Shop.findByIdAndDelete(shopId);

    res.json({ message: "Shop and linked owner deleted successfully" });
  } catch (error) {
    console.error("Delete shop error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
