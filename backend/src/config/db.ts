import mongoose from "mongoose";

export async function connectDb(uri: string): Promise<void> {
    await mongoose.connect(uri);
    console.log(`Connexion à MongoDB réussie (base : ${mongoose.connection.name}).`);
}

export async function disconnectDb(): Promise<void> {
    await mongoose.disconnect();
}