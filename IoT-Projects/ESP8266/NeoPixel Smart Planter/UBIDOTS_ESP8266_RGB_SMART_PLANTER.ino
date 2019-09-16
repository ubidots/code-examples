/*
RGB Smart Planter integrated with Ubidots for Monitoring & Control.

This code works for:

    1) Read two sensors: DHT11, and Soil Moisture.
    2) Publish sensors readings to Ubidots.
    3) Subscribe to multiple variables for remote control.

Libraries required:

- Ubidots ESP8266 MQTT - (https://github.com/ubidots/ubidots-mqtt-esp)
- Adafruit NeoPixel - (https://github.com/adafruit/Adafruit_NeoPixel)
- DHT - (https://github.com/adafruit/DHT-sensor-library)

Made by: Maria Hernández - IoT Developer Advocate @ Ubidots
Revision: José García - Development & Support Manager @ Ubidots

/****************************************
 * Include Libraries
 ****************************************/
#include <Adafruit_NeoPixel.h>
#include <stdio.h>
#include <map>
#include "DHT.h"
#include "UbidotsESPMQTT.h"

/****************************************
 * Define Pins
 ****************************************/
#define LIGHTPIN D1     // Digital pin for Led Lamp.
#define DHTPIN D5       // Digital pin for DHT sensor.
#define NEOPIXELSPIN D6 // Digital pin for NeoPixel Ring.
#define MOISTUREPIN A0  // Analog pin for Moisture Sensor.

/****************************************
 * Define Constants
 ****************************************/
#define TOKEN "BBFF-xxxxxxxxxx" // Assign your Ubidots TOKEN.
#define WIFINAME "xxxxxxxxxx"   // Assign your SSID.
#define WIFIPASS "xxxxxxxxxx"   // Assign your WiFi Password.
#define DEVICE "planter"        // Ubidots Device Label.
#define VAR_PUB_1 "temperature" // Ubidots Variables' label for publishing data.
#define VAR_PUB_2 "humidity"
#define VAR_PUB_3 "soil-moisture"
#define VAR_PUB_4 "heat-index"
#define VAR_SUB_1 "light-1" // Ubidots Variables' label for subscribing to data; \
                            // These variables have to be created at Ubidots.
#define VAR_SUB_2 "light-2"
#define NUMPIXELS 12 // 12 bit NeoPixel Ring
// Uncomment whatever type you're using
#define DHTTYPE DHT11 // DHT 11
//#define DHTTYPE DHT22   // DHT 22  (AM2302), AM2321
//#define DHTTYPE DHT21   // DHT 21 (AM2301)

typedef enum
{
  red,
  green,
  blue,
  yellow,
  white,
  black
} NeoPixelColor;

//   R,   G,   B
uint8_t myColors[][6] = {{250, 0, 0},                             // Red.
                         {0, 255, 0},                             // Green.
                         {0, 0, 255},                             // Blue.
                         {255, 255, 0},                           // Yellow.
                         {255, 255, 255},                         // White.
                         {0, 0, 0}};                              // Black.
const uint8_t numberOfVariables = 2;                              // Number of variables for subscription.
char *variableLabels[numberOfVariables] = {VAR_SUB_1, VAR_SUB_2}; // Variables' label for subscription.
float value;                                                      // Store incoming value.
int lastValue;
bool bottomLight;                         // flag to control conditions for the bottom light.
unsigned long initTime;                   // Store the init time.
const long SECONDS_TO_RECONNECT = 180000; // Period to reconnect MQTT connection.

// Comparison functor to map functions.
struct cmp_str
{
  bool operator()(char const *a, char const *b) const
  {
    return strcmp(a, b) < 0;
  }
};

// Map function declaration.
typedef std::function<void()> FunctionType;
typedef std::map<const char *, FunctionType, cmp_str> mapTopicSubscription;

/****************************************
 * Define Instances
 ****************************************/
Ubidots client(TOKEN);
Adafruit_NeoPixel pixels(NUMPIXELS, NEOPIXELSPIN, NEO_GRB + NEO_KHZ800);
DHT dht(DHTPIN, DHTTYPE);
mapTopicSubscription ubiSubTopic;

/****************************************
 * Main Functions
 ****************************************/
void setup()
{
  initTime = millis(); // Save the init time
  Serial.begin(115200);
  pinMode(LIGHTPIN, OUTPUT); // Declare pin mode
  // Defines the mapped functions to handle the subscription event.
  ubiSubTopic[VAR_SUB_1] = &subscriptionHandler1;
  ubiSubTopic[VAR_SUB_2] = &subscriptionHandler2;
  client.ubidotsSetBroker("industrial.api.ubidots.com"); // Sets the broker properly for the
                                                         // business account.
  client.setDebug(true);                                 // Pass a true or false bool value to activate debug messages.
  client.wifiConnection(WIFINAME, WIFIPASS);             // Establish WiFi connection.
  client.begin(callback);
  dht.begin();    // Initializes DHT sensor.
  pixels.begin(); // Initializes NeoPixel Ring.
  pixels.clear(); // Set all pixel colors to 'off'.
  // Establishes subscription with variables defined.
  client.ubidotsSubscribe(DEVICE, VAR_SUB_1);
  client.ubidotsSubscribe(DEVICE, VAR_SUB_2);
}

void loop()
{
  // Re-establishes subscription with variables defined when connection is lost or every 3 minutes.
  if (!client.connected() || abs(millis() - initTime) > SECONDS_TO_RECONNECT)
  {
    initTime = millis();
    client.reconnect();
    client.ubidotsSubscribe(DEVICE, VAR_SUB_1);
    client.ubidotsSubscribe(DEVICE, VAR_SUB_2);
  }

  client.reconnect();

  // Reading temperature, humidity and soil moisture values.a
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  int soilMoisture = analogRead(MOISTUREPIN);
  // Compute heat index in Celsius (isFahreheit = false).
  float heatIndexC = dht.computeHeatIndex(temperature, humidity, false);

  // Check if any reads failed and exit early (to try again).
  if (isnan(humidity) || isnan(temperature))
  {
    Serial.println(F("Failed to read from DHT sensor!"));
  }

  // Controls NeoPixel's colors based on the temperature values.
  if (bottomLight)
  {
    if (inRange(temperature, 0, 16))
      colorWipe(blue, 50);
    if (inRange(temperature, 16, 21))
      colorWipe(green, 50);
    if (inRange(temperature, 21, 26))
      colorWipe(yellow, 50);
    if (inRange(temperature, 26, 40))
      colorWipe(red, 50);
  }

  // Adds variables to be published to Ubidots.
  client.add(VAR_PUB_1, temperature);
  client.add(VAR_PUB_2, humidity);
  client.add(VAR_PUB_3, soilMoisture);
  client.add(VAR_PUB_4, heatIndexC);

  // Publishes all variables added into the device defined.
  client.ubidotsPublish(DEVICE);
  client.loop();

  delay(1000);
}

/****************************************
 * Subscription Functions
 ****************************************/

// Function to be executed when var_sub_1 change its status.
void subscriptionHandler1()
{
  if (value == 1)
  {
    Serial.println("Planter Lamp turned ON.");
    digitalWrite(LIGHTPIN, HIGH);
  }
  else
  {
    Serial.println("Planter Lamp turned OFF.");
    digitalWrite(LIGHTPIN, LOW);
  }
};

// Function to be executed when var_sub_2 change its status.
void subscriptionHandler2()
{
  if (value != lastValue)
  {
    if (value == 1)
    {
      Serial.println("Planter bottom light turned ON.");
      for (int i = 0; i < 3; i++)
      {
        colorWipe(red, 50);
        colorWipe(green, 50);
        colorWipe(blue, 50);
      };
      colorWipe(white, 200);
      bottomLight = true;
    }
    else
    {
      Serial.println("Planter bottom light turned OFF.");
      colorWipe(white, 50);
      colorWipe(black, 200);
      bottomLight = false;
    }
  }
  lastValue = value;
};

/****************************************
 * Auxiliar Functions
 ****************************************/
// Return an int with the length of a char
int strLen(char *s)
{
  int l = 0;
  while (*s != '\0')
  {
    s++;
    l++;
  }
  return (l);
}

// Callback to handle subscription
void callback(char *topic, byte *payload, unsigned int length)
{
  char *variableLabel = (char *)malloc(sizeof(char) * 30);
  getVariableLabelTopic(topic, variableLabel); // Saves the variable label.
  value = btof(payload, length);               // Saves the value of the variable subscribed.
  executeCases(variableLabel);                 // Executes the function handler for the
                                               // variable subscribed.
  free(variableLabel);                         // Free memory.
}

// Parse the topic received to extract the variable label.
void getVariableLabelTopic(char *topic, char *variableLabel)
{
  sprintf(variableLabel, "");
  for (int i = 0; i < numberOfVariables; i++)
  {
    char *resultLv = strstr(topic, variableLabels[i]);
    if (resultLv != NULL)
    {
      uint8_t len = strlen(resultLv);
      char result[100];
      uint8_t i = 0;
      for (i = 0; i < len - 3; i++)
      {
        result[i] = resultLv[i];
      }
      result[i] = '\0';
      snprintf(variableLabel, strLen(result) + 1, "%s", result);
      break;
    }
  }
}

// Cast from an array of chars to float value.
float btof(byte *payload, unsigned int length)
{
  char *demo_ = (char *)malloc(sizeof(char) * 10);
  for (int i = 0; i < length; i++)
  {
    demo_[i] = payload[i];
  }
  return atof(demo_);
}

// Executes the respective "Subscription Function" based on the value received.
void executeCases(char *variableLabel)
{
  if (ubiSubTopic.find(variableLabel) != ubiSubTopic.end())
  {
    mapTopicSubscription::iterator i = ubiSubTopic.find(variableLabel);
    (i->second)();
  }
}

// Fills NeoPixel ring pixels one after another with color.
void colorWipe(NeoPixelColor color, int wait)
{
  int r, g, b;

  r = myColors[color][0];
  g = myColors[color][1];
  b = myColors[color][2];

  for (int i = 0; i < pixels.numPixels(); i++)
  {
    pixels.setPixelColor(i, r, g, b);
    pixels.show();
    delay(wait);
  }
}

// Verifies if the value received is in the expected range
bool inRange(float x, int low, int high)
{
  return ((x - low) > 0 && (high - x) >= 0);
}
