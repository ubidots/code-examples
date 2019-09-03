/*

RGB Smart Planter integrated with Ubidots for Monitoring & Control. 

This code is in charge of:

    1) Reads two sensors: DHT11, and Soil Moisture
    2) Publish the sensors readings to Ubidots
    3) Subscribes to multiple variables for Remote control of the lights.

Libraries required:

- Ubidots ESP8266 MQTT - (https://github.com/ubidots/ubidots-mqtt-esp)
- Adafruit NeoPixel - (https://github.com/adafruit/Adafruit_NeoPixel)
- DHT - (https://github.com/adafruit/DHT-sensor-library)

Made by: Maria Hernández - IoT Developer Advocate @ Ubidots
Revision: José Garcia - Development & Support Managemet @ Ubidots

*/
/****************************************
 * Include Libraries
 ****************************************/
#include "UbidotsESPMQTT.h"
#include <Adafruit_NeoPixel.h>
#include "DHT.h"
#include <map>

/****************************************
 * Define Pins
 ****************************************/
#define LIGHTPIN D1 // Digital pin connected to the Led Lamp
#define DHTPIN D5     // Digital pin connected to the DHT sensor
#define NEOPIXELSPIN D6 // Digital pin connected to the NeoPixel Ring
#define MOISTUREPIN A0 // Analog pin connected to the Moisture Sensor

/****************************************
 * Define Constants
 ****************************************/
#define TOKEN "BBFF-xxxxxxxxxxxxxxxxxxxxxxx" // Assign your Ubidots TOKEN
#define WIFINAME "xxxxxxxxxxxxx" // Assign your SSID
#define WIFIPASS "xxxxxxxxxxxxx" // Your Wifi Pass
#define DEVICE "planter" // Ubidots Device Label
#define VAR_PUB_1 "temperature" // Ubidots Variables label to publish data
#define VAR_PUB_2 "humidity"
#define VAR_PUB_3 "soil-moisture"
#define VAR_PUB_4 "heat-index"
#define VAR_SUB_1 "light-1" // Ubidots Variables label to publish data ; These variables have to be created at Ubidots.
#define VAR_SUB_2 "light-2" 
#define NUMPIXELS 12 // 12 bit NeoPixel Ring
// Uncomment whatever type you're using!
#define DHTTYPE DHT11   // DHT 11
//#define DHTTYPE DHT22   // DHT 22  (AM2302), AM2321
//#define DHTTYPE DHT21   // DHT 21 (AM2301)
                       //   R,   G,   B
uint8_t myColors[][6] = {{250,   0,   0},   // Red
                         {  0, 255,   0},   // Green 
                         {  0,   0, 255},   // Blue
                         {255, 255,   0},   // Yellow
                         {255, 255, 255},   // White                         
                         {  0,   0,  0}};  // OFF
const uint8_t NUMBER_OF_VARIABLES = 2; // Number of variables for subscription
char * variable_labels[NUMBER_OF_VARIABLES] = {VAR_SUB_1, VAR_SUB_2}; // Variable Labels for subscription
const int ERROR_VALUE = 65535;  // Set here an error value
float value; // To store incoming value
bool bottom_light; // flag to control conditions for the bottom light. 

// Comparison functor to map functions
struct cmp_str {
  bool operator()(char const *a, char const *b) const {
    return strcmp(a, b) < 0;
    }
};

// Map function declaration
typedef std::function<void()> FunctionType;
typedef std::map<const char*, FunctionType, cmp_str> map_topic_subscription;

/****************************************
 * Define Instances
 ****************************************/
Ubidots client(TOKEN);
Adafruit_NeoPixel pixels(NUMPIXELS, NEOPIXELSPIN, NEO_GRB + NEO_KHZ800);
DHT dht(DHTPIN, DHTTYPE);
map_topic_subscription ubi_sub_topic;


/****************************************
 * Main Functions
 ****************************************/
void setup() {
  Serial.begin(115200);
  // Defines the mapped functions to handle the subscription event
  ubi_sub_topic[VAR_SUB_1] = &subscription_handler_1;
  ubi_sub_topic[VAR_SUB_2] = &subscription_handler_2;
  client.ubidotsSetBroker("industrial.api.ubidots.com"); // Sets the broker properly for the business account
  client.setDebug(true); // Pass a true or false bool value to activate debug messages
  client.wifiConnection(WIFINAME, WIFIPASS); // Establish WiFi connection
  client.begin(callback);
  dht.begin(); // Initializes DHT sensor
  pixels.begin(); // Initializes NeoPixel Ring
  pixels.clear(); // Set all pixel colors to 'off'
  // Establishes subscription with variables defined
  client.ubidotsSubscribe(DEVICE, VAR_SUB_1);
  client.ubidotsSubscribe(DEVICE, VAR_SUB_2);
}

void loop() {
  if(!client.connected()){
      // Re-establishes subscription with variables defined when connection is lost
      client.reconnect();
      client.ubidotsSubscribe(DEVICE, VAR_SUB_1);
      client.ubidotsSubscribe(DEVICE, VAR_SUB_2);
  }
  
  // Wait a few seconds between measurements.
  delay(1000);

  // Reading temperature, humidity and soil moisture values
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  int soil_moisture = analogRead(MOISTUREPIN);
  // Compute heat index in Celsius (isFahreheit = false)
  float heat_index_c = dht.computeHeatIndex(temperature, humidity, false);
  
  // Check if any reads failed and exit early (to try again).
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    return;
  }  

  // Control NeoPixel based on the temperature values
  if (bottom_light) {
    if (temperature <= 16){
      colorWipe("blue", 50);
    } 
    
    else if ((temperature > 16) && (temperature <= 21)){
      colorWipe("green", 50);
    } 
    
    else if ((temperature > 21) && (temperature <= 26)){
      colorWipe("yellow", 50);
    } 
    
    else  if (temperature > 26){
      colorWipe("red", 50);
    }  
  }

  // Adds the variables to be published to Ubidots
  client.add(VAR_PUB_1, temperature);
  client.add(VAR_PUB_2, humidity);
  client.add(VAR_PUB_3, soil_moisture);
  client.add(VAR_PUB_4, heat_index_c);
  
  //Publishs the variable into the device defined
  client.ubidotsPublish(DEVICE);
  client.loop();
}

/****************************************
 * Subscription Functions
 ****************************************/

// Function to be executed when var_sub_1 is received.  
void subscription_handler_1() {
  pinMode(LIGHTPIN, OUTPUT);
  if (value == 1) {
    Serial.println("Planter Lamp turned ON.");
    digitalWrite(LIGHTPIN, HIGH);  
  } else {
    Serial.println("Planter Lamp turned OFF.");
    digitalWrite(LIGHTPIN, LOW);
  }
};

// Function to be executed when var_sub_2 is received.
void subscription_handler_2() {
  if (value == 1) {
    Serial.println("Planter bottom light turned ON.");
    for (int i=0; i < 3; i++) {
      // Fill along the length of the strip in various colors...
      colorWipe("red", 50);
      colorWipe("green", 50);
      colorWipe("blue", 50);
    };
    colorWipe("white", 200);
    bottom_light = true;
  } else {
    Serial.println("Planter bottom light turned OFF.");
    colorWipe("white", 50);
    colorWipe("off", 200);
    bottom_light = false;
  }
};

/****************************************
 * Auxiliar Functions
 ****************************************/

// Callback to handle subscription
void callback(char* topic, byte* payload, unsigned int length) {
  char* variable_label = (char *) malloc(sizeof(char) * 30);
  get_variable_label_topic(topic, variable_label); // Saves the variable label
  value = btof(payload, length); // Saves the value of the variable subscribed
  execute_cases(variable_label); // Executes the function handler for the variable subscribed
  free(variable_label); // Free memory
}

// Parse topic to extract the variable label which changed value
void get_variable_label_topic(char * topic, char * variable_label) {
  sprintf(variable_label, "");
  for (int i = 0; i < NUMBER_OF_VARIABLES; i++) {
    char * result_lv = strstr(topic, variable_labels[i]);
    if (result_lv != NULL) {
      uint8_t len = strlen(result_lv);      
      char result[100];
      uint8_t i = 0;
      for (i = 0; i < len - 3; i++) { 
        result[i] = result_lv[i];
      }
      result[i] = '\0';
      sprintf(variable_label, "%s", result);
      break;
    }
  }
}

// cast from an array of chars to float value
float btof(byte * payload, unsigned int length) {
  char * demo_ = (char *) malloc(sizeof(char) * 10);
  for (int i = 0; i < length; i++) {
    demo_[i] = payload[i];
  }
  return atof(demo_);
}

// Function to determine which variable changed and assigned the value accordingly to the code variable
void execute_cases(char* variable_label) {  
  if ( ubi_sub_topic.find(variable_label) != ubi_sub_topic.end()) {
    map_topic_subscription::iterator i = ubi_sub_topic.find(variable_label);
    (i->second)(); 
  }
}

// Fills NeoPixel ring pixels one after another with a color. 
void colorWipe(char* color, int wait) {
  int counter = 0;
  int red, green, blue;
  char *colors[] = {"red", "green", "blue", "yellow", "white", "off"};

  for (int i = 0; i <= sizeof(colors) - 1; i++) {
    if (color == colors[i]) {
       red = myColors[counter][0];
       green = myColors[counter][1];
       blue = myColors[counter][2];    
    }
    counter++;
  };
    
  for(int i=0; i<pixels.numPixels(); i++) { // For each pixel in strip...
    pixels.setPixelColor(i, red, green, blue);
    pixels.show();
    delay(wait);
  }
}