using Azure.Data.Tables;
using Azure.Messaging.EventHubs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Devices;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Logging;
using System.ComponentModel.Design.Serialization;
using System.Net.Http.Json;
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
            battery = entity.GetInt32("battery"),
            isCharging = entity.GetBoolean("isCharging"),
            date = entity.GetDateTimeOffset("date")
        };

        return new OkObjectResult(carStatus);
    }

    [Function("SetCharging")]
    public async Task<IActionResult> SetCharging([HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequest req)
    {
        // Read request from frontend
        SetChargingRequest? carMessage;

        try
        {
            // Ignore if the stream does not support seeking
            carMessage = await JsonSerializer.DeserializeAsync<SetChargingRequest>(req.Body);

        }
        catch (JsonException)
        {
            return new BadRequestObjectResult(new
            {
                error = "Send valid JSON with isCharging set to true or false."
            });
        }
            

        if (carMessage == null || carMessage.IsCharging == null)
        {
            return new BadRequestObjectResult(new
            {
                error = "isCharging is required and must be true or false."
            });
        }

        bool requestedState = carMessage.IsCharging.Value;

        // Get IoT Hub service connection string
        var connectionString =
            Environment.GetEnvironmentVariable("IoTHubServiceConnectionString")
            ?? throw new InvalidOperationException(
                "IoTHubServiceConnectionString is missing.");

        // Connect to IoT Hub
        using var serviceClient =
            ServiceClient.CreateFromConnectionString(connectionString);

        // Create direct method call
        var method = new CloudToDeviceMethod("SetCharging");

        // Send only isCharging to the simulated car
        method.SetPayloadJson(
            JsonSerializer.Serialize(new
            {
                isCharging = requestedState
            })
        );

        // Send command to device
        var result = await serviceClient.InvokeDeviceMethodAsync("conrad-iot-device-1", method);

        // Return result to frontend
        return new OkObjectResult(new
        {
            isCharging = requestedState,
            deviceStatus = result.Status
        });
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
    public bool IsCharging { get; set; }

    [JsonPropertyName("battery")]
    public int? Battery { get; set; }

    [JsonPropertyName("date")]
    public DateTimeOffset Date { get; set; }
}

public class SetChargingRequest
{
    [JsonPropertyName("isCharging")]
    public bool? IsCharging { get; set; }
}