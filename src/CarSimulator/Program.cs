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
    battery = 80
};

while (true)
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

    var serializedMessage = JsonConvert.SerializeObject(carMessage);

    var iotMessage = new Message(Encoding.UTF8.GetBytes(serializedMessage));

    // send message to cloud
    await deviceClient.SendEventAsync(iotMessage);
    //await Task.Delay(10000);

}

class carMessage
{
    public bool isCharging { get; set; }
    public int battery { get; set; }
    public string date { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
}

