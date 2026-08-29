import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.applicationId || !ObjectId.isValid(session.user.applicationId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { whatsappNumber } = body;

    if (!whatsappNumber || typeof whatsappNumber !== "string" || whatsappNumber.trim().length < 10) {
      return NextResponse.json({ error: "Invalid WhatsApp number" }, { status: 400 });
    }

    const col = await getCollection("applications");
    const result = await col.updateOne(
      { _id: new ObjectId(session.user.applicationId) },
      { $set: { whatsappNumber: whatsappNumber.trim() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[whatsapp-api] Error saving WhatsApp number:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
