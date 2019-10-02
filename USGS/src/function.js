var request = require('request-promise');

function getFullUrl(args) {
    var params = `&sites=${args['sites']}&parameterCd=${args['parameterCd']}`;
    return `${args['_plugin_env_urlUsgs']}${params}&siteStatus=all`;
}

function getUbidotsFullUrl(ubidotsUrl, deviceLabel, variableLabel) {
    return `${ubidotsUrl}/${deviceLabel}/${variableLabel}/values`;
}

async function getRequest(_plugin_env_urlUsgs) {
    var options = {
        url: _plugin_env_urlUsgs,
        json: true,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    return await request.get(options);
}

function transformData(data) {
    var variables = data.values;

    var value;
    var date;
    var timestamp;

    var ubidotsJsonData = [];

    for (let i = 0; i < variables.length; i++) {
        var variableValues = variables[i].value;

        for (let j = 0; j <  variableValues.length ; j++) {

            value = variableValues[j].value;

            date = new Date(variableValues[j].dateTime);
            timestamp = date.getTime();

            ubidotsJsonData.push(UbiVariable(value, timestamp));
        }
    }

    return '[' + ubidotsJsonData.join(',') + ']';
}

function UbiVariable(value, timestampValue) {
    return `{"value":${value},"timestamp":${timestampValue}}`
}

async function ubidotsRequest(ubidotsUrl, ubidotsToken, payload) {

    var options = {
        method: 'POST',
        url: ubidotsUrl,
        body: JSON.parse(payload),
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': ubidotsToken
        }
    };

    return await request.post(options);
}

async function main(args) {

    var fullUrl = getFullUrl(args);
    var responseData = await getRequest(fullUrl);

    var ubidotsResponse = '';
    var deviceLabel = args['device'];
    var ubidotsToken = args['token'];
    var ubidotsUrl = args['_plugin_env_urlUbidots'];

    var variableData = responseData.value.timeSeries;

    for (let index = 0; index < variableData.length; index++) {

        var variableLabel = variableData[index].variable.variableCode[0].value;
        var payload = transformData(variableData[index]);

        var ubidotsFullUrl = getUbidotsFullUrl(ubidotsUrl, deviceLabel, variableLabel);

        ubidotsResponse.concat(await ubidotsRequest(ubidotsFullUrl, ubidotsToken, payload));
    }

    console.log(ubidotsResponse);  

    return {"result": ubidotsResponse};
}