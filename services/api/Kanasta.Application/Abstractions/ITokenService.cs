using Kanasta.Domain.Entities;

namespace Kanasta.Application.Abstractions;

public interface ITokenService
{
    string GenerateAccessToken(User user);
}
