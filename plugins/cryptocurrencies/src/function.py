import requests
import json
import time

UBIDOTS_BASE_URL = "https://industrial.api.ubidots.com"
COINDESK_BASE_URL = "https://api.coindesk.com"
VARIABLE_LABELS = {
    "USD": "bitcoin-usd",
    "GBP": "bitcoin-gbp",
    "EUR": "bitcoin-eur"
}


def create_request(url, headers, attempts, request_type, data=None):
    """
    """
    request_func = getattr(requests, request_type)
    kwargs = {"url": url, "headers": headers}
    if request_type == "post" or request_type == "patch":
        kwargs["json"] = data
    try:
        req = request_func(**kwargs)
        status_code = req.status_code
        time.sleep(1)
        while status_code >= 400 and attempts < 5:
            req = request_func(**kwargs)
            status_code = req.status_code
            attempts += 1
            time.sleep(1)
        return req
    except Exception as e:
        print("[ERROR] There was an error with the request, details:")
        print(e)
        return None


def update_device(device, payload, token):
    """
    """
    url = "{}/api/v1.6/devices/{}".format(UBIDOTS_BASE_URL, device)
    headers = {"X-Auth-Token": token, "Content-Type": "application/json"}
    req = create_request(url, headers, attempts=5,
                         request_type="post", data=payload)
    return req


def get_bitcoin_data_exchange():
    """
    """
    url = "{}/v1/bpi/currentprice.json".format(COINDESK_BASE_URL)
    headers = {}
    req = create_request(url, headers, attempts=5, request_type="get")
    return req


def build_payload(data, currencies):
    """
    """
    payload = {}
    for currency in currencies:
        try:
            payload[VARIABLE_LABELS[currency]
                    ] = data['bpi'][currency]['rate_float']
        except Exception as er:
            print("[ERROR] There was an error building the payload, details:")
            print(er)
    return payload


def initial_variables(args):
    """
    """
    return [
        args['token'],
        args['label'],
        args['currencies'].split(',')
    ]


def main(args):
    token, device, currencies = initial_variables(args)
    crypto_request = get_bitcoin_data_exchange()

    if crypto_request.status_code >= 400 and crypto_request.status_code < 600:
        raise "Error code: {} – Unvalid response from Coindesk API".format(
            crypto_request.status_code)

    data = crypto_request.json()
    payload = build_payload(data, currencies)
    ubi_request = update_device(device, payload, token)

    return {"STATUS": ubi_request.status_code}
