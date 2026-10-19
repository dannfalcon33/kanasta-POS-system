using Kanasta.Application.Abstractions;
using Kanasta.Application.Auth;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class UserAdminService : IUserAdminService
{
    private readonly KanastaDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;

    public UserAdminService(KanastaDbContext dbContext, IPasswordHasher passwordHasher)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<IReadOnlyList<UserDto>> GetAllUsersAsync(CancellationToken ct = default)
    {
        var users = await _dbContext.Users
            .OrderBy(u => u.Role)
            .ThenBy(u => u.FullName)
            .ToListAsync(ct);

        return users.Select(u => new UserDto(
            u.Id,
            u.Email,
            u.FullName,
            u.Role.ToString(),
            u.IsActive,
            u.LastLoginAt
        )).ToList();
    }

    public async Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            throw new BusinessRuleException("Debe ingresar un correo electrónico válido.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
        {
            throw new BusinessRuleException("La contraseña inicial debe tener al menos 6 caracteres.");
        }

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
        {
            throw new BusinessRuleException($"El rol '{request.Role}' no es válido. Roles permitidos: Admin, Cashier.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var emailTaken = await _dbContext.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail, ct);
        if (emailTaken)
        {
            throw new ConflictException("Ya existe un usuario con este correo electrónico.");
        }

        var passwordHash = _passwordHasher.HashPassword(request.Password);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            FullName = request.FullName.Trim(),
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(ct);

        return new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.IsActive, user.LastLoginAt);
    }

    public async Task<UserDto> UpdateUserStatusAsync(Guid userId, bool isActive, CancellationToken ct = default)
    {
        var user = await _dbContext.Users.FindAsync(new object[] { userId }, ct);
        if (user == null)
        {
            throw new NotFoundException("Usuario no encontrado.");
        }

        user.IsActive = isActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(ct);

        return new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.IsActive, user.LastLoginAt);
    }

    public async Task<IReadOnlyList<UserSessionDto>> GetUserSessionsAsync(Guid userId, CancellationToken ct = default)
    {
        var sessions = await _dbContext.UserSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.StartedAt)
            .Take(50)
            .ToListAsync(ct);

        return sessions.Select(s => new UserSessionDto(
            s.Id,
            s.UserId,
            s.TerminalName,
            s.StartedAt,
            s.EndedAt,
            s.LoginSuccess,
            s.FailureReasonCode
        )).ToList();
    }
}
