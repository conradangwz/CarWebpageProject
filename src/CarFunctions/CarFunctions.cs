using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CarFunctions;

public class CarFunctions
{
    private readonly ILogger<CarFunctions> _logger;

    public CarFunctions(ILogger<CarFunctions> logger)
    {
        _logger = logger;
    }

    [Function("GetCarStatus")]
    public async Task<IActionResult> GetCarStatus([HttpTrigger(AuthorizationLevel.Function, "get")] HttpRequest req)
    {
        _logger.LogInformation("Car Status requested.");

        return new OkObjectResult("Get method");
    }

    [Function("StartCharging")]
    public async Task<IActionResult> StartCharging([HttpTrigger(AuthorizationLevel.Function, "post", "put")] HttpRequest req)
    {
        _logger.LogInformation("Starting charging.");

        return new OkObjectResult("start charging");
    }

    [Function("StopCharging")]
    public async Task<IActionResult> StopCharging([HttpTrigger(AuthorizationLevel.Function, "post", "put")] HttpRequest req)
    {
        _logger.LogInformation("Stopping charging.");

        return new OkObjectResult("stop charging");
    }

    [Function("SetChargingSchedule")]
    public async Task<IActionResult> SetChargingSchedule([HttpTrigger(AuthorizationLevel.Function, "post", "put")] HttpRequest req)
    {
        _logger.LogInformation("Setting charging schedule.");

        return new OkObjectResult("set charging schedule");
    }

    [Function("ProcessTelemetry")]
    public async Task<IActionResult> ProcessTelemetry([HttpTrigger(AuthorizationLevel.Function, "post", "put")] HttpRequest req)
    {
        _logger.LogInformation("Processing telemetry data.");

        return new OkObjectResult("process telemetry data");
    }
}