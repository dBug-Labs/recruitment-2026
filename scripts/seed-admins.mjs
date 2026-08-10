import "dotenv/config";
import { MongoClient } from "mongodb";

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set.");
    process.exit(1);
  }

  const emailsStr = process.env.ADMIN_BOOTSTRAP_EMAILS;
  if (!emailsStr) {
    console.error("❌ ADMIN_BOOTSTRAP_EMAILS is not set. Please set a comma-separated list of emails.");
    process.exit(1);
  }

  const emails = emailsStr.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) {
    console.error("❌ No valid emails found in ADMIN_BOOTSTRAP_EMAILS.");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const users = db.collection("users");

  for (const email of emails) {
    const existing = await users.findOne({ email });
    if (existing) {
      if (existing.role === "admin") {
        console.log(`✅ ${email} is already an admin.`);
      } else {
        await users.updateOne({ _id: existing._id }, { $set: { role: "admin" } });
        console.log(`🆙 Upgraded ${email} to admin.`);
      }
    } else {
      await users.insertOne({
        email,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✨ Created new admin: ${email}`);
    }
  }

  await client.close();
  console.log("Done.");
}

run().catch(console.dir);
