using Kanasta.Application.Auth;

namespace Kanasta.Application.Abstractions;

public interface IUserAdminService
{
    Task<IReadOnlyList<UserDto>> GetAllUsersAsync(CancellationToken ct = default);
    Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateUserStatusAsync(Guid userId, bool isActive, CancellationToken ct = default);
    Task<IReadOnlyList<UserSessionDto>> GetUserSessionsAsync(Guid userId, CancellationToken ct = default);
}
