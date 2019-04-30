/****************************************
   Include Libraries
 ****************************************/

#include "UbidotsESPMQTT.h"
#include <Servo.h>
/****************************************
   Define Constants
 ****************************************/
#define TOKEN "..........................." // Your Ubidots TOKEN
#define WIFINAME "........." //Your SSID
#define WIFIPASS "........." // Your Wifi Pass
#define DEVICE_LABEL  "motor"  // Put here your Ubidots device label
#define VARIABLE  "speed"  // Put here your Ubidots variable label
#define MotorPin D5 //NodeMCU pin where the signal for the ESC comes out
Servo ESC;
float value=0; // To store incoming value.
float MotorSpeed=0;

Ubidots client(TOKEN);

/****************************************
   Auxiliar Functions
 ****************************************/
 
// cast from an array of chars to float value.
float btof(byte * payload, unsigned int length) {
  char * demo = (char *) malloc(sizeof(char) * 10);
  for (int i = 0; i < length; i++) {
    demo[i] = payload[i];
  }
  float value = atof(demo);
  free(demo);
  return value;
}

// Callback to handle subscription

void callback(char* topic, byte* payload, unsigned int length) {
  value = btof(payload, length);
  value = map(value, 0, 100, 0, 180); //Map the 0-100 values from the slider to the 0-180 to use the servo lib.
  ESC.write(value); //Send the value (PWM) to the ESC
  Serial.println(value);
  Serial.println(MotorSpeed);
   
}

/****************************************
   Main Functions
 ****************************************/

void setup() {
  // put your setup code here, to run once:
  client.ubidotsSetBroker("industrial.api.ubidots.com"); // Sets the broker properly for the business account
  client.setDebug(true); // Pass a true or false bool value to activate debug messages
  Serial.begin(115200);
  client.wifiConnection(WIFINAME, WIFIPASS);
  client.begin(callback);
  client.ubidotsSubscribe(DEVICE_LABEL, VARIABLE); //Insert the dataSource and Variable's Labels
  ESC.attach(MotorPin,1000,2000);
}

void loop() {
  // put your main code here, to run repeatedly:
  if (!client.connected()) {
    client.reconnect();
    client.ubidotsSubscribe(DEVICE_LABEL, VARIABLE); //Insert the dataSource and Variable's Labels 
  }
  client.loop();
}
