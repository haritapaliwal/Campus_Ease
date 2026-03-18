import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from './models/Shop.js';
import User from './models/User.js';

dotenv.config();

const clean = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected...");
    
    const duplicates = ["barber", "laundry", "vinayak"];
    
    // Find the shops first
    const shopsToDelete = await Shop.find({ name: { $in: duplicates } });
    console.log(`Found ${shopsToDelete.length} duplicate shops.`);

    for (let shop of shopsToDelete) {
      console.log(`Deleting shop: ${shop.name} (${shop._id})`);
      await Shop.findByIdAndDelete(shop._id);
      
      // Also delete the owner user if it exists
      if (shop.ownerId) {
        await User.findByIdAndDelete(shop.ownerId);
        console.log(`Deleted owner user for shop: ${shop.name}`);
      }
    }
    
    console.log("Cleanup complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
clean();
