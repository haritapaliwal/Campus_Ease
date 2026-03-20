import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Shop from './models/Shop.js';
import User from './models/User.js';

dotenv.config();

const NEW_PASSWORD = 'CCD@1234';

const reset = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    const shop = await Shop.findOne({ name: 'CCD' });
    if (!shop) {
      console.log('CCD shop not found!');
      process.exit(1);
    }

    console.log(`Found shop: ${shop.name} | OwnerId: ${shop.ownerId}`);

    if (!shop.ownerId) {
      console.log('CCD shop has no owner assigned!');
      process.exit(1);
    }

    const user = await User.findById(shop.ownerId);
    if (!user) {
      console.log('Owner user not found!');
      process.exit(1);
    }

    console.log(`Owner Email: ${user.email}`);

    const hashed = await bcrypt.hash(NEW_PASSWORD, 10);
    user.password = hashed;
    await user.save();

    console.log('');
    console.log('=============================');
    console.log('   CCD Owner Credentials     ');
    console.log('=============================');
    console.log(`Email   : ${user.email}`);
    console.log(`Password: ${NEW_PASSWORD}`);
    console.log('=============================');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

reset();
