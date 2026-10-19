using System.Security.Claims;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting("AuthLimiter")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService _authService)
    {
        this._authService = _authService;
    }

    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<ActionResult<AdminStatusResponse>> GetStatus(CancellationToken ct)
    {
        var response = await _authService.CheckAdminStatusAsync(ct);
        return Ok(response);
    }

    [HttpPost("setup-admin")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> SetupAdmin([FromBody] SetupAdminRequest request, CancellationToken ct)
    {
        var response = await _authService.SetupInitialAdminAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var response = await _authService.LoginAsync(request, ct);
        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            await _authService.LogoutAsync(userId, ct);
        }

        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetMe(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _authService.GetCurrentUserAsync(userId, ct);
        return Ok(user);
    }
}
