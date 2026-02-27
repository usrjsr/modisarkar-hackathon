/* eslint-disable @typescript-eslint/no-unused-vars */
import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: string
      rank: string
      commandLevel: string
    }
  }

  interface User {
    id: string
    role: string
    rank: string
    commandLevel: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    rank: string
    commandLevel: string
  }
}