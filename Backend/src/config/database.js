const mongoose = require("mongoose")



async function connectToDB() {
    const uri = process.env.MONGO_URI

    if (!uri) {
        console.error("MONGO_URI is not defined. Check Backend/.env or your environment variables.")
        process.exit(1)
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        })

        console.log("Connected to Database")
    } catch (err) {
        console.error("Database connection failed:", err.message)
        console.error("If this is MongoDB Atlas, verify your network access, IP whitelist, and DNS connectivity.")
        process.exit(1)
    }
}

module.exports = connectToDB