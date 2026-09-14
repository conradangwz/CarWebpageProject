using Azure.Messaging.EventHubs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.ComponentModel.Design.Serialization;
using System.Net.Http.Json;
using Azure.Data.Tables;
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
        var storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage") ?? throw new InvalidOperationException("AzureWebJobsStorage is missing.");

        var tableClient = new TableClient(storageConnectionString, "CarStatus");

        // find new row written by telemetry
        var response =  await tableClient.GetEntityIfExistsAsync<TableEntity>("cars", "car1");
        
        if (!response.HasValue)
        {
            return new NotFoundResult();
        }

        var entity = response.Value;
        var carStatus = new
        {
            Battery = entity["battery"].ToString(),
            IsCharging = bool.Parse(entity["isCharging"].ToString()),
            Date = entity["date"].ToString()
        };

        return new OkObjectResult(carStatus);
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
    public async Task ProcessTelemetry([EventHubTrigger("iothub-ehub-conrad-iot-73760081-5b94680e70", Connection = "IotHubEventsConnection", ConsumerGroup = "carfunctions")] EventData[] events)
    {
        var storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage") ?? throw new InvalidOperationException("AzureWebJobsStorage is missing.");

        var tableClient = new TableClient(storageConnectionString, "CarStatus");

        // Create the table if this is the first run.
        await tableClient.CreateIfNotExistsAsync();

        foreach (var eventData in events)
        {
            var messageBody = eventData.EventBody.ToString();
            _logger.LogInformation($"Received telemetry: {messageBody}");


            // convert JSON to CarMessage
            CarMessage? carMessage;

            try
            {
                carMessage =
                    JsonSerializer.Deserialize<CarMessage>(messageBody);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Skipping invalid telemetry.");
                continue;
            }

            if (carMessage is null)
            {
                _logger.LogWarning("Skipping null telemetry.");
                continue;
            }

            // build the row to save
            var entity = new TableEntity("cars", "car1")
            {
                ["battery"] = carMessage.Battery,
                ["isCharging"] = carMessage.IsCharging,
                ["date"] = carMessage.Date.ToUniversalTime()
            };

            // Insert the row, or replace its previous values.
            await tableClient.UpsertEntityAsync(
                entity,
                TableUpdateMode.Replace);

            _logger.LogInformation(
                "Saved car1: battery={Battery}, charging={IsCharging}",
                carMessage.Battery,
                carMessage.IsCharging);
        }
    }
}

public class CarMessage
{
    [JsonPropertyName("isCharging")]
    public required bool IsCharging { get; set; }

    [JsonPropertyName("battery")]
    public required int Battery { get; set; }

    [JsonPropertyName("date")]
    public required DateTimeOffset Date { get; set; }
}