using Kanasta.Application.Auth;

namespace Kanasta.Application.Abstractions;

public interface IAuthService
{
    Task<AdminStatusResponse> CheckAdminStatusAsync(CancellationToken ct = default);
    Task<AuthResponse> SetupInitialAdminAsync(SetupAdminRequest request, CancellationToken ct = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task LogoutAsync(Guid userId, CancellationToken ct = default);
    Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default);
}
