//Library needed for making the request
var request = require('request-promise');

var AmbientWeatherAPI;
var UbidotsAPI;

// Ubidots Access Credentials 
var ubidotsToken;

// Weather Ambient Access Credentials
var deviceMAC;
var apiKey;
var applicationKey;

// This function build the HTTP GET request to Weather Ambient
async function weatherAmbientRequest() {
  var options = {
    url: `${AmbientWeatherAPI}${deviceMAC}?applicationKey=${applicationKey}&apiKey=${apiKey}`,
    json: true
  };
  return await request.get(options);
}

// This function build the HTTP POST request to Ubidots
async function ubidotsPostRequest(deviceLabel, data) {
  var options = {
    method: 'POST',
    url: `${UbidotsAPI}/devices/${deviceLabel}`,
    body: data,
    json: true,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': ubidotsToken
    }
  };
  return await request.post(options);
}

async function main(args) {

  ubidotsToken = args.ubiToken;
  deviceMAC = args.deviceMAC;
  apiKey = args.apikey;
  applicationKey = args.applicationKey

  UbidotsAPI = args._plugin_env_UbidotsAPI; // Ubidots base URL    
  AmbientWeatherAPI = args._plugin_env_AmbientWeatherAPI; // Ambient Weather base URL
  
  return weatherAmbientRequest().then(async (waResponse) => {
    
    var waResponse = waResponse[0];

    var actualTimestamp = waResponse['dateutc'];

    var payload = {};

    for (const key in waResponse) {
      if (waResponse.hasOwnProperty(key)) {
        const element = waResponse[key];
        if (key != 'dateutc' && key != 'date') {
          payload[key] = {
            'value': element,
            'timestamp': actualTimestamp
          }
        }
      }
    }

    var POSTRequest = await ubidotsPostRequest(deviceMAC, payload);

    console.log(POSTRequest)

    return {
      parser_status: "OK",
      details: POSTRequest
    }

  }).catch((err) => {

    return {
      status: "error",
      server_code: err.statusCode,
      "details": err.message
    }

  });
}