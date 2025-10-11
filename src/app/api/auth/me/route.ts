import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";

export async function GET(req: NextRequest) {
	try {
		const user = await getSessionUser();
		if (!user) {
			return Response.json({ user: null });
		}

		return Response.json({ 
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				role: user.role,
				createdAt: user.createdAt,
			}
		});
	} catch (error) {
		return Response.json({ user: null });
	}
}
