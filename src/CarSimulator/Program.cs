using Microsoft.Azure.Devices.Client;
using Newtonsoft.Json;
using System.Text;

DotNetEnv.Env.TraversePath().Load(".env");

string deviceConnectionString = Environment.GetEnvironmentVariable("DEVICE_CONNECTION_STRING");

//Console.WriteLine(deviceConnectionString);

var deviceClient = DeviceClient.CreateFromConnectionString(deviceConnectionString);

var carMessage = new carMessage()
{
    isCharging = true,
    battery = 80
};

var serializedMessage = JsonConvert.SerializeObject(carMessage);

var iotMessage = new Message(Encoding.UTF8.GetBytes(serializedMessage));

// send message to cloud
await deviceClient.SendEventAsync(iotMessage);

//Console.ReadLine();

class carMessage
{
    public bool isCharging { get; set; }
    public int battery { get; set; }
}

