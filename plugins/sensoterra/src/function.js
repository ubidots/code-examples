/* MODULES */
var request = require("request-promise");

/* VARIABLES */
var lat, lng, status, signalStrength, payload;

/* Get an API Key to further use the Sensoterra API. Expires after 30 minutes */
async function getApiKey(endpoint, username, password) {
  var urlAuth = `${endpoint}/customer/auth`;
  var options = {
    method: "POST",
    url: urlAuth,
    body: { email: username, password: password },
    json: true,
    headers: {
      accept: "application/json",
      language: "en",
      "Content-Type": "application/json"
    }
  };
  return await request.post(options);
}

/* Get probes' readings from Sensoterra  */
async function getProbes(endpoint, key, limit, skip) {
  var urlProbes = `${endpoint}/probe?limit=${limit}&skip=${skip}`;
  var optionsProbes = {
    method: "GET",
    url: urlProbes,
    json: true,
    headers: {
      accept: "application/json",
      language: "en",
      api_key: key
    }
  };
  return await request.get(optionsProbes);
}

/* Return the probes' depth based on the ID received */
function probeDepth(depthId) {
  var id = {
    7: "15 CM",
    9: "30 CM",
    11: "60 CM",
    13: "120 CM",
    14: "90 CM"
  };
  return id[depthId];
}

/* Return the probes' soil type based on the ID received */
function probeSoil(soilId) {
  var id = {
    1: "Clay",
    3: "Sand",
    15: "Peat",
    16: "Clay loam",
    17: "Saline clay"
  };
  return id[soilId];
}

/* Request probe's data to Sensoterra API and post it to Ubidots */
async function dataIngestion(
  _plugin_env_sensoterraUrl,
  email,
  password,
  limit,
  skip,
  _plugin_env_ubidotsUrl,
  ubidotsToken,
  _plugin_env_varLabelSoilMoisture
) {
  var ubidotsResponse = {};
  /* Getting an API Key for auth */
  var response = await getApiKey(_plugin_env_sensoterraUrl, email, password);
  var apiKey = response["api_key"]; // Get API key from response.
  /* Get last value from registered probes on Sensoterra */
  var probes = await getProbes(_plugin_env_sensoterraUrl, apiKey, limit, skip);
  /* Checks size of JSON to update data for the available probes */
  var size = Object.keys(probes).length; // Size of the retrieved JSON file
  for (var i = 0; i < size; i++) {
    var deviceName = probes[i]["name"];
    var deviceLabel = probes[i]["id"];
    var value = probes[i]["status"]["last_reading"];
    var depthId = probes[i]["depth_id"];
    var soilId = probes[i]["soil_profile"][0]["soil_id"];
    var timestamp = new Date(probes[i]["status"]["last_update"]).valueOf(); //in milliseconds
    lat = probes[i]["latitude"];
    lng = probes[i]["longitude"];
    status = probes[i]["status"]["code"];
    signalStrength = probes[i]["status"]["signal_strength"];

    /* Build JSON */
    payload = buildJson(_plugin_env_varLabelSoilMoisture, value, timestamp);

    try {
      /* Create a new devices at Ubidots if doesn't exists */
      await ubidotsDeviceCreation(
        _plugin_env_ubidotsUrl,
        ubidotsToken,
        deviceName,
        deviceLabel,
        probeDepth(depthId),
        probeSoil(soilId)
      );
      /* Post to Ubidots */
      postResponse = await ubidotsPost(
        _plugin_env_ubidotsUrl,
        ubidotsToken,
        deviceLabel,
        payload
      );
      ubidotsResponse[deviceName] = postResponse;
    } catch (error) {
      return error;
    }
  }
  return ubidotsResponse;
}

/* Create a new device at Ubidots if the device doesn't exist*/
async function ubidotsDeviceCreation(
  ubidotsUrl,
  ubidotsToken,
  deviceName,
  deviceLabel,
  depth,
  soil
) {
  var deviceBody = {
    label: `sensoterra-${deviceLabel}`,
    name: deviceName,
    context: {
      probeDepth: depth,
      probeSoil: soil,
      _config: {
        probeDepth: {
          text: "Depth",
          type: "text",
          description: "Depth (in CM) of the probe deployed."
        },
        probeSoil: {
          text: "Soil",
          type: "text",
          description: "Soil type of the probe deployed."
        }
      }
    }
  };

  var options = {
    method: "POST",
    url: `${ubidotsUrl}/datasources`,
    body: deviceBody,
    json: true,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": ubidotsToken
    }
  };

  try {
    return await request.post(options);
  } catch (error) {
    return error;
  }
}

/* Post data to Ubidots */
async function ubidotsPost(ubidotsUrl, ubidotsToken, deviceLabel, payload) {
  var options = {
    method: "POST",
    url: `${ubidotsUrl}/devices/sensoterra-` + deviceLabel,
    body: payload,
    json: true,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": ubidotsToken
    }
  };
  return await request.post(options);
}

/* Build JSON with Soil Moisture, GPS location, signal strength variables */
function buildJson(variableLabel, reading, datetime) {
  var payload = {
    [variableLabel]: {
      value: reading,
      timestamp: datetime,
      context: {
        status: status
      }
    },
    location: {
      value: 1,
      timestamp: datetime,
      context: {
        lat: lat,
        lng: lng
      }
    },
    "signal-strength": {
      value: signalStrength,
      timestamp: datetime
    }
  };
  return payload;
}

async function main(params) {
  var email = params.email; // Username
  var password = params.password; // Password
  var limit = params.limit; // Maximum number of results to return from Sensoterra
  var skip = params.skip; // The number of results to skip from Sensoterra
  var ubidotsToken = params.ubidotsToken; // Ubidots Token
  var _plugin_env_ubidotsUrl = params._plugin_env_ubidotsUrl; // Ubidots base URL
  var _plugin_env_sensoterraUrl = params._plugin_env_sensoterraUrl; // Sensoterra base URL
  var _plugin_env_varLabelSoilMoisture =
    params._plugin_env_varLabelSoilMoisture; // Ubidots soil moisture variable label

  try {
    return await dataIngestion(
      _plugin_env_sensoterraUrl,
      email,
      password,
      limit,
      skip,
      _plugin_env_ubidotsUrl,
      ubidotsToken,
      _plugin_env_varLabelSoilMoisture
    );
  } catch (error) {
    return error;
  }
}