/* Introduction here
.
.
.
.
 */
//---------------------------------------------------------------------

// Global variables declaration ---------------------------------------
const request = require('request-promise');
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// Functions for decoding variables information for each mode

// Returns the arguments to be decoded according the mode
function modeDecoding(varValues, mode) {
  console.log('Mode decoding function ---------');
  let i;
  let varLabel;
  const varMode = MODE_FUNCTIONS[mode].vars; // Variables according the mode
  const argum = []; // Arguments to be sended to "mode" function

  console.log(varMode);
  console.log(varMode.length);

  for (i = 0; i < varMode.length; i += 1) {
    varLabel = varMode[i];
    argum[i] = varValues[varLabel];
  }

  console.log(argum);
  console.log('End mode decoding function ---------');
  return (argum);
}
//---------------------------------------------------------------------

// Battery voltaje ----------------------------------------------------
function battery (batteryMsb, batteryLsb) {
  let batteryLevel = `${batteryMsb}${batteryLsb}`;
  batteryLevel = parseInt(batteryLevel, 2);
  batteryLevel = (batteryLevel * 0.05) + 2.7; // Volts
  return (batteryLevel);
}
//---------------------------------------------------------------------

// Byte 1 - variables extraction --------------------------------------
// This byte is the same for all the modes
function byte1VE(byte1) {
  console.log('Byte 1 VE ------------');

  const batteryMsb = byte1[0];
  const frameType = byte1.slice(1, 3);
  const uplinkPeriod = byte1.slice(3, 5);
  const mode = byte1.slice(5, 8);
  return [batteryMsb, frameType, uplinkPeriod, mode];
}
//---------------------------------------------------------------------

// Byte 2 - variables extraction --------------------------------------
// This byte is the same for all the modes
function byte2VE(byte2) {
  console.log('Byte 2 VE ------------');
  const temperatureMsb = byte2.slice(0, 4);
  const batteryLsb = byte2.slice(4, 8);
  return [temperatureMsb, batteryLsb];
}
//---------------------------------------------------------------------

// Byte 3 - variables extraction --------------------------------------

// This byte depends on the mode
function byte3VE(byte3, mode) {
  console.log('Byte 3 VE ------------');
  return BYTE3_FUNCTIONS[mode](byte3);
}

// Byte 3: Case for Temperature & Humidity, Magnet, Vibration or Button mode
function byte3Case1(byte3) {
  console.log('Byte 3: Case for Temperature & Humidity, Magnet, Vibration or Button mode');
  const magnetState = byte3[1];
  const temperatureLsb = byte3.slice(2, 8);
  return { magnetState, temperatureLsb };
}

// Byte 3: Case for Light mode
function byte3Case2(byte3) {
  console.log('Byte 3: Case for Light mode');
  const lightMask = byte3.slice(0, 2);
  const lightValue = byte3.slice(2, 8);
  return { lightMask, lightValue };
}

// Byte 3: Case for Door Opener mode
function byte3Case3(byte3) {
  console.log('Byte 3: Case for Door Opener mode');
  const maxMagnet = byte3;
  return { maxMagnet };
}
//---------------------------------------------------------------------

// Byte 4 - variables extraction --------------------------------------

// This byte depends on the mode
function byte4VE(byte4, mode) {
  console.log('Byte 4 VE ------------');
  return BYTE4_FUNCTIONS[mode](byte4);
}

// Byte 4: Case for Temperature mode
function byte4Case1(byte4) {
  console.log('Byte 4: Case for Temperature mode');
  const humidity = byte4;
  return { humidity };
}

// Byte 4: Case for Magnet, Door opener, Light and Vibration mode
function byte4Case2(byte4) {
  console.log('Byte 4: Case for Magnet, Door opener, Light and Vibration mode');
  const alertCounter = byte4; // Number of events that happened
  return { alertCounter };
}

// Byte 4: Case for Button mode
function byte4Case3(byte4) {
  console.log('Byte 4: Case for Button mode');
  const firmwareVMajor = byte4.slice(0, 4);
  const firmwareVMinor = byte4.slice(4, 8);
  return { firmwareVMajor, firmwareVMinor };
}
//---------------------------------------------------------------------

// Variable decoding functions for each mode --------------------------

// Only the temperature mode was implemented because missing information
// about other modes.

// Button mode - data decoding

/*
function mode_button (varValues)
{
    var firmwareVMajor = varValues[13];
    var firmwareVMinor = varValues[14];
} */

// Temperature mode - data decoding
function modeTemperature(varValues) {
  console.log('Decoding temperature ----------------------');

  // Expected input: [temperatureMsb, temperatureLsb, humidity]
  let fTemperature;
  let fHumidity; // Final variables

  const temperatureMsb = varValues[0];
  const temperatureLsb = varValues[1];
  const humidity = varValues[2];

  /*
    console.log ("temperatureMsb: ", temperatureMsb);
    console.log ("temperatureLsb: ", temperatureLsb);
    console.log ("humidity: ", humidity);
    */

  fTemperature = `${temperatureMsb}${temperatureLsb}`;
  console.log(fTemperature);
  fTemperature = parseInt(fTemperature, 2);
  console.log(fTemperature);
  fTemperature = ((fTemperature - 200) / 8); // °C
  console.log(fTemperature);

  console.log('Decoding humidity -----------');
  console.log(humidity);
  fHumidity = parseInt(humidity, 2);
  console.log(fHumidity);
  fHumidity /= 2; // Percentage
  console.log(fHumidity);

  const decodeOutput = {
    temperature: fTemperature,
    humidity: fHumidity,
  };

  console.log('End decoding temperature -------------------');
  return (decodeOutput);
}

// Light mode - data decoding
/*
function mode_light (varValues)
{
    lightMask = varValues[8];
    f_light_value = varValues[9];

    console.log(lightMask);
    console.log(f_light_value);

    switch (lightMask)
    {
        case "00":
        {
            lightValue
        }
    }


} */

// Door opener mode - data decoding
/*
function mode_light (varValues)
{

} */

// Vibration mode - data decoding
/*
function mode_light (varValues)
{

} */

// Magnet mode - data decoding
/*
function mode_light(varValues) {

} */
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// This function Parse & Decode the incoming by the Sigfox backend
function payloadDecode(data) {
  // Variables declaration ----------------------

  const buf = Buffer.from(data, 'hex'); // Buffer for data in hexa

  //---------------------------------------------
  console.log('Received data: ', buf);

  // Bytes extraction ensuring 8 bits -----------
  const byte1 = (buf[0].toString(2)).padStart(8, '0');
  const byte2 = (buf[1].toString(2)).padStart(8, '0');
  const byte3 = (buf[2].toString(2)).padStart(8, '0');
  const byte4 = (buf[3].toString(2)).padStart(8, '0');
  //---------------------------------------------

  // Variables extraction (ve) for each byte ----
  // Byte 1
  const [batteryMsb, frameType, uplinkPeriod, mode] = byte1VE(byte1);
  // Byte 2
  const [temperatureMsb, batteryLsb] = byte2VE(byte2);
  // Byte 3
  const {
    magnetState,
    temperatureLsb,
    lightMask,
    lightValue,
    maxMagnet,
  } = byte3VE(byte3, mode);

  // Byte 4
  const {
    humidity,
    alertCounter,
    firmwareVMajor,
    firmwareVMinor,
  } = byte4VE(byte4, mode);
  //---------------------------------------------

  // Total = 15 variables
  const varValues = {
    mode, // General variable
    frameType, // General variable
    uplinkPeriod, // General variable
    batteryMsb, // General variable
    batteryLsb, // General variable
    temperatureMsb, // Temperature mode variable
    temperatureLsb, // Temperature mode variable
    humidity, // Temperature mode variable
    lightMask, // Light mode variable
    lightValue, // Light mode variable
    magnetState, // Magnet mode variable
    maxMagnet, // Door opener mode variable
    alertCounter, // All modes except button and temperature
    firmwareVMajor, // Button mode
    firmwareVMinor, // Button mode
  };

  // Information decoding -----------------------
  const argum = modeDecoding(varValues, mode);
  const decodeOutput = MODE_FUNCTIONS[mode].fnc(argum);
  //---------------------------------------------
  console.log('Regresando a payloadDecode ---------');
  console.log(decodeOutput);
  // console.log(argum);

  return (decodeOutput);
}
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// This function builds an HTTP POST request to Ubidots
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
// Miscellaneous for byte 3 variables extraction
/* eslint-disable quote-props */
const BYTE3_FUNCTIONS = {
  '001': byte3Case1,
  '101': byte3Case1,
  '100': byte3Case1,
  '000': byte3Case1,
  '010': byte3Case2,
  '011': byte3Case3,
};
// Miscellaneous for byte 4 variables extraction
const BYTE4_FUNCTIONS = {
  '001': byte4Case1,
  '101': byte4Case2,
  '011': byte4Case2,
  '010': byte4Case2,
  '100': byte4Case2,
  '000': byte4Case3,
};
// Miscellaneous for decoding on each mode
const MODE_FUNCTIONS = {
  // "000": {"fnc": mode_button, "vars": variables},
  '001': { 'fnc': modeTemperature, 'vars': ['temperatureMsb', 'temperatureLsb', 'humidity'] },
  // "010": {"fnc": mode_light, "vars": variables},
  // "011": {"fnc": mode_door_opened, "vars": variables},
  // "100": {"fnc": mode_vibration, "vars": variables},
  // "101": {"fnc": mode_magnet, "vars": variables},
};
//---------------------------------------------------------------------

// Main function ------------------------------------------------------
async function main(args) {
  console.log('Original args: ---------------');
  console.log(args);

  const {
    token,
    device,
    data,
    time,
  } = args;

  console.log('Data:', args.data);

  // Decode & Parse the incoming data to build the payload based on the device mode
  const decoded = await payloadDecode(data);

  console.log('Decoded data: ----------------');
  console.log(decoded); // ---- Shows the decoded data

  // Send the payload to Ubidots
  const response = await ubidotsRequest(token, device, decoded);

  // Log Ubidots response to the console
  console.log(response);

  // Pass Ubidots' API response as the parser's reponse
  return { 'server-response': response, 'status-code': response.statusCode };
}
//---------------------------------------------------------------------
