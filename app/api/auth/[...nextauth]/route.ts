import NextAuth from "next-auth/next"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import connectDB from "@/lib/db/mongodb"
import Personnel from "@/lib/db/models/Personnel"

const handler = NextAuth({
  session: {
    strategy: "jwt"
  },

  providers: [
    CredentialsProvider({
      name: "credentials",

      credentials: {
        email: {},
        password: {}
      },

      async authorize(credentials) {
        await connectDB()

        const officer = await Personnel.findOne({
          email: credentials?.email
        })

        if (!officer) throw new Error("Officer not found")

        const validPassword = await bcrypt.compare(
          credentials!.password,
          officer.password
        )

        if (!validPassword)
          throw new Error("Invalid credentials")

        return {
          id: officer._id.toString(),
          name: officer.name,
          email: officer.email,
          role: officer.role,
          rank: officer.rank,
          commandLevel: officer.commandLevel
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; role: string; rank: string; commandLevel: string; }
        token.id = u.id
        token.role = u.role
        token.rank = u.rank
        token.commandLevel = u.commandLevel
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as { id: string; role: string; rank: string; commandLevel: string; }
        u.id = token.id as string
        u.role = token.role as string
        u.rank = token.rank as string
        u.commandLevel = token.commandLevel as string
      }
      return session
    }
  },

  pages: {
    signIn: "/login"
  },

  secret: process.env.NEXTAUTH_SECRET
})

export { handler as GET, handler as POST }