import type { NextApiRequest, NextApiResponse } from 'next';
import NextAuth, { NextAuthOptions, DefaultSession, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role?: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('[NextAuth][authorize] Missing Supabase envs', {
            hasUrl: !!supabaseUrl,
            hasAnonKey: !!supabaseAnonKey,
          });
          return null;
        }
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials?.email || '',
            password: credentials?.password || '',
          });
          if (error) {
            console.warn('[NextAuth][authorize] Supabase signIn error', error);
            return null;
          }
          if (!data?.user) {
            console.warn('[NextAuth][authorize] No user returned from Supabase');
            return null;
          }
          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            name: (data.user.user_metadata as any)?.full_name,
            role: (data.user.user_metadata as any)?.role || 'user',
          } as User;
          console.debug('[NextAuth][authorize] Authenticated user', { id: user.id, role: (user as any).role });
          return user;
        } catch (e) {
          console.error('[NextAuth][authorize] Exception', e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || '';
        if (token.role) session.user.role = token.role as string;
      }
      console.debug('[NextAuth][session]', { userId: session.user?.id, role: session.user?.role });
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.role = (user as User).role;
      console.debug('[NextAuth][jwt]', { sub: token.sub, role: token.role });
      return token;
    },
  },
};

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
