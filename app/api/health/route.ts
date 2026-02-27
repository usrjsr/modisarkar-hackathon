import connectDB from "@/lib/db/mongodb"

export async function GET() {
  await connectDB()
  return Response.json({ status: "DB Connected" })
}