"use client"

import { signOut } from "next-auth/react"

export default function LogoutButton() {
  return (
    <button
      onClick={()=>signOut({callbackUrl:"/login"})}
      className="px-4 py-2 bg-red-500 text-white"
    >
      Logout
    </button>
  )
}