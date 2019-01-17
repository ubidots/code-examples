/*
 * This code receives and decodes data coming from a callback in the Sigfox Backend,
 * where the data is an "uplink only frame" provided by a Sens'it device v2.1, working
 * on "Temperature & Humidity" or "Light" mode. With the data properly decoded, an HTTP
 * POST request is sent to Ubidots API, containing the data.
 *
 * IMPORTANT NOTE: This code was designed to run into UbiFunctions add-on from Ubidots.
 *
 * To use this code properly, please refer to the Ubidots integration guide "Connect a
 * Sens'it to Ubidots using Sigfox over HTTP".
 *
 * This guide can be found in the Ubidots Help Center:
 * https://help.ubidots.com/
 *
 *
 * Copyright (c) 2013-2019 Ubidots.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Global variables ---------------------------------------------------
const request = require('request-promise');
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Functions to extract the variables of each byte according to the mode

// Byte 1 -----------------------------------------------
/**
 * This function extracts the variables from byte 1.
 * Does not depend on the mode.
 * @param {String} byte1 Byte 1 from variable "data" (8 bits)
 * @returns {Array} Variables from byte 1 (in bits)
 */
function byte1VE(byte1) {
  const batteryMsb = byte1[0];
  const frameType = byte1.slice(1, 3);
  const uplinkPeriod = byte1.slice(3, 5);
  const mode = byte1.slice(5, 8);
  return [batteryMsb, frameType, uplinkPeriod, mode];
}
//-------------------------------------------------------

// Byte 2 -----------------------------------------------
/**
 * This function extracts the variables from byte 2.
 * Does not depend on the mode.
 * @param {String} byte2 Byte 2 from variable "data" (8 bits)
 * @returns {Array} Variables from byte 2 (in bits)
 */
function byte2VE(byte2) {
  const temperatureMsb = byte2.slice(0, 4);
  const batteryLsb = byte2.slice(4, 8);
  return [temperatureMsb, batteryLsb];
}
//-------------------------------------------------------

// Byte 3 -----------------------------------------------
/**
 * This function extracts the variables from byte 3.
 * Does depend on the mode.
 * If mode = "001", it calls byte3Case1 function.
 * If mode = "010", it calls byte3Case2 function.
 * @param {String} byte3 Byte 3 from variable "data" (8 bits)
 * @param {String} mode Working mode of sens'it device
 * @returns {String} Function to be called
 */
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

// Byte 4 -----------------------------------------------
/**
 * This function extracts the variables from byte 4.
 * Does depend on the mode.
 * If mode = "001", it calls byte4Case1 function.
 * If mode = "010", it calls byte4Case2 function.
 * @param {String} byte4 Byte 4 from variable "data" (8 bits)
 * @param {String} mode Working mode of sens'it device
 * @returns {String} Function to be called
 */
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
/**
* This function returns the arguments to be decoded according to the mode
* @param {String} varsToExtract Contains all the possible variables.
* @param {String} mode Working mode of the sens'it device.
* @returns {Array} Variables to be extracted according to the mode.
*/
function modeDecoding(varsToExtract, mode) {
  const modeVars = MODE_FUNCTIONS[mode].vars; // Variables according to the mode
  const argum = []; // Arguments to be sent
  let i;
  let varLabel;

  for (i = 0; i < modeVars.length; i += 1) {
    varLabel = modeVars[i];
    argum[i] = varsToExtract[varLabel];
  }

  return (argum);
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Functions to get variables' final values

// Battery voltage --------------------------------------
/**
 * This function receives the battery variables in bits
 * and obtains the battery value in Volts.
 * @param {String} batteryMsb Most Significant Bits
 * @param {String} batteryLsb Less Significant Bits
 * @returns {Number} Battery value in Volts
 */
function batteryVoltage(batteryMsb, batteryLsb) {
  let batteryLevel = `${batteryMsb}${batteryLsb}`;
  batteryLevel = parseInt(batteryLevel, 2);
  batteryLevel = (batteryLevel * 0.05) + 2.7; // Volts
  return (batteryLevel);
}
//-------------------------------------------------------

// Temperature & Humidity mode - data decoding ----------
/**
 * This function receives the Temperature and Humidity
 * variables in bits and obtains the Temperature and
 * Humidity value.
 * @param {Array} varsToExtract Expected input: [temperatureMsb, temperatureLsb, humidity]
 * @returns {Object} Temperature and Humidity values
 */
function modeTemperature(varsToExtract) {
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
/**
 * This function receives the Light variables in bits and
 * obtains the Light value.
 * If lightMask = "00", it calls lightCase0 function.
 * If lightMask = "01", it calls lightCase1 function.
 * If lightMask = "10", it calls lightCase2 function.
 * If lightMask = "11", it calls lightCase3 function.
 *
 * Please remember that the used formulas have been taken
 * from the Sens'it documentation:
 * https://build.sigfox.com/sensit-for-developers
 *
 * @param {Array} varsToExtract Expected input: ['lightMask', 'lightValue', 'alertCounter']
 * @returns {Object} Light value
 */
function modeLight(varsToExtract) {
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
/**
 * This function parse and decode the data coming from the Sigfox Backend.
 * @param {Object} data "Data" property of "args" object. Args are the incoming data.
 * @returns {Object} Decoded data to be sent to Ubidots API.
 */
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
    temperatureMsb, // Temperature & Humidity mode variable
    temperatureLsb, // Temperature & Humidity mode variable
    humidity, // Temperature & Humidity mode variable
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
/**
 * Function to build an HTTP POST request to Ubidots
 * @param {String} token Your Ubidots Token
 * @param {String} label Variable-s name
 * @param {Object} payload Data to be upload
 */
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
