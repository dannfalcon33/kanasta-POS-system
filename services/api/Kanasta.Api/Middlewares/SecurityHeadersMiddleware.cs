namespace Kanasta.Api.Middlewares;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Prevent MIME type sniffing
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";

        // 2. Prevent clickjacking by denying iframe embedding
        context.Response.Headers["X-Frame-Options"] = "DENY";

        // 3. Enable browser XSS filtering
        context.Response.Headers["X-XSS-Protection"] = "1; mode=block";

        // 4. Referrer Policy
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // 5. Content Security Policy (suitable for POS API & Desktop client)
        context.Response.Headers["Content-Security-Policy"] = 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "connect-src 'self' http://localhost:* ws://localhost:* tauri://localhost https://tauri.localhost; " +
            "font-src 'self' data:;";

        // 6. Permissions Policy (restrict sensitive hardware APIs)
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";

        await _next(context);
    }
}
