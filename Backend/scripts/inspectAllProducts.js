const mongoose = require('c:/Users/admin/Desktop/IRA-Sathi/Backend/node_modules/mongoose');
const dotenv = require('c:/Users/admin/Desktop/IRA-Sathi/Backend/node_modules/dotenv');
const path = require('path');

dotenv.config({ path: 'c:/Users/admin/Desktop/IRA-Sathi/Backend/.env' });

const Product = require('c:/Users/admin/Desktop/IRA-Sathi/Backend/models/Product');

async function inspect() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const products = await Product.find({});
    
    products.forEach(p => {
      console.log(`Product: [${p._id}] "${p.name}" | weight.unit: "${p.weight?.unit}" | stockUnit: "${p.stockUnit}"`);
      if (p.attributeStocks && p.attributeStocks.length > 0) {
        p.attributeStocks.forEach((v, i) => {
          console.log(`  -> Variant ${i+1}: stockUnit: "${v.stockUnit}"`);
        });
      }
    });

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

inspect();
