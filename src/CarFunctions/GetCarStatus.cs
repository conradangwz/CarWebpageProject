using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace CarFunctions;

public class GetCarStatus
{
    private readonly ILogger<GetCarStatus> _logger;

    public GetCarStatus(ILogger<GetCarStatus> logger)
    {
        _logger = logger;
    }

    [Function("GetCarStatus")]
    public IActionResult Run([HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequest req)
    {
        _logger.LogInformation("Car Status requested.");
        return new OkObjectResult("Welcome to Azure Functions!");
    }
}