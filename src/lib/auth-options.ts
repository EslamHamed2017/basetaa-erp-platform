import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Single admin account — credentials stored in environment variables.

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Login',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminEmail    = process.env.ADMIN_EMAIL
        const adminPassword = process.env.ADMIN_PASSWORD

        if (!adminEmail || !adminPassword) {
          console.error('ADMIN_EMAIL or ADMIN_PASSWORD not set in environment.')
          return null
        }

        if (
          credentials?.email !== adminEmail ||
          credentials?.password !== adminPassword
        ) {
          return null
        }

        return {
          id: 'admin',
          name: 'Admin',
          email: adminEmail,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    // '/login' is correct: middleware on control.erp.basetaa.com rewrites
    // /login → /admin/login internally. Using /admin/login here would produce
    // the double-prefix /admin/admin/login after the rewrite.
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = 'admin'
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string
      return session
    },
  },
}
