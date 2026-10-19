using Kanasta.Application.Abstractions;
using Kanasta.Application.Auth;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly KanastaDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;

    public AuthService(
        KanastaDbContext dbContext,
        IPasswordHasher passwordHasher,
        ITokenService tokenService)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<AdminStatusResponse> CheckAdminStatusAsync(CancellationToken ct = default)
    {
        var hasAdmin = await _dbContext.Users.AnyAsync(u => u.Role == UserRole.Admin, ct);
        return new AdminStatusResponse(hasAdmin);
    }

    public async Task<AuthResponse> SetupInitialAdminAsync(SetupAdminRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            throw new BusinessRuleException("Debe proporcionar un correo electrónico válido.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            throw new BusinessRuleException("La contraseña debe tener al menos 6 caracteres.");
        }

        var adminExists = await _dbContext.Users.AnyAsync(u => u.Role == UserRole.Admin, ct);
        if (adminExists)
        {
            throw new ConflictException("El administrador inicial ya ha sido configurado en el sistema.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailTaken = await _dbContext.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail, ct);
        if (emailTaken)
        {
            throw new ConflictException("El correo electrónico ya está registrado.");
        }

        var passwordHash = _passwordHasher.HashPassword(request.Password);

        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            FullName = string.IsNullOrWhiteSpace(request.FullName) ? "Administrador Principal" : request.FullName.Trim(),
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            LastLoginAt = DateTime.UtcNow
        };

        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = admin.Id,
            TerminalName = "Setup Inicial",
            StartedAt = DateTime.UtcNow,
            LoginSuccess = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(admin);
        _dbContext.UserSessions.Add(session);
        await _dbContext.SaveChangesAsync(ct);

        var token = _tokenService.GenerateAccessToken(admin);
        var userDto = new UserDto(admin.Id, admin.Email, admin.FullName, admin.Role.ToString(), admin.IsActive, admin.LastLoginAt);

        return new AuthResponse(token, userDto);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new UnauthorizedException("Debe ingresar correo y contraseña.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, ct);

        if (user == null)
        {
            // Mensaje genérico para no revelar existencia de usuarios
            throw new UnauthorizedException("Credenciales inválidas.");
        }

        if (!user.IsActive)
        {
            var inactiveSession = new UserSession
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TerminalName = request.TerminalName,
                StartedAt = DateTime.UtcNow,
                EndedAt = DateTime.UtcNow,
                LoginSuccess = false,
                FailureReasonCode = "USER_INACTIVE",
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.UserSessions.Add(inactiveSession);
            await _dbContext.SaveChangesAsync(ct);

            throw new UnauthorizedException("Esta cuenta de usuario ha sido desactivada. Contacte al administrador.");
        }

        var isPasswordValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            var failedSession = new UserSession
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TerminalName = request.TerminalName,
                StartedAt = DateTime.UtcNow,
                EndedAt = DateTime.UtcNow,
                LoginSuccess = false,
                FailureReasonCode = "INVALID_CREDENTIALS",
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.UserSessions.Add(failedSession);
            await _dbContext.SaveChangesAsync(ct);

            throw new UnauthorizedException("Credenciales inválidas.");
        }

        // Login exitoso
        var successfulSession = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TerminalName = request.TerminalName,
            StartedAt = DateTime.UtcNow,
            LoginSuccess = true,
            CreatedAt = DateTime.UtcNow
        };

        user.LastLoginAt = DateTime.UtcNow;

        _dbContext.UserSessions.Add(successfulSession);
        await _dbContext.SaveChangesAsync(ct);

        var token = _tokenService.GenerateAccessToken(user);
        var userDto = new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.IsActive, user.LastLoginAt);

        return new AuthResponse(token, userDto);
    }

    public async Task LogoutAsync(Guid userId, CancellationToken ct = default)
    {
        var openSession = await _dbContext.UserSessions
            .Where(s => s.UserId == userId && s.EndedAt == null)
            .OrderByDescending(s => s.StartedAt)
            .FirstOrDefaultAsync(ct);

        if (openSession != null)
        {
            openSession.EndedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _dbContext.Users.FindAsync(new object[] { userId }, ct);
        if (user == null)
        {
            throw new NotFoundException("Usuario no encontrado.");
        }

        return new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.IsActive, user.LastLoginAt);
    }
}
