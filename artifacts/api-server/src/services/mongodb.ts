import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | undefined;

export class MongoConfigurationError extends Error {
  constructor() {
    super("MongoDB is not configured. Add the MONGODB_URI secret to save reports.");
    this.name = "MongoConfigurationError";
  }
}

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new MongoConfigurationError();
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 7000,
        appName: "SAHM",
      })
      .catch((error: unknown) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
}
