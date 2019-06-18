
/****************************************

 * Libraries

 ****************************************/

#include "UbidotsESPMQTT.h"


/****************************************

 * Define constants
 
 ****************************************/

#define TOKEN "............................" // Your Ubidots TOKEN

#define WIFINAME ".........." //Your SSID

#define WIFIPASS ".........." // Your Wifi Pass

#define DEVICE_LABEL "wifiswitch"   // Name of the device

#define VARIABLE_LABEL1  "light"  // Name of the Ubidots variable

const int ERROR_VALUE = 65535;  // Error value 

const uint8_t NUMBER_OF_VARIABLES = 2; // Cantidad de variables a las que el programa se va a suscribir
char * variable_labels[NUMBER_OF_VARIABLES] = {"light"}; // Variables names


#define luz  0
#define boton  2

int seguro=0;

int ledState = LOW;         // the current state of the output pin
int buttonState;             // the current reading from the input pin
int lastButtonState = HIGH;   // the previous reading from the input pin
int reading;
unsigned long lastDebounceTime = 0;  // the last time the output pin was toggled
unsigned long debounceDelay = 50; 

float estadoluz; // Variable to be used in the code

float value; // Variable to store input data
uint8_t variable; // To use with the switch case

Ubidots ubiClient(TOKEN);

WiFiClient client;

/****************************************

 * Auxiliar functions

 ****************************************/

void callback(char* topic, byte* payload, unsigned int length) {
  char* variable_label = (char *) malloc(sizeof(char) * 30);
  get_variable_label_topic(topic, variable_label);
  value = btof(payload, length);
  set_state(variable_label);
  execute_cases();
  free(variable_label);
  /////////////////Light////////////////////

  digitalWrite(luz, estadoluz);
 
  /////////////////Light////////////////////
  
}

// Parse topic to extract the variable label which changed value
void get_variable_label_topic(char * topic, char * variable_label) {
  Serial.print("topic:");
  Serial.println(topic);
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
      Serial.print("Label is: ");
      Serial.println(result);
      sprintf(variable_label, "%s", result);
      break;
    }
  }
}

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

// State machine to use switch case
void set_state(char* variable_label) {
  variable = 0;
  for (uint8_t i = 0; i < NUMBER_OF_VARIABLES; i++) {
    if (strcmp(variable_label, variable_labels[i]) == 0) {
      break;
    }
    variable++;
  }
  if (variable >= NUMBER_OF_VARIABLES) variable = ERROR_VALUE; // Not valid
  
}

// Function with switch case to determine which variable changed and assigned the value accordingly to the code variable
void execute_cases() {  
  switch (variable) {
    case 0:
      estadoluz = value;
      Serial.print("Luz: ");
      Serial.println(estadoluz);
      Serial.println();
      break;
    case ERROR_VALUE:
      Serial.println("error");
      Serial.println();
      break;
    default:
      Serial.println("default");
      Serial.println();
  }

}
/****************************************

 * Funcion principal

 ****************************************/

void setup() {

  // put your setup code here, to run once:
  pinMode(luz, OUTPUT);  
  pinMode(boton, INPUT); 
  ubiClient.ubidotsSetBroker("industrial.api.ubidots.com"); // Sets the broker properly for the business account
  ubiClient.setDebug(true); // Pass a true or false bool value to activate debug messages
  Serial.begin(115200);
  ubiClient.wifiConnection(WIFINAME, WIFIPASS);
  ubiClient.begin(callback);
  if(!ubiClient.connected()){
    ubiClient.reconnect();
  }

  char* deviceStatus = getUbidotsDevice(DEVICE_LABEL);

  if (strcmp(deviceStatus, "404") == 0) {
    ubiClient.add("light", 0); //Insert your variable Labels and the value to be sent
    ubiClient.ubidotsPublish(DEVICE_LABEL);
    ubiClient.loop();
  }

  ubiClient.ubidotsSubscribe(DEVICE_LABEL,VARIABLE_LABEL1); //Insert the Device and Variable's Labels
  Serial.println(variable_labels[1]);

}

void loop() {
  // put your main code here, to run repeatedly:
  if(!ubiClient.connected()){
    ubiClient.reconnect();
    ubiClient.ubidotsSubscribe(DEVICE_LABEL,VARIABLE_LABEL1); //Insert the Device and Variable's Labels
  }
  ubiClient.loop();    
  
  Read();

  Debounce();

  // save the reading. Next time through the loop, it'll be the lastButtonState:
  lastButtonState = reading;
          
}

void Read(){
  // read the state of the switch into a local variable:
  reading = digitalRead(boton);
  if (reading != lastButtonState) {
    // reset the debouncing timer
    lastDebounceTime = millis();
  }
}

void Debounce(){
  if ((millis() - lastDebounceTime) > debounceDelay) {
    // whatever the reading is at, it's been there for longer than the debounce
    // delay, so take it as the actual current state:

    // if the button state has changed:
    if (reading != buttonState) {
      buttonState = reading;
      Toggle();
      
    }
  }
}

void Toggle(){
  // only toggle the LED if the new button state is LOW
  if (buttonState == LOW) {
    ledState = !ledState;
    // set the LED:
    digitalWrite(luz, ledState);
    ubiClient.add("light", ledState); //Insert your variable Labels and the value to be sent
    ubiClient.ubidotsPublish(DEVICE_LABEL);
  }  
}

char* getUbidotsDevice(char* deviceLabel) {
  char* data = (char *) malloc(sizeof(char) * 700);
  char* response = (char *) malloc(sizeof(char) * 400);
  sprintf(data, "GET /api/v1.6/devices/%s/", deviceLabel);
  sprintf(data, "%s HTTP/1.1\r\n", data);
  sprintf(data, "%sHost: industrial.api.ubidots.com\r\nUser-Agent:wifiswitch/1.0\r\n", data);
  sprintf(data, "%sX-Auth-Token: %s\r\nConnection: close\r\n\r\n", data, TOKEN);
  char* data1 = data;
  free(data);
 
  if (client.connect("industrial.api.ubidots.com", 80)) {
    client.println(data1);
  } 
  else {
    free(data);
    return "e";
  }
  int timeout = 0;
  while(!client.available() && timeout < 5000) {
    timeout++;
    if (timeout >= 4999){
      free(data);
      return "e";
    }
    delay(1);
    }

  int i = 0;
  while (client.available()) {
    response[i++] = (char)client.read();
    if (i >= 399){
      break;
    }
  }
  char * pch;
  char * statusCode;
  int j = 0;
  pch = strtok (response, " ");
  while (pch != NULL) {
    if (j == 1 ) {
      statusCode = pch;
    }

    pch = strtok (NULL, " ");
    j++;
  }
  free(response);
  return statusCode;

}
