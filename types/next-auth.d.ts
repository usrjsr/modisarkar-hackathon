// Disable import of NextAuth explicitly if not used

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