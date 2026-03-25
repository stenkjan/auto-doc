import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      billingComplete: boolean;
    };
  }

  interface User {
    role?: string;
    billingComplete?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    billingComplete?: boolean;
  }
}
