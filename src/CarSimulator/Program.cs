using Azure.Core;
using Microsoft.Azure.Devices.Client;
using Newtonsoft.Json;
using System.Text;

DotNetEnv.Env.TraversePath().Load(".env");

string deviceConnectionString = Environment.GetEnvironmentVariable("DEVICE_CONNECTION_STRING");

var deviceClient = DeviceClient.CreateFromConnectionString(deviceConnectionString);

var carMessage = new carMessage()
{
    isCharging = true,
    battery = 0
};


var stateLock = new object();

await deviceClient.SetMethodHandlerAsync(
    "SetCharging",
    (request, context) =>
    {
        try
        {
            var command =
                JsonConvert.DeserializeObject<ChargingCommand>(
                    request.DataAsJson);

            if (command?.isCharging is not bool requestedCharging)
            {
                return Task.FromResult(new MethodResponse(400));
            }

            lock (stateLock)
            {
                // Reject starting when the battery is already full.
                if (requestedCharging && carMessage.battery >= 100)
                {
                    return Task.FromResult(new MethodResponse(409));
                }

                carMessage.isCharging = requestedCharging;
            }

            Console.WriteLine(
                $"Charging command applied: {requestedCharging}");

            return Task.FromResult(new MethodResponse(200));
        }
        catch (JsonException)
        {
            return Task.FromResult(new MethodResponse(400));
        }
    },
    null);

while (true)
{
    string serializedMessage;

    lock (stateLock)
    {
        if (carMessage.isCharging && carMessage.battery < 100)
        {
            carMessage.battery += 1;
        }

        if (carMessage.battery >= 100)
        {
            carMessage.isCharging = false;
        }

        carMessage.date = DateTime.UtcNow.ToString("O");

        serializedMessage = JsonConvert.SerializeObject(carMessage);

    }

    using var iotMessage = new Message(Encoding.UTF8.GetBytes(serializedMessage));

    // send message to cloud
    await deviceClient.SendEventAsync(iotMessage);
    await Task.Delay(5000);

}

class carMessage
{
    public bool isCharging { get; set; }
    public int battery { get; set; }
    public string date { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
}

class ChargingCommand
{
    public bool? isCharging { get; set; }
}


