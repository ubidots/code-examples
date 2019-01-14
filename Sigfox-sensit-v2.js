/*
 * This code receives and decodes data coming from a callback in the Sigfox Backend,
 * where the data is an "uplink only frame" provided by a Sens'it device v2.1, working
 * on "Temperature & Humidity" or "Light" mode. With the data properly decoded, an HTTP
 * POST request is sent to Ubidots API, containing the data.
 *
 * IMPORTANT NOTE: This code was designed to run into UbiFunctions add-on from Ubidots.
 *
 * To use this code properly, please refer to this official Ubidots guide:
 * >>>>>>>>>>>>> GUIDE LINK <<<<<<<<<<<<<<<<<<<
 */

// Global variables ---------------------------------------------------
const request = require('request-promise');
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Functions for variables extraction

// Returns the arguments to be decoded according the mode
function modeDecoding(varsToExtract, mode) {
  const modeVars = MODE_FUNCTIONS[mode].vars; // Variables according the mode
  const argum = []; // Arguments to be sent
  let i;
  let varLabel;

  for (i = 0; i < modeVars.length; i += 1) {
    varLabel = modeVars[i];
    argum[i] = varsToExtract[varLabel];
  }

  return (argum);
}
//-------------------------------------------------------

// Byte 1 - variables extraction ------------------------
// This byte is the same for all the modes
function byte1VE(byte1) {
  const batteryMsb = byte1[0];
  const frameType = byte1.slice(1, 3);
  const uplinkPeriod = byte1.slice(3, 5);
  const mode = byte1.slice(5, 8);
  return [batteryMsb, frameType, uplinkPeriod, mode];
}
//-------------------------------------------------------

// Byte 2 - variables extraction ------------------------
// This byte is the same for all the modes
function byte2VE(byte2) {
  const temperatureMsb = byte2.slice(0, 4);
  const batteryLsb = byte2.slice(4, 8);
  return [temperatureMsb, batteryLsb];
}
//-------------------------------------------------------

// Byte 3 - variables extraction ------------------------

// This byte depends on the mode
function byte3VE(byte3, mode) {
  return BYTE3_FUNCTIONS[mode](byte3);
}

// Byte 3: Case for Temperature & Humidity mode
function byte3Case1(byte3) {
  const temperatureLsb = byte3.slice(2, 8);
  return { temperatureLsb };
}

// Byte 3: Case for Light mode
function byte3Case2(byte3) {
  const lightMask = byte3.slice(0, 2);
  const lightValue = byte3.slice(2, 8);
  return { lightMask, lightValue };
}
//-------------------------------------------------------

// Byte 4 - variables extraction ------------------------

// This byte depends on the mode
function byte4VE(byte4, mode) {
  return BYTE4_FUNCTIONS[mode](byte4);
}

// Byte 4: Case for Temperature & Humidity mode
function byte4Case1(byte4) {
  const humidity = byte4;
  return { humidity };
}

// Byte 4: Case for Light mode
function byte4Case2(byte4) {
  const alertCounter = byte4; // Number of events that happened
  return { alertCounter };
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Functions to get variables' final values

// Battery voltage --------------------------------------
function batteryVoltage(batteryMsb, batteryLsb) {
  let batteryLevel = `${batteryMsb}${batteryLsb}`;
  batteryLevel = parseInt(batteryLevel, 2);
  batteryLevel = (batteryLevel * 0.05) + 2.7; // Volts
  return (batteryLevel);
}
//-------------------------------------------------------

// Temperature & Humidity mode - data decoding ----------
function modeTemperature(varsToExtract) {
  // Expected input: [temperatureMsb, temperatureLsb, humidity]
  const temperatureMsb = varsToExtract[0];
  const temperatureLsb = varsToExtract[1];
  const humidity = varsToExtract[2];
  let fTemperature; // Final temperature value
  let fHumidity; // Final humidity value

  fTemperature = `${temperatureMsb}${temperatureLsb}`; // 10 bits
  fTemperature = parseInt(fTemperature, 2);
  fTemperature = ((fTemperature - 200) / 8); // °C

  fHumidity = parseInt(humidity, 2);
  fHumidity /= 2; // %

  const decodedOutput = {
    temperature: fTemperature,
    humidity: fHumidity,
  };
  return (decodedOutput);
}
//-------------------------------------------------------

// Light mode - data decoding ---------------------------
function modeLight(varsToExtract) {
  // Expected input: ['lightMask', 'lightValue', 'alertCounter']
  const lightMask = varsToExtract[0];
  const lightValue = varsToExtract[1];
  const fLightValue = LIGHT_VALUE[lightMask](lightValue);
  const decodedOutput = { light: fLightValue };
  return decodedOutput;
}

function lightCase0(lightValue) {
  const light = parseInt(lightValue, 2);
  const fLightValue = light / 96; // lux
  return fLightValue;
}

function lightCase1(lightValue) {
  const light = parseInt(lightValue, 2);
  const fLightValue = (light * 8) / 96; // lux
  return fLightValue;
}

function lightCase2(lightValue) {
  const light = parseInt(lightValue, 2);
  const fLightValue = (light * 64) / 96; // lux
  return fLightValue;
}

function lightCase3(lightValue) {
  const light = parseInt(lightValue, 2);
  const fLightValue = (light * 1024) / 96; // lux
  return fLightValue;
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Function to parse & decode the incoming data
function payloadDecode(data) {
  const buf = Buffer.from(data, 'hex'); // Buffer for data in hexa

  // Bytes extraction ensuring 8 bits ---------------------
  const byte1 = (buf[0].toString(2)).padStart(8, '0');
  const byte2 = (buf[1].toString(2)).padStart(8, '0');
  const byte3 = (buf[2].toString(2)).padStart(8, '0');
  const byte4 = (buf[3].toString(2)).padStart(8, '0');
  //-------------------------------------------------------

  // Variables extraction (VE) for each byte --------------
  const [batteryMsb, frameType, uplinkPeriod, mode] = byte1VE(byte1); // Byte 1
  const [temperatureMsb, batteryLsb] = byte2VE(byte2); // Byte 2
  const {
    temperatureLsb,
    lightMask,
    lightValue,
  } = byte3VE(byte3, mode); // Byte 3
  const {
    humidity,
    alertCounter,
  } = byte4VE(byte4, mode); // Byte 4
  //-------------------------------------------------------

  // All variables possibilities
  const varsToExtract = {
    mode, // General variable
    frameType, // General variable
    uplinkPeriod, // General variable
    batteryMsb, // General variable
    batteryLsb, // General variable
    temperatureMsb, // Temperature & Huidity mode variable
    temperatureLsb, // Temperature & Huidity mode variable
    humidity, // Temperature & Huidity mode variable
    lightMask, // Light mode variable
    lightValue, // Light mode variable
    alertCounter, // Light mode variable
  };

  // Get variables values ---------------------------------
  const argum = modeDecoding(varsToExtract, mode);
  const decodeOutput = MODE_FUNCTIONS[mode].fnc(argum);
  const battery = batteryVoltage(batteryMsb, batteryLsb);
  //-------------------------------------------------------

  decodeOutput.battery = battery; // Add battery value
  return (decodeOutput);
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Function to build an HTTP POST request to Ubidots
async function ubidotsRequest(token, label, payload) {
  const options = {
    method: 'POST',
    url: `https://industrial.ubidots.com/api/v1.6/devices/${label}`,
    body: payload,
    json: true,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
    },
  };
  return request.post(options);
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Miscellaneous
/* eslint-disable quote-props */
// Byte 3 variables extraction
const BYTE3_FUNCTIONS = {
  '001': byte3Case1, // Temperature & Humidity mode
  '010': byte3Case2, // Light mode
};
// Byte 4 variables extraction
const BYTE4_FUNCTIONS = {
  '001': byte4Case1, // Temperature & Humidity mode
  '010': byte4Case2, // Light mode
};
// Decoding on each mode
const MODE_FUNCTIONS = {
  '001': { 'fnc': modeTemperature, 'vars': ['temperatureMsb', 'temperatureLsb', 'humidity'] },
  '010': { 'fnc': modeLight, 'vars': ['lightMask', 'lightValue', 'alertCounter'] },
};
// Get light value
const LIGHT_VALUE = {
  '00': lightCase0,
  '01': lightCase1,
  '10': lightCase2,
  '11': lightCase3,
};
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Main function
async function main(args) {
  const {
    token,
    device,
    data,
    time,
  } = args;

  // Decode & parse the incoming data
  const decoded = await payloadDecode(data);

  // Send the payload to Ubidots
  const response = await ubidotsRequest(token, device, decoded);

  // Log Ubidots response to the console
  console.log(response);

  // Pass Ubidots' API response as the parser's reponse
  return { 'server-response': response, 'status-code': response.statusCode };
}
//---------------------------------------------------------------------
