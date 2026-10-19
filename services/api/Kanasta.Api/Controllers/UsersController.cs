using Kanasta.Application.Abstractions;
using Kanasta.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly IUserAdminService _userAdminService;

    public UsersController(IUserAdminService userAdminService)
    {
        _userAdminService = userAdminService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetAll(CancellationToken ct)
    {
        var users = await _userAdminService.GetAllUsersAsync(ct);
        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        var user = await _userAdminService.CreateUserAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<UserDto>> UpdateStatus([FromRoute] Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken ct)
    {
        var user = await _userAdminService.UpdateUserStatusAsync(id, request.IsActive, ct);
        return Ok(user);
    }

    [HttpGet("{id:guid}/sessions")]
    public async Task<ActionResult<IReadOnlyList<UserSessionDto>>> GetSessions([FromRoute] Guid id, CancellationToken ct)
    {
        var sessions = await _userAdminService.GetUserSessionsAsync(id, ct);
        return Ok(sessions);
    }
}
