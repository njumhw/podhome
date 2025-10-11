export function jsonError(message: string, status = 400) {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}