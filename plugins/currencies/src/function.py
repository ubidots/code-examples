import requests
import time


def main(kwargs):

    print("[INFO] Info recieved: {}".format(kwargs))

    if len(kwargs) < 4:
        print("[ERROR] One or more parameters are missing")
        return {"result": "error"}

    result = get_currency(**kwargs)

    if result.get("result") == "ok":
        args = result.get("data")
    else:
        return result

    print("[INFO] Currencies obtained", args)
    data = {}

    for i in args.get("rates"):
        data[i] = {
            "value": args.get("rates").get(i),
            "context": {"base": args.get("base")},
        }

    req = update_device(data, **kwargs)
    del kwargs

    return req


def get_currency(currencies, base, _plugin_env_API_URL, **kwargs):

    url = "{}/latest?base={}&symbols={}".format(_plugin_env_API_URL, base, currencies)
    headers = {"Content-Type": "application/json"}
    try:
        req = create_request(url, headers, attempts=5, request_type="get")
    except:
        return {
            "result": "[ERROR] The currency server did not respond, please try again later"
        }
    return {"result": "ok", "data": req.json()}


def update_device(
    payload, _plugin_env_UBIDOTS_URL, deviceLabel, ubidotsToken, **kwargs
):
    """
    updates a variable with a single dot
    """
    url = "{}/api/v1.6/devices/{}".format(_plugin_env_UBIDOTS_URL, deviceLabel)
    headers = {"X-Auth-Token": ubidotsToken, "Content-Type": "application/json"}
    req = create_request(url, headers, attempts=5, request_type="post", data=payload)
    return {"result": "ok", "data": req.json()}


def create_request(url, headers, attempts, request_type, data=None):
    """
    Function to make a request to the server
    """
    request_func = getattr(requests, request_type)
    kwargs = {"url": url, "headers": headers}
    if request_type == "post" or request_type == "patch":
        kwargs["json"] = data
    try:
        req = request_func(**kwargs)
        print("[INFO] Request result: {}".format(req.text))
        status_code = req.status_code
        time.sleep(1)
        while status_code >= 400 and attempts < 5:
            req = request_func(**kwargs)
            print("[INFO] Request result: {}".format(req.text))
            status_code = req.status_code
            attempts += 1
            time.sleep(1)
        return req
    except Exception as e:
        print("[ERROR] There was an error with the request, details:")
        print(e)
        return None
