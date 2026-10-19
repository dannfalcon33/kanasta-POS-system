namespace Kanasta.Application.Auth;

public record SetupAdminRequest(string Email, string Password, string FullName);

public record LoginRequest(string Email, string Password, string? TerminalName = null);

public record UserDto(Guid Id, string Email, string FullName, string Role, bool IsActive, DateTime? LastLoginAt);

public record AuthResponse(string AccessToken, UserDto User);

public record AdminStatusResponse(bool HasAdmin);

public record CreateUserRequest(string Email, string Password, string FullName, string Role);

public record UpdateUserStatusRequest(bool IsActive);

public record UserSessionDto(
    Guid Id,
    Guid UserId,
    string? TerminalName,
    DateTime StartedAt,
    DateTime? EndedAt,
    bool LoginSuccess,
    string? FailureReasonCode
);
