"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  async function handleLogin(e:React.FormEvent) {
    e.preventDefault()

    setLoading(true)

    const res = await signIn("credentials",{
      email,
      password,
      redirect:false
    })

    setLoading(false)

    if(!res?.error){
      router.push("/")
    } else {
      alert("Invalid credentials")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded shadow w-80 space-y-4"
      >
        <h2 className="text-xl font-semibold">
          Operation Sentinel Login
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="border w-full p-2"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="border w-full p-2"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="bg-black text-white w-full p-2"
        >
          {loading ? "Logging..." : "Login"}
        </button>
      </form>
    </div>
  )
}