import NextAuth from "next-auth"
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
        token.id = user.id
        token.role = user.role
        token.rank = user.rank
        token.commandLevel = user.commandLevel
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.rank = token.rank as string
      session.user.commandLevel =
        token.commandLevel as string

      return session
    }
  },

  pages: {
    signIn: "/login"
  },

  secret: process.env.NEXTAUTH_SECRET
})

export { handler as GET, handler as POST }