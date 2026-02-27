import bcrypt from "bcryptjs"
import connectDB from "@/lib/db/mongodb"
import Personnel from "@/lib/db/models/Personnel"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    await connectDB()

    console.log("DB connected")

    const exists = await Personnel.findOne({
      email: "admin@sentinel.com"
    })

    if (exists) {
      return NextResponse.json({ message: "Admin already exists" })
    }

    const hash = await bcrypt.hash("admin123", 10)

    const admin = await Personnel.create({
      name: "Control Room Admin",
      badgeNumber: "ADM001",
      email: "admin@sentinel.com",
      password: hash,
      role: "ADMIN",
      rank: "SP",
      commandLevel: "Strategic",
      status: "Active"
    })

    console.log(admin)

    return NextResponse.json({ created: true })

  } catch (err: any) {
    console.error("SEED ERROR:", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}