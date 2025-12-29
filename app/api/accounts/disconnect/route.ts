import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!(session as any)?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const { accountId } = await req.json();
    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing accountId" }, { status: 400 });
    }
    // Only delete if the account belongs to this user
    await prisma.account.deleteMany({
      where: {
        userId: (session as any).user.id as string,
        provider: "google",
        providerAccountId: accountId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


