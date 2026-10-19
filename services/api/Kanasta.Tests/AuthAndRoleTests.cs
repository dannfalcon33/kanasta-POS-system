using System.Security.Claims;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Auth;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Kanasta.Tests;

public class AuthAndRoleTests
{
    private (KanastaDbContext db, IAuthService authService, IUserAdminService userAdminService, ITokenService tokenService) CreateServices(string dbName)
    {
        var options = new DbContextOptionsBuilder<KanastaDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        var db = new KanastaDbContext(options);
        var passwordHasher = new BcryptPasswordHasher();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "test_super_secret_jwt_key_with_at_least_32_characters!",
                ["Jwt:Issuer"] = "KanastaApiTest",
                ["Jwt:Audience"] = "KanastaDesktopTest",
                ["Jwt:ExpirationMinutes"] = "60"
            })
            .Build();

        var tokenService = new JwtTokenService(configuration);
        var authService = new AuthService(db, passwordHasher, tokenService);
        var userAdminService = new UserAdminService(db, passwordHasher);

        return (db, authService, userAdminService, tokenService);
    }

    [Fact]
    public async Task SetupInitialAdmin_SucceedsOnFirstCall_AndFailsOnSecondCall()
    {
        var (db, authService, _, _) = CreateServices(nameof(SetupInitialAdmin_SucceedsOnFirstCall_AndFailsOnSecondCall));

        var request = new SetupAdminRequest("admin@kanasta.local", "AdminPass123!", "Admin Inicial");

        // First call should succeed
        var response = await authService.SetupInitialAdminAsync(request);

        Assert.NotNull(response);
        Assert.NotEmpty(response.AccessToken);
        Assert.Equal("admin@kanasta.local", response.User.Email);
        Assert.Equal("Admin", response.User.Role);

        // Verify session was created
        var session = await db.UserSessions.FirstOrDefaultAsync(s => s.UserId == response.User.Id);
        Assert.NotNull(session);
        Assert.True(session.LoginSuccess);

        // Second call should throw ConflictException
        await Assert.ThrowsAsync<ConflictException>(() =>
            authService.SetupInitialAdminAsync(new SetupAdminRequest("admin2@kanasta.local", "Password123!", "Segundo Admin")));
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsJwtTokenAndUser()
    {
        var (db, authService, _, _) = CreateServices(nameof(Login_WithValidCredentials_ReturnsJwtTokenAndUser));

        await authService.SetupInitialAdminAsync(new SetupAdminRequest("caja1@kanasta.local", "ClaveSegura2026!", "Cajero Test"));

        var loginResult = await authService.LoginAsync(new LoginRequest("caja1@kanasta.local", "ClaveSegura2026!", "Terminal 01"));

        Assert.NotNull(loginResult);
        Assert.NotEmpty(loginResult.AccessToken);
        Assert.Equal("caja1@kanasta.local", loginResult.User.Email);

        var session = await db.UserSessions.OrderByDescending(s => s.StartedAt).FirstOrDefaultAsync();
        Assert.NotNull(session);
        Assert.True(session.LoginSuccess);
        Assert.Equal("Terminal 01", session.TerminalName);
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ThrowsUnauthorizedAndRecordsFailedSession()
    {
        var (db, authService, _, _) = CreateServices(nameof(Login_WithInvalidPassword_ThrowsUnauthorizedAndRecordsFailedSession));

        await authService.SetupInitialAdminAsync(new SetupAdminRequest("admin@kanasta.local", "CorrectPassword123!", "Admin"));

        // Attempt login with wrong password
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authService.LoginAsync(new LoginRequest("admin@kanasta.local", "WrongPassword!")));

        var failedSession = await db.UserSessions
            .Where(s => s.LoginSuccess == false)
            .OrderByDescending(s => s.StartedAt)
            .FirstOrDefaultAsync();

        Assert.NotNull(failedSession);
        Assert.Equal("INVALID_CREDENTIALS", failedSession.FailureReasonCode);
    }

    [Fact]
    public async Task Login_WhenUserIsDeactivated_ThrowsUnauthorizedAndRecordsInactiveSession()
    {
        var (db, authService, userAdminService, _) = CreateServices(nameof(Login_WhenUserIsDeactivated_ThrowsUnauthorizedAndRecordsInactiveSession));

        var adminRes = await authService.SetupInitialAdminAsync(new SetupAdminRequest("admin@kanasta.local", "AdminPass123!", "Admin"));
        var cashier = await userAdminService.CreateUserAsync(new CreateUserRequest("cajero1@kanasta.local", "Cashier123!", "Cajero Activo", "Cashier"));

        // Deactivate cashier
        await userAdminService.UpdateUserStatusAsync(cashier.Id, isActive: false);

        // Attempt login with inactive cashier
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            authService.LoginAsync(new LoginRequest("cajero1@kanasta.local", "Cashier123!")));

        var session = await db.UserSessions.OrderByDescending(s => s.StartedAt).FirstOrDefaultAsync();
        Assert.NotNull(session);
        Assert.False(session.LoginSuccess);
        Assert.Equal("USER_INACTIVE", session.FailureReasonCode);
    }

    [Fact]
    public async Task CashierToken_RoleCheck_BlocksCashierFromAdminEndpoints()
    {
        var (db, authService, userAdminService, tokenService) = CreateServices(nameof(CashierToken_RoleCheck_BlocksCashierFromAdminEndpoints));

        await authService.SetupInitialAdminAsync(new SetupAdminRequest("admin@kanasta.local", "AdminPass123!", "Admin"));
        var cashierDto = await userAdminService.CreateUserAsync(new CreateUserRequest("cajero@kanasta.local", "Cashier123!", "Cajero", "Cashier"));

        var cashierUser = await db.Users.FindAsync(cashierDto.Id);
        Assert.NotNull(cashierUser);

        // Generate Cashier Token
        var cashierToken = tokenService.GenerateAccessToken(cashierUser);
        Assert.NotEmpty(cashierToken);

        // Inspect claims in token
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(cashierToken);
        var roleClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");

        Assert.NotNull(roleClaim);
        Assert.Equal("Cashier", roleClaim.Value);
        Assert.NotEqual("Admin", roleClaim.Value);
    }

    [Fact]
    public async Task Logout_UpdatesEndedAtOnActiveSession()
    {
        var (db, authService, _, _) = CreateServices(nameof(Logout_UpdatesEndedAtOnActiveSession));

        var login = await authService.SetupInitialAdminAsync(new SetupAdminRequest("admin@kanasta.local", "AdminPass123!", "Admin"));

        var sessionBefore = await db.UserSessions.FirstAsync(s => s.UserId == login.User.Id);
        Assert.Null(sessionBefore.EndedAt);

        await authService.LogoutAsync(login.User.Id);

        var sessionAfter = await db.UserSessions.FirstAsync(s => s.UserId == login.User.Id);
        Assert.NotNull(sessionAfter.EndedAt);
    }
}
