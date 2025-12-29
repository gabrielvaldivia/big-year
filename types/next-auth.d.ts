import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    googleAccounts?: Array<{
      accountId: string;
      email?: string;
      accessToken: string;
      refreshToken?: string;
      accessTokenExpires: number;
    }>;
  }
  interface User {
    id?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    user?: any;
    googleAccounts?: Array<{
      accountId: string;
      email?: string;
      accessToken: string;
      refreshToken?: string;
      accessTokenExpires: number;
    }>;
  }
}


