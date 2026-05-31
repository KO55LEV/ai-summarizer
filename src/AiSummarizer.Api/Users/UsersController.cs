using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Users;

[ApiController]
[Route("api/users")]
public sealed class UsersController(IUsersService usersService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterUserRequest request, CancellationToken cancellationToken)
        => Ok(Map(await usersService.RegisterAsync(new RegisterUserCommand(request.Email, request.Password, request.DisplayName), cancellationToken)));

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginWithPasswordRequest request, CancellationToken cancellationToken)
        => Ok(Map(await usersService.LoginWithPasswordAsync(new LoginWithPasswordCommand(request.Email, request.Password), cancellationToken)));

    [HttpPost("google")]
    public async Task<ActionResult<AuthResponse>> LoginWithGoogle([FromBody] ExternalLoginRequest request, CancellationToken cancellationToken)
        => Ok(Map(await usersService.LoginWithGoogleAsync(new ExternalLoginCommand(request.AccessToken), cancellationToken)));

    [HttpPost("facebook")]
    public async Task<ActionResult<AuthResponse>> LoginWithFacebook([FromBody] ExternalLoginRequest request, CancellationToken cancellationToken)
        => Ok(Map(await usersService.LoginWithFacebookAsync(new ExternalLoginCommand(request.AccessToken), cancellationToken)));

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshSessionRequest request, CancellationToken cancellationToken)
        => Ok(Map(await usersService.RefreshAsync(new RefreshSessionCommand(request.RefreshToken), cancellationToken)));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var sessionId = ReadSessionId();
        if (sessionId is null)
        {
            return Unauthorized();
        }

        await usersService.LogoutAsync(sessionId.Value, cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
    {
        var sessionId = ReadSessionId();
        if (sessionId is null)
        {
            return Unauthorized();
        }

        return Ok(Map(await usersService.GetMeAsync(sessionId.Value, cancellationToken)));
    }

    private Guid? ReadSessionId()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return Guid.TryParse(header["Bearer ".Length..].Trim(), out var sessionId) ? sessionId : null;
    }

    private static AuthResponse Map(AuthResult result)
        => new(
            Map(result.User),
            new SessionResponse(result.Session.AccessToken, result.Session.RefreshToken, result.Session.ExpiresAt));

    private static UserResponse Map(UserDto user)
        => new(
            user.Id,
            user.Email,
            user.DisplayName,
            user.AvatarUrl,
            user.Locale,
            user.TimeZone,
            user.Status,
            user.CreatedAt,
            user.UpdatedAt);
}
