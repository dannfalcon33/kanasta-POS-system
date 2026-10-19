using System.Net;
using System.Text.Json;
using Kanasta.Api.Controllers;
using Kanasta.Api.Middlewares;
using Kanasta.Application.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kanasta.Tests;

public class SecurityHardeningTests
{
    [Fact]
    public async Task SecurityHeadersMiddleware_AppendsRequiredSecurityHeaders()
    {
        // Arrange
        var context = new DefaultHttpContext();
        RequestDelegate next = (ctx) =>
        {
            ctx.Response.StatusCode = (int)HttpStatusCode.OK;
            return Task.CompletedTask;
        };

        var middleware = new SecurityHeadersMiddleware(next);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal("nosniff", context.Response.Headers["X-Content-Type-Options"]);
        Assert.Equal("DENY", context.Response.Headers["X-Frame-Options"]);
        Assert.Equal("1; mode=block", context.Response.Headers["X-XSS-Protection"]);
        Assert.Equal("strict-origin-when-cross-origin", context.Response.Headers["Referrer-Policy"]);
        Assert.Contains("default-src 'self'", context.Response.Headers["Content-Security-Policy"].ToString());
        Assert.Contains("tauri://localhost", context.Response.Headers["Content-Security-Policy"].ToString());
        Assert.Contains("https://tauri.localhost", context.Response.Headers["Content-Security-Policy"].ToString());
        Assert.Contains("camera=()", context.Response.Headers["Permissions-Policy"].ToString());
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_ShieldsInternalServerErrors_WithoutLeakingStackTrace()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var logger = new NullLogger<ExceptionHandlingMiddleware>();

        RequestDelegate next = (ctx) =>
        {
            // Simulate critical unhandled exception (e.g. database connection string or internal crash)
            throw new InvalidOperationException("Fatal SQL Crash: Password=SuperSecretServerKey! Connection timed out on 192.168.1.100");
        };

        var middleware = new ExceptionHandlingMiddleware(next, logger);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal((int)HttpStatusCode.InternalServerError, context.Response.StatusCode);
        Assert.Equal("application/json", context.Response.ContentType);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();

        // Must NOT leak database details or stack trace
        Assert.DoesNotContain("SuperSecretServerKey", responseBody);
        Assert.DoesNotContain("192.168.1.100", responseBody);
        Assert.DoesNotContain("StackTrace", responseBody);
        Assert.DoesNotContain("InvalidOperationException", responseBody);

        // Must return friendly generic message and traceId for audit
        using var doc = JsonDocument.Parse(responseBody);
        var root = doc.RootElement.GetProperty("error");
        Assert.Equal("Ha ocurrido un error interno en el servidor.", root.GetProperty("message").GetString());
        Assert.Equal(500, root.GetProperty("statusCode").GetInt32());
        Assert.True(root.TryGetProperty("traceId", out var traceIdProp));
        Assert.False(string.IsNullOrWhiteSpace(traceIdProp.GetString()));
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_ReturnsExpectedStatusCode_ForAppExceptions()
    {
        // Arrange
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var logger = new NullLogger<ExceptionHandlingMiddleware>();

        RequestDelegate next = (ctx) =>
        {
            throw new BusinessRuleException("Saldo de stock insuficiente para completar la operación.");
        };

        var middleware = new ExceptionHandlingMiddleware(next, logger);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal((int)HttpStatusCode.BadRequest, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();

        using var doc = JsonDocument.Parse(responseBody);
        var root = doc.RootElement.GetProperty("error");
        Assert.Equal("Saldo de stock insuficiente para completar la operación.", root.GetProperty("message").GetString());
        Assert.Equal(400, root.GetProperty("statusCode").GetInt32());
    }

    [Fact]
    public void AuthController_IsConfiguredWithRateLimitingAttribute()
    {
        // Verify AuthController is decorated with EnableRateLimiting to prevent brute-force attacks
        var authControllerType = typeof(AuthController);
        var rateLimitingAttr = (EnableRateLimitingAttribute?)Attribute.GetCustomAttribute(
            authControllerType, 
            typeof(EnableRateLimitingAttribute));

        Assert.NotNull(rateLimitingAttr);
        Assert.Equal("AuthLimiter", rateLimitingAttr.PolicyName);
    }
}
